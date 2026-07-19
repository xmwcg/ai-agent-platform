"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTraceEvent = buildTraceEvent;
exports.selectTracerMode = selectTracerMode;
exports.getTracer = getTracer;
exports.measure = measure;
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
const axios_1 = __importDefault(require("axios"));
/** 纯函数：构造一次 trace 事件（Langfuse ingestion 兼容结构） */
function buildTraceEvent(input, idGen) {
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
function selectTracerMode(env = process.env) {
    const explicit = env.TRACER_MODE;
    if (explicit === 'langfuse')
        return 'langfuse';
    if (explicit === 'noop')
        return 'noop';
    if (env.LANGFUSE_PUBLIC_KEY && env.LANGFUSE_SECRET_KEY && env.LANGFUSE_HOST)
        return 'langfuse';
    return 'noop';
}
class NoopTracer {
    constructor() {
        this.mode = 'noop';
    }
    isConfigured() {
        return true;
    }
    trace(event) {
        if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test') {
            // eslint-disable-next-line no-console
            console.debug('[trace:noop]', event.name, event.status, `${event.durationMs ?? 0}ms`);
        }
    }
}
class LangfuseTracer {
    constructor(env = process.env) {
        this.mode = 'langfuse';
        this.env = env;
    }
    get host() {
        return (this.env.LANGFUSE_HOST || '').replace(/\/$/, '');
    }
    get publicKey() {
        return this.env.LANGFUSE_PUBLIC_KEY || '';
    }
    get secretKey() {
        return this.env.LANGFUSE_SECRET_KEY || '';
    }
    isConfigured() {
        return !!this.publicKey && !!this.secretKey && !!this.host;
    }
    trace(event) {
        if (!this.isConfigured())
            return;
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
        axios_1.default
            .post(`${this.host}/api/public/ingestion`, batch, {
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            timeout: 5000,
        })
            .catch(() => undefined); // fire-and-forget
    }
}
const NOOP_TRACER = new NoopTracer();
function getTracer(env = process.env) {
    return selectTracerMode(env) === 'langfuse' ? new LangfuseTracer(env) : NOOP_TRACER;
}
/**
 * 包裹一个异步函数，自动计时并以 trace 上报（保留原函数返回值）。
 */
async function measure(name, fn, opts = {}) {
    const tracer = getTracer();
    const start = Date.now();
    try {
        const result = await fn();
        tracer.trace(buildTraceEvent({
            name,
            userId: opts.userId,
            durationMs: Date.now() - start,
            status: 'ok',
            input: opts.input,
            output: typeof result === 'object' ? '[object]' : result,
            meta: opts.meta,
        }));
        return result;
    }
    catch (e) {
        tracer.trace(buildTraceEvent({
            name,
            userId: opts.userId,
            durationMs: Date.now() - start,
            status: 'error',
            input: opts.input,
            output: e instanceof Error ? e.message : String(e),
            meta: opts.meta,
        }));
        throw e;
    }
}
exports.default = getTracer;
//# sourceMappingURL=trace.js.map