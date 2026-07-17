import rateLimit from 'express-rate-limit';
import { NextFunction, Request, Response } from 'express';
import { realRedis, isUsingMemoryRedis } from '../config/database';

/**
 * 限流中间件（L5+）
 *
 * - apiLimiter：全局 /api 限流（面向所有用户）。
 * - authLimiter：登录/注册等敏感端点的严格限流，防暴力破解 / 撞库。
 * - aiLimiter：AI 对话/生成端点限流（按用户 ID 区分付费/免费用户，防滥用）。
 * - text2imgLimiter：文生图专属频率闸门。
 *
 * 存储后端：优先 Redis（多实例部署时共享计数，避免单实例内存各自为政），
 * 当 Redis 不可用（断连/半开）时自动降级为进程内存，保证限流中间件永不
 * 因底层存储异常而把请求变成 500 或全站 429。Redis 恢复后探测自动切回。
 *
 * test 环境统一 skip，避免集成测试因高频请求被误拦。
 */

const isTest = () => process.env.NODE_ENV === 'test';

// ─────────────────────────────────────────────────────────────
// Redis 健康检查 + 降级存储
// ─────────────────────────────────────────────────────────────

// 模块级健康标志：Redis 探针定期刷新；store 在 !healthy 时直接走内存，
// 避免在 Redis 半开（status=ready 但命令超时）场景下每次请求都卡到超时。
let redisHealthy = false;
let probeStarted = false;

function pingWithTimeout(ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(false), ms);
    (realRedis.ping() as Promise<string>).then(
      (r) => {
        clearTimeout(timer);
        resolve(r === 'PONG');
      },
      () => {
        clearTimeout(timer);
        resolve(false);
      }
    );
  });
}

function probeRedis() {
  // 明确使用内存替身（开发/测试无 Redis）时，直接标记不可用，不再探测
  if (isUsingMemoryRedis()) {
    redisHealthy = false;
    return;
  }
  pingWithTimeout(1500)
    .then((ok) => {
      redisHealthy = ok;
    })
    .catch(() => {
      redisHealthy = false;
    });
}

function startProbe() {
  if (probeStarted || isTest()) return;
  probeStarted = true;
  // 延迟首探，避开启动期 Redis 尚未就绪
  setTimeout(probeRedis, 1000);
  setInterval(probeRedis, 15000);
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('redis command timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

/**
 * 限流存储：Redis 优先 + 内存降级。
 * 实现 express-rate-limit v7 的 Store 接口（increment/decrement/resetKey/init）。
 */
class RedisRateLimitStore {
  private windowMs: number;
  private prefix: string;
  private mem = new Map<string, { count: number; reset: number }>();

  constructor(windowMs: number, prefix: string) {
    this.windowMs = windowMs;
    this.prefix = prefix;
  }

  init(options: any) {
    if (options && options.windowMs) this.windowMs = options.windowMs;
  }

  async increment(key: string): Promise<{ totalHits: number; resetTime: Date | undefined }> {
    const full = `${this.prefix}:${key}`;
    // 降级路径：Redis 不健康时直接走内存，绝不触碰 Redis（避免挂起/超时放大）
    if (!redisHealthy) return this.memInc(key);
    try {
      const count = await withTimeout(realRedis.incr(full) as Promise<number>, 1500);
      if (count === 1) {
        // 仅首次写入时设置过期，避免每次命中重置 TTL
        (realRedis.pexpire(full, Math.ceil(this.windowMs / 1000)) as Promise<number>).catch(
          () => undefined
        );
      }
      return { totalHits: count, resetTime: new Date(Date.now() + this.windowMs) };
    } catch {
      // Redis 命令异常：标记不健康并降级内存，后续请求不再重复打 Redis
      redisHealthy = false;
      return this.memInc(key);
    }
  }

  private memInc(key: string): { totalHits: number; resetTime: Date | undefined } {
    const now = Date.now();
    const hit = this.mem.get(key);
    if (!hit || hit.reset <= now) {
      const reset = now + this.windowMs;
      this.mem.set(key, { count: 1, reset });
      return { totalHits: 1, resetTime: new Date(reset) };
    }
    hit.count += 1;
    return { totalHits: hit.count, resetTime: new Date(hit.reset) };
  }

  decrement(key: string): void {
    if (!redisHealthy) return;
    (realRedis.decr(`${this.prefix}:${key}`) as Promise<number>).catch(() => undefined);
  }

  resetKey(key: string): void {
    if (!redisHealthy) return;
    (realRedis.del(`${this.prefix}:${key}`) as Promise<number>).catch(() => undefined);
  }
}

function makeStore(windowMs: number, prefix: string): any {
  startProbe();
  return new RedisRateLimitStore(windowMs, prefix);
}

// Key generator：优先用用户 ID，退回到 IP（与 Nginx X-Forwarded-For 配合）
const userIdOrIpKey = (req: Request): string => {
  const userId = (req as any).user?.id;
  if (userId) return `uid:${userId}`;
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// 全局 API 限流：15 分钟窗口，每 IP 100 次
const apiWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
export const apiLimiter = rateLimit({
  windowMs: apiWindowMs,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(apiWindowMs, 'rl:api'),
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
  skip: isTest,
});

// 认证端点严格限流：15 分钟窗口，每 IP 最多 10 次尝试（防暴力破解）
const authWindowMs = Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
export const authLimiter = rateLimit({
  windowMs: authWindowMs,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(authWindowMs, 'rl:auth'),
  message: { success: false, error: '登录尝试过于频繁，请 15 分钟后再试', code: 'AUTH_RATE_LIMITED' },
  skip: isTest,
});

// AI 对话/生成端点限流：按用户 ID（免费 20/分钟，付费 60/分钟）
const aiWindowMs = Number(process.env.AI_RATE_WINDOW_MS) || 60 * 1000;
export function aiLimiter() {
  return rateLimit({
    windowMs: aiWindowMs,
    max: (req) => {
      // 付费用户更高限额
      const plan = (req as any).user?.plan;
      const isPaid = plan === 'pro' || plan === 'max';
      return isPaid
        ? Number(process.env.AI_RATE_MAX_PAID) || 60
        : Number(process.env.AI_RATE_MAX_FREE) || 20;
    },
    keyGenerator: userIdOrIpKey,
    standardHeaders: true,
    legacyHeaders: false,
    store: makeStore(aiWindowMs, 'rl:ai'),
    message: { success: false, error: 'AI 请求过于频繁，请稍后再试', code: 'AI_RATE_LIMITED' },
    skip: isTest,
    skipFailedRequests: true, // 不消耗认证失败用户的配额
  });
}

// 文生图生成专属限流：频率闸门，与「匿名每日限次」「登录配额/成本阀门」三层互补。
const imgWindowMs = Number(process.env.TEXT2IMG_RATE_WINDOW_MS) || 60 * 1000;
export const text2imgLimiter = rateLimit({
  windowMs: imgWindowMs,
  max: Number(process.env.TEXT2IMG_RATE_MAX) || 10,
  keyGenerator: userIdOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  store: makeStore(imgWindowMs, 'rl:img'),
  message: { success: false, error: '生成请求过于频繁，请稍后再试', code: 'TEXT2IMG_RATE_LIMITED' },
  skip: isTest,
});


// ─────────────────────────────────────────────────────────────
// 敏感厂商模型查询限流：生产环境严格依赖 Redis，绝不降级内存。
// 每用户 5 次/分钟、30 次/日；API Key 不参与 key，也不会写入 Redis。
// ─────────────────────────────────────────────────────────────
const sensitiveMemoryCounters = new Map<string, { count: number; expiresAt: number }>();

async function ensureSensitiveRedisReady(): Promise<boolean> {
  if (isUsingMemoryRedis()) return false;
  if (redisHealthy) return true;
  const ok = await pingWithTimeout(1000);
  redisHealthy = ok;
  return ok;
}

function memoryCounterIncrement(key: string, ttlSeconds: number): number {
  const now = Date.now();
  const current = sensitiveMemoryCounters.get(key);
  if (!current || current.expiresAt <= now) {
    sensitiveMemoryCounters.set(key, { count: 1, expiresAt: now + ttlSeconds * 1000 });
    return 1;
  }
  current.count += 1;
  return current.count;
}

async function redisCounterIncrement(key: string, ttlSeconds: number): Promise<number> {
  const count = await withTimeout(realRedis.incr(key) as Promise<number>, 1200);
  if (count === 1) {
    await withTimeout(realRedis.expire(key, ttlSeconds) as Promise<number>, 1200);
  }
  return count;
}

export async function modelFetchLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (isTest()) {
    next();
    return;
  }

  const identity = userIdOrIpKey(req).replace(/[^a-zA-Z0-9:_-]/g, '_').slice(0, 160);
  const minuteBucket = Math.floor(Date.now() / 60000);
  const dayBucket = new Date().toISOString().slice(0, 10);
  const minuteKey = `rl:model-fetch:min:${identity}:${minuteBucket}`;
  const dayKey = `rl:model-fetch:day:${identity}:${dayBucket}`;
  const production = process.env.NODE_ENV === 'production';

  try {
    const redisReady = await ensureSensitiveRedisReady();
    if (production && !redisReady) {
      res.status(503).json({
        success: false,
        error: '限流服务暂不可用，请稍后重试',
        code: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
      });
      return;
    }

    const [minuteCount, dayCount] = redisReady
      ? await Promise.all([
        redisCounterIncrement(minuteKey, 120),
        redisCounterIncrement(dayKey, 2 * 86400),
      ])
      : [memoryCounterIncrement(minuteKey, 120), memoryCounterIncrement(dayKey, 2 * 86400)];

    if (minuteCount > 5 || dayCount > 30) {
      res.status(429).json({
        success: false,
        error: minuteCount > 5 ? '模型列表查询过于频繁，请一分钟后再试' : '今日模型列表查询次数已达上限',
        code: 'MODEL_FETCH_RATE_LIMITED',
      });
      return;
    }
    next();
  } catch {
    redisHealthy = false;
    if (production) {
      res.status(503).json({
        success: false,
        error: '限流服务暂不可用，请稍后重试',
        code: 'RATE_LIMIT_STORAGE_UNAVAILABLE',
      });
      return;
    }
    next();
  }
}
