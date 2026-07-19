/**
 * 轻量级 APM（应用性能监控）中间件
 *
 * 功能：
 * - 请求耗时追踪（P50/P95/P99）
 * - 慢请求检测（超过阈值的自动告警日志）
 * - 错误率统计
 * - 内存/CPU 健康快照
 * - 告警阈值（阶段3 增强）：错误率 / 慢请求占比超阈值触发告警（带冷却，避免刷屏）
 * - 暴露 /health/vitals（JSON）与 /api/metrics（Prometheus 文本，见 lib/prometheus.ts）
 *
 * 设计原则：零外部依赖，纯内存统计，适合中小规模（< 10000 RPS）。
 * 大规模场景建议升级到 Prometheus + Grafana（/api/metrics 已给出标准抓取格式）。
 */
import { Request, Response, NextFunction } from 'express';
interface MetricsBucket {
    count: number;
    totalMs: number;
    minMs: number;
    maxMs: number;
    errors: number;
    slow: number;
    /** 耗时分布桶 (ms): 0-50, 50-100, 100-250, 250-500, 500-1000, 1000-3000, 3000+ */
    histogram: number[];
}
export interface RouteMetric {
    requests: number;
    avgMs: number;
    minMs: number;
    maxMs: number;
    errors: number;
    errorRate: number;
    histogram: number[];
}
export interface SlowLog {
    timestamp: number;
    method: string;
    path: string;
    durationMs: number;
    ip: string;
    requestId?: string;
}
export interface ApmSnapshot {
    startedAt: number;
    uptimeSec: number;
    requests: {
        total: number;
        active: number;
        errors: number;
        errorRate: number;
    };
    routes: Record<string, RouteMetric>;
    memory: {
        heapUsedMB: number;
        heapTotalMB: number;
        rssMB: number;
        externalMB: number;
    };
    slowLogs: SlowLog[];
}
export declare const DEFAULT_ALERT_THRESHOLDS: {
    errorRate: number;
    slowRate: number;
};
/**
 * 纯函数：根据桶数据评估是否触发告警。
 * 返回告警原因（'error_rate' | 'slow_rate'）或 null。可单测。
 */
export declare function evaluateAlert(bucket: {
    count: number;
    errors: number;
    slow: number;
}, thresholds?: {
    errorRate: number;
    slowRate: number;
}): 'error_rate' | 'slow_rate' | null;
export declare function apmMiddleware(req: Request, res: Response, next: NextFunction): void;
export declare function computePercentile(values: number[], p: number): number;
export declare function computeRoutePercentiles(bucket: MetricsBucket): {
    p50: number;
    p95: number;
    p99: number;
    mean: number;
};
export declare function collectApmMetrics(): ApmSnapshot;
export declare function vitalsHandler(_req: Request, res: Response): void;
/** 重置指标（用于测试） */
export declare function resetApmMetrics(): void;
/** 当日（自然日 00:00 起）5xx 错误数，供运营仪表盘展示真实数据 */
export declare function getToday5xxCount(): number;
/** 基于最近样本计算 P95 / P99 延迟（毫秒） */
export declare function getLatencyPercentiles(): {
    p95: number;
    p99: number;
};
/** 请求成功率（%）：(总请求 - 错误) / 总请求，真实反映可用性 */
export declare function getSuccessRatePercent(): number;
export declare function startApmPersistence(): Promise<void>;
export {};
//# sourceMappingURL=apm.d.ts.map