import rateLimit from 'express-rate-limit';
import { Request } from 'express';

/**
 * 限流中间件（L5+）
 *
 * - apiLimiter：全局 /api 限流（面向所有用户）。
 * - authLimiter：登录/注册等敏感端点的严格限流，防暴力破解 / 撞库。
 * - aiLimiter：AI 对话/生成端点限流（按用户 ID 区分付费/免费用户，防滥用）。
 * - text2imgLimiter：文生图专属频率闸门。
 *
 * test 环境统一 skip，避免集成测试因高频请求被误拦。
 */

const isTest = () => process.env.NODE_ENV === 'test';

// Key generator：优先用用户 ID，退回到 IP（与 Nginx X-Forwarded-For 配合）
const userIdOrIpKey = (req: Request): string => {
  const userId = (req as any).user?.id;
  if (userId) return `uid:${userId}`;
  return req.ip || req.socket.remoteAddress || 'unknown';
};

// 全局 API 限流：15 分钟窗口，每 IP 100 次
export const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
  skip: isTest,
});

// 认证端点严格限流：15 分钟窗口，每 IP 最多 10 次尝试（防暴力破解）
export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  keyGenerator: (req) => req.ip || req.socket.remoteAddress || 'unknown',
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请 15 分钟后再试', code: 'AUTH_RATE_LIMITED' },
  skip: isTest,
});

// AI 对话/生成端点限流：按用户 ID（免费 20/分钟，付费 60/分钟）
export function aiLimiter() {
  return rateLimit({
    windowMs: Number(process.env.AI_RATE_WINDOW_MS) || 60 * 1000,
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
    message: { success: false, error: 'AI 请求过于频繁，请稍后再试', code: 'AI_RATE_LIMITED' },
    skip: isTest,
    skipFailedRequests: true, // 不消耗认证失败用户的配额
  });
}

// 文生图生成专属限流：频率闸门，与「匿名每日限次」「登录配额/成本阀门」三层互补。
export const text2imgLimiter = rateLimit({
  windowMs: Number(process.env.TEXT2IMG_RATE_WINDOW_MS) || 60 * 1000,
  max: Number(process.env.TEXT2IMG_RATE_MAX) || 10,
  keyGenerator: userIdOrIpKey,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '生成请求过于频繁，请稍后再试', code: 'TEXT2IMG_RATE_LIMITED' },
  skip: isTest,
});
