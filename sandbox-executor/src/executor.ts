/**
 * Docker 沙箱执行逻辑
 *
 * 使用 Docker CLI 创建隔离容器执行代码，执行后立即销毁。
 * 每个语言使用预构建的 Docker 镜像。
 */
import { execFile } from 'child_process';
import { randomBytes } from 'crypto';
import { writeFile, unlink, mkdir } from 'fs/promises';
const SANDBOX_TMP = process.env.SANDBOX_TMPDIR || '/tmp';
import { join } from 'path';

export interface SandboxExecRequest {
  language: string;
  code: string;
  maxTimeoutMs: number;
  maxMemoryMB: number;
  maxCpuShares: number;
  maxPids: number;
  maxOutputBytes: number;
}

export interface SandboxExecResult {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  durationMs: number;
  /** 资源消耗 */
  resourceUsage?: {
    maxMemoryBytes?: number;
    cpuTimeMs?: number;
    wallTimeMs?: number;
  };
  /** 安全事件 */
  securityEvents?: Array<{ type: string; message: string }>;
}

/** 危险代码检测（静态第一道防线） */
const DANGEROUS_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'rm -rf root', re: /\brm\s+-rf\s+\/\b/i },
  { label: 'system call', re: /\bos\s*\.\s*system\s*\(/i },
  { label: 'subprocess', re: /\bsubprocess\b/i },
  { label: 'dynamic import', re: /__import__\s*\(/ },
  { label: 'child_process', re: /child_process/i },
  { label: 'download-and-pipe', re: /\b(curl|wget)\b[^\n]*\|\s*(sh|bash)/i },
  { label: 'listen on all interfaces', re: /\b(listen|bind)\b[^\n]*0\.0\.0\.0/i },
  { label: 'eval exec', re: /\beval\s*\(\s*(require|import|fetch)/i },
  { label: 'deno/permission', re: /\b(Deno\.run|Deno\.Process)\b/ },
];

function detectDangerous(code: string): string[] {
  return DANGEROUS_PATTERNS.filter((p) => p.re.test(code)).map((p) => p.label);
}

/** 语言到 Docker 镜像的映射 */
const LANGUAGE_IMAGES: Record<string, { image: string; entry: string[]; fileExt: string }> = {
  python: {
    image: process.env.DOCKER_IMAGE_PYTHON || 'python:3.12-slim',
    entry: ['sh', '-c', 'python3 /code.py'],
    fileExt: '.py',
  },
  javascript: {
    image: process.env.DOCKER_IMAGE_NODE || 'node:20-slim',
    entry: ['sh', '-c', 'node /code.js'],
    fileExt: '.js',
  },
  typescript: {
    image: process.env.DOCKER_IMAGE_TS || 'node:20-slim',
    entry: ['sh', '-c', 'npx tsx /code.ts'],
    fileExt: '.ts',
  },
  bash: {
    image: process.env.DOCKER_IMAGE_BASH || 'alpine:3.19',
    entry: ['sh', '-c', 'sh /code.sh'],
    fileExt: '.sh',
  },
};

/**
 * 在 Docker 隔离容器中执行代码
 */
export async function execDockerSandbox(request: SandboxExecRequest): Promise<SandboxExecResult> {
  const { language, code, maxTimeoutMs, maxMemoryMB, maxCpuShares, maxPids, maxOutputBytes } = request;
  const startTime = Date.now();
  const securityEvents: Array<{ type: string; message: string }> = [];

  // 静态危险检测
  const dangerous = detectDangerous(code);
  if (dangerous.length > 0) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `检测到高危写法，已拒绝执行：${dangerous.join('；')}`,
      timedOut: false,
      durationMs: Date.now() - startTime,
      securityEvents: [{ type: 'dangerous_code', message: dangerous.join(', ') }],
    };
  }

  const langConfig = LANGUAGE_IMAGES[language];
  if (!langConfig) {
    return {
      exitCode: 1,
      stdout: '',
      stderr: `不支持的语言: ${language}`,
      timedOut: false,
      durationMs: 0,
    };
  }

  // 生成唯一文件名
  const runId = randomBytes(8).toString('hex');
  const fileName = `sandbox-${runId}${langConfig.fileExt}`;
  const tmpFilePath = join(SANDBOX_TMP, fileName);

  try {
    // 确保临时目录存在
    await mkdir(SANDBOX_TMP, { recursive: true }).catch(() => {});
    // 写入代码到临时文件
    await writeFile(tmpFilePath, code, 'utf8');

    // Docker 参数（安全加固）
    const cpuPeriod = 100000; // 100ms period
    const cpuQuota = Math.floor(cpuPeriod * maxCpuShares); // proportional to shares

    const dockerArgs = [
      'run',
      '--rm',                      // 执行后自动删除
      '--name', `sandbox-${runId}`,
      '--user', '1000:1000',        // 非 root 用户
      '--read-only',                // 只读根文件系统
      '--tmpfs', '/tmp:rw,noexec,nosuid,size=32m',  // 独立临时目录
      '--network', 'none',          // 禁用网络
      '--cap-drop', 'ALL',          // 删除所有 capabilities
      '--security-opt', 'no-new-privileges:true',
      '--security-opt', 'seccomp=unconfined',  // 或使用自定义 seccomp profile
      '--memory', `${maxMemoryMB}m`,
      '--memory-swap', `${maxMemoryMB}m`,
      '--cpus', String(maxCpuShares),
      '--pids-limit', String(maxPids),
      '--ulimit', 'nofile=64:64',
      '--ulimit', 'nproc=64:64',
      '--stop-timeout', '2',
      // 挂载代码文件
      '-v', `${tmpFilePath}:/code${langConfig.fileExt}:rw`,
      // 设置工作目录
      '-w', '/tmp',
      // 镜像
      langConfig.image,
      // 入口命令
      ...langConfig.entry,
    ];

    // 执行 Docker
    const result = await new Promise<{ stdout: string; stderr: string; exitCode: number }>((resolve, reject) => {
      const child = execFile('docker', dockerArgs, {
        timeout: maxTimeoutMs + 5000, // 给 docker pull 留额外时间
        maxBuffer: maxOutputBytes + 65536,
      }, (err, stdout, stderr) => {
        if (err) {
          if ((err as any).killed) {
            // 超时
            resolve({ stdout: stdout || '', stderr: `执行超时（>${maxTimeoutMs}ms）已被终止`, exitCode: 124 });
          } else {
            resolve({ stdout: stdout || '', stderr: stderr || err.message, exitCode: (err as any).code || 1 });
          }
        } else {
          resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: 0 });
        }
      });

      child.on('error', (e) => reject(e));
    });

    const durationMs = Date.now() - startTime;

    // 检查输出大小
    let stdout = result.stdout;
    let stderr = result.stderr;
    if (Buffer.byteLength(stdout, 'utf8') > maxOutputBytes) {
      stdout = stdout.slice(0, maxOutputBytes) + '\n…（输出已截断）';
    }
    if (Buffer.byteLength(stderr, 'utf8') > maxOutputBytes) {
      stderr = stderr.slice(0, maxOutputBytes) + '\n…（输出已截断）';
    }

    return {
      exitCode: result.exitCode,
      stdout,
      stderr,
      timedOut: result.exitCode === 124,
      durationMs,
      resourceUsage: {
        wallTimeMs: durationMs,
      },
      securityEvents: securityEvents.length > 0 ? securityEvents : undefined,
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    return {
      exitCode: -1,
      stdout: '',
      stderr: `沙箱执行失败: ${err.message || String(err)}`,
      timedOut: false,
      durationMs,
    };
  } finally {
    // 清理临时文件
    unlink(tmpFilePath).catch(() => {});
  }
}
