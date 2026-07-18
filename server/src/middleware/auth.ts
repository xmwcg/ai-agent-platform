import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import crypto, { createHash } from "crypto";

// 若未设置 JWT_SECRET，则在非生产环境自动生成强随机密钥（64 字节 hex），
// 避免用弱占位值上线导致任何人可伪造 Token。
// ⚠️ 这意味每次重启服务密钥不同 → 所有旧 Token 立即失效，需重新登录。
// 生产环境仍要求明确设置 JWT_SECRET（env-check.ts 会拒绝启动）。
function resolveJwtSecret(): string {
  const fromEnv = process.env.JWT_SECRET;
  if (fromEnv && fromEnv !== "dev-secret-key-change-in-production" && fromEnv !== "changeme" && fromEnv !== "secret") {
    return fromEnv;
  }
  if (process.env.NODE_ENV === "production") {
    const fallback = crypto.randomBytes(32).toString("hex");
    console.error("🔴 JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）。请立即在 .env 设置 JWT_SECRET！");
    return fallback;
  }
  const autoKey = crypto.randomBytes(32).toString("hex");
  console.warn(`⚠️  JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）：${autoKey.slice(0, 8)}...`);
  console.warn("   开发环境可设置 JWT_SECRET=dev-auto 固定本地密钥便于调试。");
  return autoKey;
}

function resolveRefreshSecret(): string {
  const fromEnv = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (fromEnv && fromEnv !== "dev-secret-key-change-in-production" && fromEnv !== "changeme" && fromEnv !== "secret") {
    return fromEnv + "_refresh";
  }
  const autoKey = crypto.randomBytes(32).toString("hex");
  return autoKey + "_refresh";
}

const JWT_SECRET = resolveJwtSecret();
const JWT_REFRESH_SECRET = resolveRefreshSecret();

// Token 有效期配置
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 天

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
    jti?: string;
    sessionId?: string;
  };
}

// 生成 JWT 访问令牌（15分钟）
export function generateAccessToken(payload: { id: string; email: string; role: string; jti?: string; sessionId?: string }): string {
  const jti = payload.jti || crypto.randomBytes(16).toString("hex");
  return jwt.sign(
    { id: payload.id, email: payload.email, role: payload.role, jti, sessionId: payload.sessionId, type: "access" },
    JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY as any }
  );
}

// 生成刷新令牌（7天）
export function generateRefreshToken(): string {
  return crypto.randomBytes(48).toString("base64url");
}

// 哈希刷新令牌用于安全存储
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// 生成客户端设备指纹
export function generateDeviceFingerprint(req: Request): string {
  const ua = req.headers["user-agent"] || "";
  const ip = req.ip || req.socket.remoteAddress || "";
  return createHash("sha256").update(`${ua}|${ip}|${Date.now()}`).digest("hex").slice(0, 32);
}

// 验证 JWT 访问令牌
export function verifyToken(token: string): { id: string; email: string; role: string; jti?: string; sessionId?: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { id: string; email: string; role: string; jti?: string; sessionId?: string };
  } catch {
    return null;
  }
}

// 验证刷新令牌
export function verifyRefreshToken(token: string): { id: string; email: string; role: string } | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as { id: string; email: string; role: string };
  } catch {
    return null;
  }
}

// 认证中间件（必需登录）— 支持不同密钥版本（每季度轮换时兼容旧密钥）
const FALLBACK_JWT_SECRETS: string[] = process.env.JWT_FALLBACK_SECRETS
  ? process.env.JWT_FALLBACK_SECRETS.split(",").map((s) => s.trim()).filter(Boolean)
  : [];

function verifyWithFallback(token: string): { id: string; email: string; role: string; jti?: string; sessionId?: string } | null {
  // 先尝试验证主密钥
  let result = verifyToken(token);
  if (result) return result;

  // 尝试回退密钥
  for (const secret of FALLBACK_JWT_SECRETS) {
    try {
      const decoded = jwt.verify(token, secret) as { id: string; email: string; role: string; jti?: string };
      return decoded;
    } catch { /* continue */ }
  }
  return null;
}

var _AuthSession = null;
function getAuthSession() { if (!_AuthSession) { try { _AuthSession = require("../models/AuthSession").AuthSession; } catch (e) { return null; } } return _AuthSession; }

async function isSessionActive(jti) {
  if (!jti) return true;
  var Model = getAuthSession(); if (!Model) return true;
  try { return !!(await Model.findOne({ accessTokenJti: jti, status: "active" }).lean()); } catch (e) { return true; }
}

// 认证中间件（必需登录）
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "未授权，缺少 Token" });
    return;
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyWithFallback(token);
  if (!decoded) {
    res.status(401).json({ error: "Token 无效或已过期" });
    return;
  }

  if (decoded.jti && !(await isSessionActive(decoded.jti))) {
    res.status(401).json({ error: "会话已被撤销，请重新登录", code: "SESSION_REVOKED" });
    return;
  }

  req.user = decoded;
  next();
}

// 可选认证中间件（优先从 Token 获取用户，没有也不阻止）
export function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    const decoded = verifyWithFallback(token);
    if (decoded) {
      req.user = decoded;
    }
  }
  next();
}

// 管理员权限中间件（需在 requireAuth 之后）
export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "需要管理员权限" });
    return;
  }
  next();
}

// 设置刷新令牌 Cookie
export function setRefreshTokenCookie(res: Response, token: string): void {
  const isProduction = process.env.NODE_ENV === "production";
  res.cookie("refresh_token", token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "strict" : "lax",
    maxAge: REFRESH_TOKEN_EXPIRY_MS,
    path: "/api/auth",
  });
}

// 清除刷新令牌 Cookie
export function clearRefreshTokenCookie(res: Response): void {
  res.clearCookie("refresh_token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
    path: "/api/auth",
  });
}

// 从请求中提取刷新令牌（Cookie 优先，兼容 Header）
export function extractRefreshToken(req: Request): string | null {
  if (req.cookies?.refresh_token) return req.cookies.refresh_token;
  const header = req.headers["x-refresh-token"];
  if (typeof header === "string" && header) return header;
  return null;
}

// 导出 TOKEN_EXPIRY 供前端使用
export { ACCESS_TOKEN_EXPIRY, REFRESH_TOKEN_EXPIRY_MS };
