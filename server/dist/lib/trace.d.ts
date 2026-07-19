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
export declare function buildTraceEvent(input: TraceInput, idGen?: () => string): TraceEvent;
/** 纯函数：根据环境变量推导 Tracer 模式，默认 noop */
export declare function selectTracerMode(env?: Record<string, string | undefined>): TracerMode;
export interface Tracer {
    mode: TracerMode;
    isConfigured(): boolean;
    trace(event: TraceEvent): void;
}
export declare function getTracer(env?: Record<string, string | undefined>): Tracer;
/**
 * 包裹一个异步函数，自动计时并以 trace 上报（保留原函数返回值）。
 */
export declare function measure<T>(name: string, fn: () => Promise<T>, opts?: {
    userId?: string;
    input?: unknown;
    meta?: Record<string, unknown>;
}): Promise<T>;
export default getTracer;
//# sourceMappingURL=trace.d.ts.map