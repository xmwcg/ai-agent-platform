/**
 * 轻量结构化日志（L3+）
 *
 * 零新增依赖，封装 console，统一输出：`<ISO时间> [LEVEL] <module> <message>`。
 * 兼容既有 jest setup（`jest.spyOn(console, ...)` 仍可静音）。
 * 生产环境可在此扩展为 JSON 行或接入日志系统，调用方无需改动。
 * 自动对 meta 中的敏感信息做掩码（手机号/邮箱/Token/API Key），防止日志泄露。
 */

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function fmt(level: Level, module: string, message: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${level}]${module ? ` ${module}` : ''} ${message}`;
}

// ─── 敏感信息掩码（P2 加固） ───
const SENSITIVE_KEYS = ['password', 'token', 'secret', 'apiKey', 'api_key', 'apikey',
  'authorization', 'jwt', 'bearer', 'credit_card', 'ssn', 'passport'];

function isSensitiveKey(key: string): boolean {
  const lower = key.toLowerCase().replace(/[_-]/g, '');
  return SENSITIVE_KEYS.some((sk) => lower.includes(sk));
}

function maskValue(val: unknown): unknown {
  if (typeof val !== 'string') return val;
  if (val.length > 100) return `[REDACTED:${val.length}chars]`;
  return '[REDACTED]';
}

function sanitizeMeta(obj: unknown, depth = 0): unknown {
  if (depth > 5) return '[MAX_DEPTH]';
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') return obj;
  if (typeof obj !== 'object') return obj;

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMeta(item, depth + 1));
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    if (isSensitiveKey(key)) {
      result[key] = maskValue(value);
    } else if (typeof value === 'object' && value !== null) {
      result[key] = sanitizeMeta(value, depth + 1);
    } else {
      result[key] = value;
    }
  }
  return result;
}

type ConsoleMethod = 'log' | 'warn' | 'error';

const consoleMethods: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  log: (...args: unknown[]) => console.log(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => console.error(...args),
};

function write(level: Level, method: ConsoleMethod, module: string, message: string, meta?: unknown): void {
  const line = fmt(level, module, message);
  if (meta !== undefined) {
    const sanitized = sanitizeMeta(meta);
    consoleMethods[method](line, sanitized);
  } else {
    consoleMethods[method](line);
  }
}

export const logger = {
  info(module: string, message: string, meta?: unknown): void {
    write('INFO', 'log', module, message, meta);
  },
  warn(module: string, message: string, meta?: unknown): void {
    write('WARN', 'warn', module, message, meta);
  },
  error(module: string, message: string, meta?: unknown): void {
    write('ERROR', 'error', module, message, meta);
  },
  debug(module: string, message: string, meta?: unknown): void {
    if (process.env.NODE_ENV === 'production') return;
    write('DEBUG', 'log', module, message, meta);
  },
};

export default logger;
