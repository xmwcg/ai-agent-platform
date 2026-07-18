/**
 * 实践沙盒服务（Practice Sandbox）
 *
 * 面向「综合学习平台」的代码实践场景：用户写一小段代码（Python / JavaScript / TypeScript / Bash），
 * 在隔离环境中执行并回显 stdout / stderr / 退出码。
 *
 * 差异化设计（与媒体生成一致的多 Provider 抽象 + 优雅降级）：
 * - 多模式 Provider 抽象：mock（演示）/ local（本机子进程隔离）/ remote（远程隔离执行器，如 Docker 微服务）。
 * - 自动选择：显式指定 > 已配置模式 > 默认 mock，保证任何环境都能跑通演示。
 * - 安全防护：deny-list 静态扫描（禁止 rm -rf / os.system / child_process / curl | sh 等高危写法），
 *   纯函数实现，可完整单测；local 模式额外用子进程超时 + 隔离参数兜底。
 * - 所有可测试逻辑（语言归一化、命令构建、危险模式检测、模式选择）均为纯函数，便于单测。
 */
import { execFile } from 'child_process';
import { randomBytes, createHash } from 'crypto';
import { writeFile, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import axios from 'axios';
import { SandboxExecution } from '../models/SandboxExecution';
import { realRedis } from '../config/database';

// local 仅供非生产开发调试；生产始终强制 remote。

export type SandboxLanguage = 'python' | 'javascript' | 'typescript' | 'bash';
export type SandboxMode = 'mock' | 'local' | 'remote';
export type SandboxStatus = 'success' | 'error' | 'timeout' | 'denied';

export interface SandboxRequest {
  language: SandboxLanguage;
  code: string;
  /** 显式指定运行模式，否则按环境变量自动选择 */
  mode?: SandboxMode;
  /** 可选：资源 / 团队归属（仅用于审计），由路由层传入 */
  resourceId?: string;
}

export interface SandboxResult {
  executionId: string;
  language: SandboxLanguage;
  status: SandboxStatus;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  durationMs: number;
  mode: SandboxMode;
  /** 命中的危险模式（status==='denied' 时有值） */
  deniedPatterns?: string[];
  note?: string;
}

export const SUPPORTED_LANGUAGES: SandboxLanguage[] = ['python', 'javascript', 'typescript', 'bash'];

/** 语言别名归一化（可被单测） */
const LANGUAGE_ALIASES: Record<string, SandboxLanguage> = {
  py: 'python',
  python: 'python',
  python3: 'python',
  js: 'javascript',
  javascript: 'javascript',
  node: 'javascript',
  ts: 'typescript',
  typescript: 'typescript',
  sh: 'bash',
  bash: 'bash',
  shell: 'bash',
};

export function normalizeLanguage(input: unknown): SandboxLanguage | null {
  if (typeof input !== 'string') return null;
  const key = input.trim().toLowerCase();
  return LANGUAGE_ALIASES[key] ?? null;
}

/**
 * 危险写法 deny-list（纯函数，便于单测）。
 * 仅作为静态兜底；真正的隔离依赖 local 的进程隔离 / remote 的容器隔离。
 */
export const DANGEROUS_PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: '文件系统危险删除 (rm -rf)', re: /\brm\s+-rf\b/i },
  { label: '系统关机/重启 (shutdown/reboot)', re: /\b(shutdown|reboot|halt|poweroff)\b/i },
  { label: 'Python 系统命令执行 (os.system)', re: /\bos\s*\.\s*system\s*\(/i },
  { label: 'Python 子进程 (subprocess)', re: /\bsubprocess\b/i },
  { label: 'Python 动态导入 (__import__)', re: /__import__\s*\(/ },
  { label: 'JavaScript 子进程 (child_process)', re: /child_process/i },
  { label: 'JavaScript 动态执行 (eval)', re: /\beval\s*\(/ },
  { label: 'Node 进程退出 (process.exit)', re: /\bprocess\s*\.\s*exit\s*\(/ },
  { label: '下载并执行 (curl|wget ... | sh)', re: /\b(curl|wget)\b[^\n]*\|\s*(sh|bash)/i },
  { label: '敏感路径访问 (/etc/passwd)', re: /\/etc\/(passwd|shadow)/i },
  { label: '网络监听绑定 (0.0.0.0 端口)', re: /\b(listen|bind)\b[^\n]*0\.0\.0\.0/i },
];

/** 纯函数：返回代码中命中的危险模式标签列表（空数组表示安全） */
export function detectDangerousPatterns(code: string): string[] {
  if (typeof code !== 'string') return [];
  const hits: string[] = [];
  for (const { label, re } of DANGEROUS_PATTERNS) {
    if (re.test(code)) hits.push(label);
  }
  return hits;
}

/** 纯函数：按最大字节数截断输出，保留末尾并加省略提示 */
export function sanitizeOutput(output: string, maxBytes = 64 * 1024): string {
  if (typeof output !== 'string') return '';
  const buf = Buffer.byteLength(output, 'utf8');
  if (buf <= maxBytes) return output;
  const truncated = output.slice(0, maxBytes);
  return `${truncated}\n…（输出已截断，仅显示前 ${maxBytes} 字节）`;
}

export interface SandboxEnvConfig {
  mode?: string;
  remoteUrl?: string;
  remoteToken?: string;
  timeoutMs?: number | string;
  pythonBin?: string;
  nodeBin?: string;
  maxOutput?: number | string;
  nodeEnv?: string;
  localEnabled?: string;
  [key: string]: unknown;
}

export interface NormalizedSandboxConfig {
  mode: string;
  remoteUrl: string;
  remoteToken: string;
  timeoutMs: number;
  pythonBin: string;
  nodeBin: string;
  maxOutput: number;
  nodeEnv: string;
  localEnabled: string;
}

/** 兼容归一化配置和真实 process.env 的 SANDBOX_* 命名。 */
export function readSandboxConfig(env: SandboxEnvConfig = process.env): NormalizedSandboxConfig {
  const source = env as Record<string, unknown>;
  const timeout = Number(source.timeoutMs ?? source.SANDBOX_TIMEOUT_MS);
  const maxOut = Number(source.maxOutput ?? source.SANDBOX_MAX_OUTPUT);
  return {
    mode: String(source.mode ?? source.SANDBOX_MODE ?? ''),
    remoteUrl: String(source.remoteUrl ?? source.SANDBOX_REMOTE_URL ?? ''),
    remoteToken: String(source.remoteToken ?? source.SANDBOX_REMOTE_TOKEN ?? ''),
    timeoutMs: Number.isFinite(timeout) && timeout > 0 ? timeout : 10000,
    pythonBin: String(source.pythonBin ?? source.SANDBOX_PYTHON_BIN ?? 'python3'),
    nodeBin: String(source.nodeBin ?? source.SANDBOX_NODE_BIN ?? 'node'),
    maxOutput: Number.isFinite(maxOut) && maxOut > 0 ? maxOut : 64 * 1024,
    nodeEnv: String(source.nodeEnv ?? source.NODE_ENV ?? ''),
    localEnabled: String(source.localEnabled ?? source.SANDBOX_LOCAL_ENABLED ?? ''),
  };
}

/** 生产固定 remote；非生产才允许显式 mock/local。 */
export function selectSandboxMode(
  explicit: SandboxMode | undefined,
  config: SandboxEnvConfig = process.env
): SandboxMode {
  const cfg = readSandboxConfig(config);
  if (cfg.nodeEnv === 'production') return 'remote';

  const localEnabled = cfg.localEnabled === 'true';
  if (explicit && ['mock', 'local', 'remote'].includes(explicit)) {
    if (explicit === 'local' && !localEnabled) return 'mock';
    return explicit;
  }
  if (cfg.mode === 'local') return localEnabled ? 'local' : 'mock';
  if (cfg.mode === 'remote' && cfg.remoteUrl && cfg.remoteToken) return 'remote';
  return 'mock';
}

/** 纯函数：为本机执行构建命令与参数（local 模式使用），含 Python 隔离模式 -I */
export function buildLocalCommand(
  language: SandboxLanguage,
  filePath: string,
  bins: { pythonBin: string; nodeBin: string } = { pythonBin: 'python3', nodeBin: 'node' }
): { cmd: string; args: string[] } {
  switch (language) {
    case 'python':
      return { cmd: bins.pythonBin, args: ['-I', filePath] };
    case 'bash':
      return { cmd: 'bash', args: [filePath] };
    case 'javascript':
    case 'typescript':
      return { cmd: bins.nodeBin, args: [filePath] };
  }
}

function genExecutionId(): string {
  return `sbx_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

/** 模拟执行：回显代码中可识别的 print/console.log 字面量，并标注演示模式 */
async function simulateOutput(code: string, language: SandboxLanguage): Promise<string> {
  const lines: string[] = ['[演示模式] 沙盒未配置真实执行环境，以下为模拟输出。'];
  if (language === 'python') {
    const re = /print\s*\((['"`])([\s\S]*?)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) lines.push(m[2]);
  } else if (language === 'javascript' || language === 'typescript') {
    const re = /console\s*\.\s*log\s*\((['"`])([\s\S]*?)\1/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(code)) !== null) lines.push(m[2]);
  }
  if (lines.length === 1) lines.push('（未检测到可模拟的输出语句）');
  return lines.join('\n');
}

export interface SandboxProvider {
  name: SandboxMode;
  isConfigured(): boolean;
  run(req: SandboxRequest, ctx: SandboxEnvConfig): Promise<SandboxResult>;
}

class MockProvider implements SandboxProvider {
  name = 'mock' as const;
  isConfigured() {
    return true;
  }
  async run(req: SandboxRequest, ctx: SandboxEnvConfig): Promise<SandboxResult> {
    const start = Date.now();
    const denied = detectDangerousPatterns(req.code);
    if (denied.length > 0) {
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: 'denied',
        stdout: '',
        stderr: `检测到高危写法，已拒绝执行：${denied.join('；')}`,
        exitCode: null,
        durationMs: Date.now() - start,
        mode: 'mock',
        deniedPatterns: denied,
        note: '演示模式拒绝执行危险代码。',
      };
    }
    const stdout = await simulateOutput(req.code, req.language);
    return {
      executionId: genExecutionId(),
      language: req.language,
      status: 'success',
      stdout,
      stderr: '',
      exitCode: 0,
      durationMs: Date.now() - start,
      mode: 'mock',
      note: '演示模式：配置 SANDBOX_MODE=local/remote 后可执行真实代码。',
    };
  }
}

class LocalProvider implements SandboxProvider {
  name = 'local' as const;
  isConfigured() {
    return true;
  }
  async run(req: SandboxRequest, ctx: SandboxEnvConfig): Promise<SandboxResult> {
    const cfg = readSandboxConfig(ctx);
    const start = Date.now();
    const denied = detectDangerousPatterns(req.code);
    if (denied.length > 0) {
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: 'denied',
        stdout: '',
        stderr: `检测到高危写法，已拒绝执行：${denied.join('；')}`,
        exitCode: null,
        durationMs: Date.now() - start,
        mode: 'local',
        deniedPatterns: denied,
      };
    }
    const fileExt = req.language === 'python' ? '.py' : req.language === 'bash' ? '.sh' : '.js';
    const filePath = join(tmpdir(), `sbx_${randomBytes(6).toString('hex')}${fileExt}`);
    try {
      await writeFile(filePath, req.code, 'utf8');
      const { cmd, args } = buildLocalCommand(req.language, filePath, {
        pythonBin: cfg.pythonBin!,
        nodeBin: cfg.nodeBin!,
      });
      const { stdout, stderr, exitCode } = await runWithTimeout(cmd, args, cfg.timeoutMs!);
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: exitCode === 0 ? 'success' : 'error',
        stdout: sanitizeOutput(stdout, cfg.maxOutput),
        stderr: sanitizeOutput(stderr, cfg.maxOutput),
        exitCode,
        durationMs: Date.now() - start,
        mode: 'local',
      };
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : String(e);
      const timedOut = /__TIMEOUT__/.test(em);
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: timedOut ? 'timeout' : 'error',
        stdout: '',
        stderr: timedOut ? `执行超时（>${cfg.timeoutMs}ms）已被终止。` : em || '本地执行失败',
        exitCode: null,
        durationMs: Date.now() - start,
        mode: 'local',
      };
    } finally {
      await rm(filePath, { force: true }).catch(() => undefined);
    }
  }
}

function runWithTimeout(
  cmd: string,
  args: string[],
  timeoutMs: number
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  return new Promise((resolve, reject) => {
    const child = execFile(cmd, args, { timeout: timeoutMs, maxBuffer: 64 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err?.killed) {
        return reject(new Error('__TIMEOUT__'));
      }
      if (err && err.code === undefined && !err.killed) {
        return reject(err);
      }
      resolve({ stdout: stdout || '', stderr: stderr || '', exitCode: err == null ? 0 : typeof err.code === 'number' ? err.code : 1 });
    });
    child.on('error', (e) => reject(e));
  });
}

class RemoteProvider implements SandboxProvider {
  name = 'remote' as const;
  isConfigured(ctx?: SandboxEnvConfig) {
    const cfg = readSandboxConfig(ctx ?? process.env);
    return !!(cfg.remoteUrl && cfg.remoteToken);
  }
  async run(req: SandboxRequest, ctx: SandboxEnvConfig): Promise<SandboxResult> {
    const cfg = readSandboxConfig(ctx);
    if (!cfg.remoteUrl) {
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: 'error',
        stdout: '',
        stderr: '远程沙盒执行器未配置（SANDBOX_REMOTE_URL 缺失）。',
        exitCode: null,
        durationMs: 0,
        mode: 'remote',
        note: '请在 .env 设置 SANDBOX_REMOTE_URL 与 SANDBOX_REMOTE_TOKEN。',
      };
    }
    const start = Date.now();
    const denied = detectDangerousPatterns(req.code);
    if (denied.length > 0) {
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: 'denied',
        stdout: '',
        stderr: `检测到高危写法，已拒绝执行：${denied.join('；')}`,
        exitCode: null,
        durationMs: Date.now() - start,
        mode: 'remote',
        deniedPatterns: denied,
      };
    }
    try {
      const resp = await axios.post(
        cfg.remoteUrl!,
        { language: req.language, code: req.code },
        {
          timeout: cfg.timeoutMs,
          headers: cfg.remoteToken ? { Authorization: `Bearer ${cfg.remoteToken}` } : undefined,
        }
      );
      const d = resp.data || {};
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: d.exitCode === 0 ? 'success' : 'error',
        stdout: sanitizeOutput(String(d.stdout || ''), cfg.maxOutput),
        stderr: sanitizeOutput(String(d.stderr || ''), cfg.maxOutput),
        exitCode: typeof d.exitCode === 'number' ? d.exitCode : null,
        durationMs: Date.now() - start,
        mode: 'remote',
      };
    } catch (e: unknown) {
      const em = e instanceof Error ? e.message : String(e);
      return {
        executionId: genExecutionId(),
        language: req.language,
        status: 'error',
        stdout: '',
        stderr: `远程执行器请求失败：${em || 'unknown error'}`,
        exitCode: null,
        durationMs: Date.now() - start,
        mode: 'remote',
      };
    }
  }
}

const PROVIDERS: Record<SandboxMode, SandboxProvider> = {
  mock: new MockProvider(),
  local: new LocalProvider(),
  remote: new RemoteProvider(),
};

export const sandboxService = {
  /** 当前生效的默认模式（用于状态查询） */
  defaultMode(explicit?: SandboxMode, ctx?: SandboxEnvConfig): SandboxMode {
    return selectSandboxMode(explicit, ctx ?? process.env);
  },
  providers(ctx: SandboxEnvConfig = process.env): Array<{ mode: SandboxMode; configured: boolean }> {
    const cfg = readSandboxConfig(ctx);
    const production = cfg.nodeEnv === 'production';
    return (['mock', 'local', 'remote'] as SandboxMode[]).map((m) => ({
      mode: m,
      configured: m === 'mock'
        ? !production
        : m === 'local'
          ? !production && cfg.localEnabled === 'true'
          : Boolean(cfg.remoteUrl && cfg.remoteToken),
    }));
  },
  async run(req: SandboxRequest): Promise<SandboxResult> {
    const language = normalizeLanguage(req.language);
    if (!language) {
      return {
        executionId: genExecutionId(),
        language: (req.language as SandboxLanguage) ?? 'python',
        status: 'error',
        stdout: '',
        stderr: `不支持的语言：${req.language}`,
        exitCode: null,
        durationMs: 0,
        mode: selectSandboxMode(req.mode),
      };
    }
    const mode = selectSandboxMode(req.mode);
    return PROVIDERS[mode].run({ ...req, language }, process.env);
    },

  /**
   * 用户级限流检查（Redis 优先，降级为内存宽松）
   */
  async checkRateLimit(userId: string): Promise<{ allowed: boolean; reason?: string; retryAfterMs?: number }> {
    const now = Date.now();
    const minuteKey = `sandbox:ratelimit:${userId}:minute`; const dayKey = `sandbox:ratelimit:${userId}:day`; const concurrentKey = `sandbox:ratelimit:${userId}:concurrent`; const circuitKey = `sandbox:ratelimit:${userId}:circuit-breaker`;

    try {
      const circuitUntil = await realRedis.get(circuitKey);
      if (circuitUntil) { const until = parseInt(circuitUntil, 10); if (until > now) { return { allowed: false, reason: '执行频率过高，请稍后再试（熔断保护）', retryAfterMs: until - now }; } await realRedis.del(circuitKey); }

      const pipeline = realRedis.pipeline(); pipeline.incr(concurrentKey); pipeline.expire(concurrentKey, 30);
      const concurrentResults = await pipeline.exec(); const currentConcurrent = concurrentResults?.[0]?.[1] as number | undefined;
      if (currentConcurrent !== undefined && currentConcurrent > 3) { await realRedis.decr(concurrentKey); return { allowed: false, reason: '并发执行数已达上限（3），请等待当前任务完成' }; }

      const minuteCount = await realRedis.incr(minuteKey); if (minuteCount === 1) await realRedis.expire(minuteKey, 60);
      if (minuteCount > 10) { await realRedis.decr(concurrentKey); return { allowed: false, reason: '每分钟最多 10 次执行', retryAfterMs: 60000 }; }

      const dayCount = await realRedis.incr(dayKey);
      if (dayCount === 1) { const s = Math.ceil((new Date().setHours(24, 0, 0, 0) - now) / 1000); await realRedis.expire(dayKey, s); }
      if (dayCount > 200) { await realRedis.decr(concurrentKey); await realRedis.decr(minuteKey); return { allowed: false, reason: '每日最多 200 次执行', retryAfterMs: 86400000 }; }

      return { allowed: true };
    } catch (redisErr) { return { allowed: true }; }
  },

  async releaseConcurrentSlot(userId: string): Promise<void> { try { await realRedis.decr(`sandbox:ratelimit:${userId}:concurrent`); } catch { /* ignore */ } },

  async recordFailure(userId: string): Promise<void> {
    try { const key = `sandbox:ratelimit:${userId}:failures:24h`; const count = await realRedis.incr(key); if (count === 1) await realRedis.expire(key, 86400); if (count >= 20) { await realRedis.set(`sandbox:ratelimit:${userId}:circuit-breaker`, String(Date.now() + 300000), 'EX', 300); } } catch { /* ignore */ }
  },

  async persistExecution(userId: string, result: SandboxResult, code: string): Promise<void> {
    try {
      const codeHash = createHash('sha256').update(code, 'utf8').digest('hex');
      await SandboxExecution.create({ executionId: result.executionId, userId, language: result.language, codeHash, codeLength: Buffer.byteLength(code, 'utf8'), mode: result.mode, status: result.status, stdout: result.stdout?.slice(0, 4096), stderr: result.stderr?.slice(0, 4096), exitCode: result.exitCode, durationMs: result.durationMs, deniedPatterns: result.deniedPatterns, resourceUsage: (result as any).resourceUsage, securityEvents: (result as any).securityEvents });
      if (result.status !== 'success') { await this.recordFailure(userId); }
      await this.releaseConcurrentSlot(userId);
    } catch (err) { console.error('sandbox persistExecution error:', (err as Error)?.message || err); }
  },
};

export default sandboxService;
