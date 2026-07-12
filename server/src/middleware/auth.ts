import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// 若未设置 JWT_SECRET，则在非生产环境自动生成强随机密钥（64 字节 hex），
// 避免用弱占位值上线导致任何人可伪造 Token。
// ⚠️ 这意味每次重启服务密钥不同 → 所有旧 Token 立即失效，需重新登录。
// 生产环境仍要求明确设置 JWT_SECRET（env-check.ts 会拒绝启动）。
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv !== 'dev-secret-key-change-in-production' && fromEnv !== 'changeme' && fromEnv !== 'secret') {
    return fromEnv;
  }
  if (process.env.NODE_ENV === 'production') {
    // 生产环境不应走到这里（env-check 会先拦截），保底用随机密钥
    const fallback = crypto.randomBytes(32).toString('hex');
    console.error('🔴 JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）。请立即在 .env 设置 JWT_SECRET！');
    return fallback;
  }
  const autoKey = crypto.randomBytes(32).toString('hex');
  console.warn(`⚠️  JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）：${autoKey.slice(0, 8)}...`);
  console.warn('   开发环境可设置 JWT_SECRET=dev-auto 固定本地密钥便于调试。');
  return autoKey;
}

const JWT_SECRET = resolveJwtSecret();

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

// 生成 JWT Token
export function generateToken(payload: { id: string; email: string; role: string }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

// 验证 JWT Token
export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

// 认证中间件（必需登录）
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: '未授权，缺少 Token' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'Token 无效或已过期' });
    return;
  }

  req.user = decoded;
  next();
}

// 可选认证中间件（优先从 Token 获取用户，没有也不阻止）
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}