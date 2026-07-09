import rateLimit from 'express-rate-limit';

/**
 * 限流中间件（L5）
 *
 * - apiLimiter：全局 /api 限流（迁移自 index.ts 内联配置）。
 * - authLimiter：登录/注册等敏感端点的严格限流，防暴力破解 / 撞库。
 *
 * test 环境统一 skip，避免集成测试因高频请求被误拦。
 */

const isTest = () => process.env.NODE_ENV === 'test';

// 全局 API 限流：15 分钟窗口，每 IP 100 次
export const apiLimiter = rateLimit({
  windowMs: Number(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '请求过于频繁，请稍后再试', code: 'RATE_LIMITED' },
  skip: isTest,
});

// 认证端点严格限流：15 分钟窗口，每 IP 最多 10 次尝试（防暴力破解）
export const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: '登录尝试过于频繁，请 15 分钟后再试', code: 'AUTH_RATE_LIMITED' },
  skip: isTest,
});
