/**
 * 调用链可观测性（OpenTelemetry / Langfuse 思路，轻量落地）
 *
 * 设计：把「一次操作（trace）」抽象为可上报事件，提供 noop（默认）/ langfuse 两种 Tracer。
 * - 默认 noop：开发/测试零依赖，仅 dev 环境 console.debug，不影响性能。
 * - langfuse：配置 LANGFUSE_PUBLIC_KEY / LANGFUSE_SECRET_KEY / LANGFUSE_HOST 后，
 *   通过 /api/public/ingestion 批量上报（Basic Auth，fire-and-forget，失败不阻塞主流程）。
 *
 * 纯函数（可单测）：buildTraceEvent / selectTracerMode。
 */
import axios from 'axios';

export type TracerMode = 'noop' | 'langfuse';

export interface TraceInput {
  name: string;
  userId?: string;
  durationMs?: number;
  status?: 'ok' | 'error';
  input?: unknown;
  output?: unknown;
  meta?: Record<string, unknown>;
}

export interface TraceEvent extends TraceInput {
  traceId: string;
  timestamp: string;
}

/** 纯函数：构造一次 trace 事件（Langfuse ingestion 兼容结构） */
export function buildTraceEvent(input: TraceInput, idGen?: () => string): TraceEvent {
  return {
    traceId: idGen ? idGen() : `trace_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    timestamp: new Date().toISOString(),
    userId: input.userId,
    durationMs: input.durationMs,
    status: input.status || 'ok',
    input: input.input,
    output: input.output,
    meta: input.meta,
    name: input.name,
  };
}

/** 纯函数：根据环境变量推导 Tracer 模式，默认 noop */
export function selectTracerMode(env: Record<string, string | undefined> = process.env): TracerMode {
  const explicit = env.TRACER_MODE;
  if (explicit === 'langfuse') return 'langfuse';
  if (explicit === 'noop') return 'noop';
  if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY && env.LANGFUSE_HOST) return 'langfuse';
  return 'noop';
}

export interface Tracer {
  mode: TracerMode;
  isConfigured(): boolean;
  trace(event: TraceEvent): void;
}

class NoopTracer implements Tracer {
  mode = 'noop' as const;
  isConfigured() {
    return true;
  }
  trace(event: TraceEvent) {
    if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
      // eslint-disable-next-line no-console
      console.debug('[trace:noop]', event.name, event.status, `${event.durationMs ?? 0}ms`);
    }
  }
}

class LangfuseTracer implements Tracer {
  mode = 'langfuse' as const;
  private env: Record<string, string | undefined>;
  constructor(env: Record<string, string | undefined> = process.env) {
    this.env = env;
  }
  private get host() {
    return (this.env.LANGFUSE_HOST || '').replace(/\/$/, '');
  }
  private get publicKey() {
    return this.env.LANGFUSE_PUBLIC_KEY || '';
  }
  private get secretKey() {
    return this.env.LANGFUSE_SECRET_KEY || '';
  }
  isConfigured() {
    return !!this.publicKey && !!this.secretKey && !!this.host;
  }
  trace(event: TraceEvent) {
    if (!this.isConfigured()) return;
    const auth = Buffer.from(`${this.publicKey}:${this.secretKey}`).toString('base64');
    const batch = {
      batch: [
        {
          type: 'trace',
          id: event.traceId,
          timestamp: event.timestamp,
          name: event.name,
          userId: event.userId,
          input: event.input,
          output: event.output,
          metadata: { ...event.meta, status: event.status, durationMs: event.durationMs },
          // Langfuse 用 observation 描述耗时，这里用 meta 兜底
          meta: { durationMs: event.durationMs, status: event.status },
        },
      ],
    };
    axios
      .post(`${this.host}/api/public/ingestion`, batch, {
        headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
        timeout: 5000,
      })
      .catch(() => undefined); // fire-and-forget
  }
}

const NOOP_TRACER: Tracer = new NoopTracer();

export function getTracer(env: Record<string, string | undefined> = process.env): Tracer {
  return selectTracerMode(env) === 'langfuse' ? new LangfuseTracer(env) : NOOP_TRACER;
}

/**
 * 包裹一个异步函数，自动计时并以 trace 上报（保留原函数返回值）。
 */
export async function measure<T>(
  name: string,
  fn: () => Promise<T>,
  opts: { userId?: string; input?: unknown; meta?: Record<string, unknown> } = {}
): Promise<T> {
  const tracer = getTracer();
  const start = Date.now();
  try {
    const result = await fn();
    tracer.trace(
      buildTraceEvent({
        name,
        userId: opts.userId,
        durationMs: Date.now() - start,
        status: 'ok',
        input: opts.input,
        output: typeof result === 'object' ? '[object]' : result,
        meta: opts.meta,
      })
    );
    return result;
  } catch (e: unknown) {
    tracer.trace(
      buildTraceEvent({
        name,
        userId: opts.userId,
        durationMs: Date.now() - start,
        status: 'error',
        input: opts.input,
        output: e instanceof Error ? e.message : String(e),
        meta: opts.meta,
      })
    );
    throw e;
  }
}

export default getTracer;
