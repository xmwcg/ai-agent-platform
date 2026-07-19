"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ALERT_THRESHOLDS = void 0;
exports.evaluateAlert = evaluateAlert;
exports.apmMiddleware = apmMiddleware;
exports.computePercentile = computePercentile;
exports.computeRoutePercentiles = computeRoutePercentiles;
exports.collectApmMetrics = collectApmMetrics;
exports.vitalsHandler = vitalsHandler;
exports.resetApmMetrics = resetApmMetrics;
exports.getToday5xxCount = getToday5xxCount;
exports.getLatencyPercentiles = getLatencyPercentiles;
exports.getSuccessRatePercent = getSuccessRatePercent;
exports.startApmPersistence = startApmPersistence;
const logger_1 = require("../lib/logger");
// ─── 全局指标 ───
const SLOW_THRESHOLD_MS = 500; // 超过 500ms 视为慢请求
const HISTOGRAM_BANDS = [50, 100, 250, 500, 1000, 3000, Infinity];
const MAX_SLOW_LOGS = 100;
// ─── 告警阈值（阶段3 增强）───
exports.DEFAULT_ALERT_THRESHOLDS = {
    errorRate: 0.2, // 错误率 ≥ 20% 触发告警
    slowRate: 0.3, // 慢请求占比 ≥ 30% 触发告警
};
const ALERT_COOLDOWN_MS = 60000; // 同一路由 60s 内只告警一次，避免刷屏
const metrics = {
    startedAt: Date.now(),
    totalRequests: 0,
    activeRequests: 0,
    totalErrors: 0,
    total5xx: 0,
    /** 5xx 响应时间戳（毫秒），用于按自然日统计 today5xx */
    errors5xxTimestamps: [],
    /** 最近请求耗时样本（用于精确 p95/p99 计算，封顶防止内存膨胀） */
    recentDurations: [],
    routes: new Map(),
    slowLogs: [],
};
const lastAlertAt = new Map();
/** 取路由前缀用于聚合（如 /api/text2img/generate → /api/text2img） */
function routePrefix(path) {
    const parts = path.split('/');
    if (parts.length >= 3 && parts[1] === 'api') {
        return `/${parts[1]}/${parts[2]}`;
    }
    return parts.length >= 2 ? `/${parts[1]}` : '/';
}
function ensureBucket(prefix) {
    if (!metrics.routes.has(prefix)) {
        metrics.routes.set(prefix, {
            count: 0,
            totalMs: 0,
            minMs: Number.MAX_SAFE_INTEGER,
            maxMs: 0,
            errors: 0,
            slow: 0,
            histogram: new Array(HISTOGRAM_BANDS.length).fill(0),
        });
    }
    return metrics.routes.get(prefix);
}
/**
 * 纯函数：根据桶数据评估是否触发告警。
 * 返回告警原因（'error_rate' | 'slow_rate'）或 null。可单测。
 */
function evaluateAlert(bucket, thresholds = exports.DEFAULT_ALERT_THRESHOLDS) {
    if (bucket.count === 0)
        return null;
    if (bucket.errors / bucket.count >= thresholds.errorRate)
        return 'error_rate';
    if (bucket.slow / bucket.count >= thresholds.slowRate)
        return 'slow_rate';
    return null;
}
// ─── 中间件 ───
function apmMiddleware(req, res, next) {
    const start = process.hrtime.bigint();
    metrics.totalRequests++;
    metrics.activeRequests++;
    res.on('finish', () => {
        const elapsedNs = Number(process.hrtime.bigint() - start);
        const durationMs = Math.round((elapsedNs / 1000000000) * 1000) / 1000; // 保留 1 位小数
        metrics.activeRequests--;
        const prefix = routePrefix(req.path);
        const bucket = ensureBucket(prefix);
        bucket.count++;
        bucket.totalMs += durationMs;
        bucket.minMs = Math.min(bucket.minMs, durationMs);
        bucket.maxMs = Math.max(bucket.maxMs, durationMs);
        // 直方图分桶
        for (let i = 0; i < HISTOGRAM_BANDS.length; i++) {
            if (durationMs <= HISTOGRAM_BANDS[i]) {
                bucket.histogram[i]++;
                break;
            }
        }
        // 错误计数（4xx/5xx）
        if (res.statusCode >= 400) {
            bucket.errors++;
            metrics.totalErrors++;
        }
        // 5xx 服务端错误：单独记录时间戳，供仪表盘按自然日统计
        if (res.statusCode >= 500) {
            metrics.total5xx++;
            metrics.errors5xxTimestamps.push(Date.now());
            if (metrics.errors5xxTimestamps.length > 2000)
                metrics.errors5xxTimestamps.shift();
        }
        // 耗时样本（封顶保留最近 5000 条，用于精确分位数）
        metrics.recentDurations.push(durationMs);
        if (metrics.recentDurations.length > 5000)
            metrics.recentDurations.shift();
        // 慢请求记录
        if (durationMs > SLOW_THRESHOLD_MS) {
            bucket.slow++;
            const slow = {
                timestamp: Date.now(),
                method: req.method,
                path: req.path,
                durationMs,
                ip: (req.ip || req.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim(),
                requestId: req.requestId,
            };
            metrics.slowLogs.unshift(slow);
            if (metrics.slowLogs.length > MAX_SLOW_LOGS)
                metrics.slowLogs.pop();
            logger_1.logger.warn('apm', `慢请求: ${req.method} ${req.path} ${durationMs}ms`);
        }
        // 告警判定（带冷却：同一路由 60s 内只告警一次）
        const reason = evaluateAlert(bucket);
        if (reason) {
            const now = Date.now();
            const last = lastAlertAt.get(prefix) || 0;
            if (now - last > ALERT_COOLDOWN_MS) {
                lastAlertAt.set(prefix, now);
                logger_1.logger.warn('apm', `告警[${reason}] 路由 ${prefix} 指标超阈值 (count=${bucket.count}, errors=${bucket.errors}, slow=${bucket.slow})`);
            }
        }
    });
    next();
}
// ─── 分位数计算 ──
function computePercentile(values, p) {
    if (values.length === 0)
        return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil(sorted.length * p / 100) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}
function computeRoutePercentiles(bucket) {
    return {
        mean: bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0,
        p50: 0,
        p95: 0,
        p99: 0,
    };
}
// ─── 快照聚合（供 /health/vitals 与 /api/metrics 共用）───
function collectApmMetrics() {
    const uptimeSec = Math.round((Date.now() - metrics.startedAt) / 1000);
    const mem = process.memoryUsage();
    const routeMetrics = {};
    metrics.routes.forEach((bucket, prefix) => {
        const avgMs = bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0;
        routeMetrics[prefix] = {
            requests: bucket.count,
            avgMs,
            minMs: bucket.minMs === Number.MAX_SAFE_INTEGER ? 0 : Math.round(bucket.minMs),
            maxMs: Math.round(bucket.maxMs),
            errors: bucket.errors,
            errorRate: bucket.count > 0 ? Math.round((bucket.errors / bucket.count) * 10000) / 100 : 0,
            histogram: bucket.histogram,
        };
    });
    return {
        startedAt: metrics.startedAt,
        uptimeSec,
        requests: {
            total: metrics.totalRequests,
            active: metrics.activeRequests,
            errors: metrics.totalErrors,
            errorRate: metrics.totalRequests > 0 ? Math.round((metrics.totalErrors / metrics.totalRequests) * 10000) / 100 : 0,
        },
        routes: routeMetrics,
        memory: {
            heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            rssMB: Math.round(mem.rss / 1024 / 1024),
            externalMB: Math.round(mem.external / 1024 / 1024),
        },
        slowLogs: metrics.slowLogs.slice(0, 20),
    };
}
// ─── 健康检查 + 指标端点 ───
function vitalsHandler(_req, res) {
    const snapshot = collectApmMetrics();
    res.json({
        status: 'ok',
        service: 'ai-agent-platform',
        timestamp: new Date().toISOString(),
        ...snapshot,
    });
}
/** 重置指标（用于测试） */
function resetApmMetrics() {
    metrics.totalRequests = 0;
    metrics.totalErrors = 0;
    metrics.total5xx = 0;
    metrics.errors5xxTimestamps = [];
    metrics.recentDurations = [];
    metrics.routes.clear();
    metrics.slowLogs = [];
    lastAlertAt.clear();
}
/** 当日（自然日 00:00 起）5xx 错误数，供运营仪表盘展示真实数据 */
function getToday5xxCount() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const t = start.getTime();
    let n = 0;
    for (const ts of metrics.errors5xxTimestamps) {
        if (ts >= t)
            n++;
        else
            break; // 时间戳递增，遇到更早的可提前结束
    }
    return n;
}
/** 基于最近样本计算 P95 / P99 延迟（毫秒） */
function getLatencyPercentiles() {
    return {
        p95: computePercentile(metrics.recentDurations, 95),
        p99: computePercentile(metrics.recentDurations, 99),
    };
}
/** 请求成功率（%）：(总请求 - 错误) / 总请求，真实反映可用性 */
function getSuccessRatePercent() {
    if (metrics.totalRequests === 0)
        return 100;
    return Math.round(((metrics.totalRequests - metrics.totalErrors) / metrics.totalRequests) * 10000) / 100;
}
// ─── APM 持久化绑定（在 index.ts 中调用 startApmPersistence()）
let persistenceStarted = false;
async function startApmPersistence() {
    if (persistenceStarted)
        return;
    try {
        const { startPersistence } = await Promise.resolve().then(() => __importStar(require('./apm-persistence')));
        startPersistence(() => collectApmMetrics());
        persistenceStarted = true;
    }
    catch (err) {
        logger_1.logger.warn('apm', '持久化模块加载失败（可能缺少模块），跳过: ' + (err?.message || ''));
    }
}
//# sourceMappingURL=apm.js.map