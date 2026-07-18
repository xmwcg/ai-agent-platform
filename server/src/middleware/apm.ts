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
import { logger } from '../lib/logger';

// ─── 类型 ───
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
  requests: { total: number; active: number; errors: number; errorRate: number };
  routes: Record<string, RouteMetric>;
  memory: { heapUsedMB: number; heapTotalMB: number; rssMB: number; externalMB: number };
  slowLogs: SlowLog[];
}

// ─── 全局指标 ───
const SLOW_THRESHOLD_MS = 500; // 超过 500ms 视为慢请求
const HISTOGRAM_BANDS = [50, 100, 250, 500, 1000, 3000, Infinity];
const MAX_SLOW_LOGS = 100;

// ─── 告警阈值（阶段3 增强）───
export const DEFAULT_ALERT_THRESHOLDS = {
  errorRate: 0.2, // 错误率 ≥ 20% 触发告警
  slowRate: 0.3, // 慢请求占比 ≥ 30% 触发告警
};
const ALERT_COOLDOWN_MS = 60_000; // 同一路由 60s 内只告警一次，避免刷屏

const metrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  activeRequests: 0,
  totalErrors: 0,
  routes: new Map<string, MetricsBucket>(),
  slowLogs: [] as SlowLog[],
};
const lastAlertAt = new Map<string, number>();

/** 取路由前缀用于聚合（如 /api/text2img/generate → /api/text2img） */
function routePrefix(path: string): string {
  const parts = path.split('/');
  if (parts.length >= 3 && parts[1] === 'api') {
    return `/${parts[1]}/${parts[2]}`;
  }
  return parts.length >= 2 ? `/${parts[1]}` : '/';
}

function ensureBucket(prefix: string): MetricsBucket {
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
  return metrics.routes.get(prefix)!;
}

/**
 * 纯函数：根据桶数据评估是否触发告警。
 * 返回告警原因（'error_rate' | 'slow_rate'）或 null。可单测。
 */
export function evaluateAlert(
  bucket: { count: number; errors: number; slow: number },
  thresholds: { errorRate: number; slowRate: number } = DEFAULT_ALERT_THRESHOLDS
): 'error_rate' | 'slow_rate' | null {
  if (bucket.count === 0) return null;
  if (bucket.errors / bucket.count >= thresholds.errorRate) return 'error_rate';
  if (bucket.slow / bucket.count >= thresholds.slowRate) return 'slow_rate';
  return null;
}

// ─── 中间件 ───
export function apmMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  metrics.totalRequests++;
  metrics.activeRequests++;

  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round((elapsedNs / 1_000_000_000) * 1000) / 1000; // 保留 1 位小数
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

    // 慢请求记录
    if (durationMs > SLOW_THRESHOLD_MS) {
      bucket.slow++;
      const slow: SlowLog = {
        timestamp: Date.now(),
        method: req.method,
        path: req.path,
        durationMs,
        ip: (req.ip || (req.headers['x-forwarded-for'] as string) || 'unknown').split(',')[0].trim(),
        requestId: (req as Request & { requestId?: string }).requestId,
      };
      metrics.slowLogs.unshift(slow);
      if (metrics.slowLogs.length > MAX_SLOW_LOGS) metrics.slowLogs.pop();
      logger.warn('apm', `慢请求: ${req.method} ${req.path} ${durationMs}ms`);
    }

    // 告警判定（带冷却：同一路由 60s 内只告警一次）
    const reason = evaluateAlert(bucket);
    if (reason) {
      const now = Date.now();
      const last = lastAlertAt.get(prefix) || 0;
      if (now - last > ALERT_COOLDOWN_MS) {
        lastAlertAt.set(prefix, now);
        logger.warn(
          'apm',
          `告警[${reason}] 路由 ${prefix} 指标超阈值 (count=${bucket.count}, errors=${bucket.errors}, slow=${bucket.slow})`
        );
      }
    }
  });

  next();
}


// ─── 分位数计算 ──
export function computePercentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil(sorted.length * p / 100) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

export function computeRoutePercentiles(bucket: MetricsBucket): { p50: number; p95: number; p99: number; mean: number } {
  return {
    mean: bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0,
    p50: 0,
    p95: 0,
    p99: 0,
  };
}

// ─── 快照聚合（供 /health/vitals 与 /api/metrics 共用）───
export function collectApmMetrics(): ApmSnapshot {
  const uptimeSec = Math.round((Date.now() - metrics.startedAt) / 1000);
  const mem = process.memoryUsage();

  const routeMetrics: Record<string, RouteMetric> = {};
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
      errorRate:
        metrics.totalRequests > 0 ? Math.round((metrics.totalErrors / metrics.totalRequests) * 10000) / 100 : 0,
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
export function vitalsHandler(_req: Request, res: Response): void {
  const snapshot = collectApmMetrics();
  res.json({
    status: 'ok',
    service: 'ai-agent-platform',
    timestamp: new Date().toISOString(),
    ...snapshot,
  });
}

/** 重置指标（用于测试） */
export function resetApmMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.routes.clear();
  metrics.slowLogs = [];
  lastAlertAt.clear();
}

// ─── APM 持久化绑定（在 index.ts 中调用 startApmPersistence()）
let persistenceStarted = false;
export async function startApmPersistence(): Promise<void> {
  if (persistenceStarted) return;
  try {
    const { startPersistence } = await import('./apm-persistence');
    startPersistence(() => collectApmMetrics());
    persistenceStarted = true;
  } catch (err: any) {
    logger.warn('apm', '持久化模块加载失败（可能缺少模块），跳过: ' + (err?.message || ''));
  }
}


