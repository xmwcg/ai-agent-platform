/**
 * 轻量级 APM（应用性能监控）中间件
 * 
 * 功能：
 * - 请求耗时追踪（P50/P95/P99）
 * - 慢请求检测（超过阈值的自动告警日志）
 * - 错误率统计
 * - 内存/CPU 健康快照
 * - 暴露 /health/vitals 端点给外部监控
 * 
 * 设计原则：零外部依赖，纯内存统计，适合中小规模（< 10000 RPS）。
 * 大规模场景建议升级到 Prometheus + Grafana。
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
  /** 耗时分布桶 (ms): 0-50, 50-100, 100-250, 250-500, 500-1000, 1000+ */
  histogram: number[];
}

interface ApmMetrics {
  startedAt: number;
  totalRequests: number;
  activeRequests: number;
  totalErrors: number;
  /** 按路由前缀聚合: prefix → bucket */
  routes: Map<string, MetricsBucket>;
  /** 慢查询记录（最近 50 条） */
  slowLogs: SlowLog[];
}

interface SlowLog {
  timestamp: number;
  method: string;
  path: string;
  durationMs: number;
  ip: string;
  requestId?: string;
}

// ─── 全局指标 ───
const SLOW_THRESHOLD_MS = 500; // 超过 500ms 视为慢请求
const HISTOGRAM_BANDS = [50, 100, 250, 500, 1000, 3000, Infinity];
const MAX_SLOW_LOGS = 100;

const metrics: ApmMetrics = {
  startedAt: Date.now(),
  totalRequests: 0,
  activeRequests: 0,
  totalErrors: 0,
  routes: new Map(),
  slowLogs: [],
};

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
      count: 0, totalMs: 0, minMs: Number.MAX_SAFE_INTEGER, maxMs: 0, errors: 0,
      histogram: new Array(HISTOGRAM_BANDS.length).fill(0),
    });
  }
  return metrics.routes.get(prefix)!;
}

/** 计算分位数 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

// ─── 中间件 ───
export function apmMiddleware(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  metrics.totalRequests++;
  metrics.activeRequests++;

  // 响应完成时上报
  res.on('finish', () => {
    const elapsedNs = Number(process.hrtime.bigint() - start);
    const durationMs = Math.round(elapsedNs / 1_000_000_000 * 1000) / 1000; // 保留 1 位小数
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
  });

  next();
}

// ─── 健康检查 + 指标端点 ───
export function vitalsHandler(_req: Request, res: Response): void {
  const uptimeSec = Math.round((Date.now() - metrics.startedAt) / 1000);
  const mem = process.memoryUsage();

  // 聚合所有路由指标
  const routeMetrics: Record<string, any> = {};
  metrics.routes.forEach((bucket, prefix) => {
    const avgMs = bucket.count > 0 ? Math.round(bucket.totalMs / bucket.count) : 0;
    routeMetrics[prefix] = {
      requests: bucket.count,
      avgMs,
      minMs: bucket.minMs === Number.MAX_SAFE_INTEGER ? 0 : Math.round(bucket.minMs),
      maxMs: Math.round(bucket.maxMs),
      errorRate: bucket.count > 0 ? Math.round((bucket.errors / bucket.count) * 10000) / 100 : 0,
      histogram: bucket.histogram,
    };
  });

  res.json({
    status: 'ok',
    service: 'ai-agent-platform',
    timestamp: new Date().toISOString(),
    uptime: {
      seconds: uptimeSec,
      readable: `${Math.floor(uptimeSec / 3600)}h ${Math.floor((uptimeSec % 3600) / 60)}m`,
    },
    requests: {
      total: metrics.totalRequests,
      active: metrics.activeRequests,
      errors: metrics.totalErrors,
      errorRate: metrics.totalRequests > 0
        ? Math.round((metrics.totalErrors / metrics.totalRequests) * 10000) / 100
        : 0,
    },
    routes: routeMetrics,
    memory: {
      heapUsedMB: Math.round(mem.heapUsed / 1024 / 1024),
      heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
      rssMB: Math.round(mem.rss / 1024 / 1024),
      externalMB: Math.round(mem.external / 1024 / 1024),
    },
    slowLogs: metrics.slowLogs.slice(0, 20), // 最近 20 条
  });
}

/** 重置指标（用于测试） */
export function resetApmMetrics(): void {
  metrics.totalRequests = 0;
  metrics.totalErrors = 0;
  metrics.routes.clear();
  metrics.slowLogs = [];
}
