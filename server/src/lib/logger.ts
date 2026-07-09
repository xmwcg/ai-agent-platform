/**
 * 轻量结构化日志（L3）
 *
 * 零新增依赖，封装 console，统一输出：`<ISO时间> [LEVEL] <module> <message>`。
 * 兼容既有 jest setup（`jest.spyOn(console, ...)` 仍可静音）。
 * 生产环境可在此扩展为 JSON 行或接入日志系统，调用方无需改动。
 */

type Level = 'INFO' | 'WARN' | 'ERROR' | 'DEBUG';

function fmt(level: Level, module: string, message: string): string {
  const ts = new Date().toISOString();
  return `${ts} [${level}]${module ? ` ${module}` : ''} ${message}`;
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
    consoleMethods[method](line, meta);
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
