/**
 * AIapp.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'sandbox-executor', timestamp: new Date().toISOString() });// 鉴权中间件
app.use((req, res, next) => {
  if (!AUTH_TOKEN) {
    return res.status(500).json({ error: '执行器未配置鉴权令牌' });
  }
  const auth = req.headers.authorization || '';
  if (auth !== `Bearer ${AUTH_TOKEN}`) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// 健康检查
bak 沙箱执行器（Sandbox Executor）
 *
 * 独立服务，接收主站的代码执行请求，在 Docker 隔离容器中运行代码。
 * 每个执行请求创建一个一次性容器，执行完毕后立即销毁。
 *
 * 安全措施（容器级别）：
 * - 非 root 用户运行（uid 1000:1000）
 * - 只读根文件系统（read-only rootfs）
 * - 独立 tmpfs 挂载 /tmp
 * - 删除所有 Linux capabilities
 * - 禁用网络（--network none）
 * - CPU 限制（默认 0.5 核）
 * - 内存限制（默认 256MB）
 * - PID 限制（默认 64）
 * - 执行超时（默认 10 秒）
 * - seccomp 安全配置
 * - 容器执行后自动删除（--rm）
 */
import express from 'express';
import { execDockerSandbox, SandboxExecRequest } from './executor';

const PORT = parseInt(process.env.SANDBOX_PORT || '4090', 10);
const AUTH_TOKEN = process.env.SANDBOX_AUTH_TOKEN || '';

const app = express();
app.use(express.json({ limit: '128kb' }));


});

// 代码执行接口
app.post('/execute', async (req, res) => {
  const { language, code } = req.body || {};

  if (!language || !code) {
    return res.status(400).json({ error: 'language 和 code 为必填字段' });
  }

  const validLanguages = ['python', 'javascript', 'typescript', 'bash'];
  if (!validLanguages.includes(language)) {
    return res.status(400).json({ error: `不支持的语言: ${language}，支持: ${validLanguages.join(', ')}` });
  }

  if (typeof code !== 'string' || code.trim().length === 0) {
    return res.status(400).json({ error: 'code 不能为空' });
  }

  // 最大代码长度：64KB
  if (Buffer.byteLength(code, 'utf8') > 64 * 1024) {
    return res.status(413).json({ error: '代码过长（上限 64KB）' });
  }

  try {
    const request: SandboxExecRequest = {
      language,
      code,
      maxTimeoutMs: parseInt(process.env.MAX_TIMEOUT_MS || '10000', 10),
      maxMemoryMB: parseInt(process.env.MAX_MEMORY_MB || '256', 10),
      maxCpuShares: parseFloat(process.env.MAX_CPU_SHARES || '0.5'),
      maxPids: parseInt(process.env.MAX_PIDS || '64', 10),
      maxOutputBytes: parseInt(process.env.MAX_OUTPUT_BYTES || '65536', 10),
    };

    const result = await execDockerSandbox(request);
    res.json(result);
  } catch (err: any) {
    console.error('execute error:', err.message);
    res.status(500).json({
      exitCode: -1,
      stdout: '',
      stderr: `执行器内部错误: ${err.message}`,
      timedOut: false,
      durationMs: 0,
    });
  }
});

// 启动
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Sandbox executor running on http://127.0.0.1:${PORT}`);
  if (!AUTH_TOKEN) {
    console.warn('WARNING: SANDBOX_AUTH_TOKEN not set!');
  }
});

export default app;
