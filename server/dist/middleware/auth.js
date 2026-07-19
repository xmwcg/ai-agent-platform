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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.REFRESH_TOKEN_EXPIRY_MS = exports.ACCESS_TOKEN_EXPIRY = void 0;
exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.hashRefreshToken = hashRefreshToken;
exports.generateDeviceFingerprint = generateDeviceFingerprint;
exports.verifyToken = verifyToken;
exports.verifyRefreshToken = verifyRefreshToken;
exports.requireAuth = requireAuth;
exports.optionalAuth = optionalAuth;
exports.requireAdmin = requireAdmin;
exports.setRefreshTokenCookie = setRefreshTokenCookie;
exports.clearRefreshTokenCookie = clearRefreshTokenCookie;
exports.extractRefreshToken = extractRefreshToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importStar(require("crypto"));
// 若未设置 JWT_SECRET，则在非生产环境自动生成强随机密钥（64 字节 hex），
// 避免用弱占位值上线导致任何人可伪造 Token。
// ⚠️ 这意味每次重启服务密钥不同 → 所有旧 Token 立即失效，需重新登录。
// 生产环境仍要求明确设置 JWT_SECRET（env-check.ts 会拒绝启动）。
function resolveJwtSecret() {
    const fromEnv = process.env.JWT_SECRET;
    if (fromEnv && fromEnv !== "dev-secret-key-change-in-production" && fromEnv !== "changeme" && fromEnv !== "secret") {
        return fromEnv;
    }
    if (process.env.NODE_ENV === "production") {
        const fallback = crypto_1.default.randomBytes(32).toString("hex");
        console.error("🔴 JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）。请立即在 .env 设置 JWT_SECRET！");
        return fallback;
    }
    const autoKey = crypto_1.default.randomBytes(32).toString("hex");
    console.warn(`⚠️  JWT_SECRET 未设置，已自动生成临时密钥（重启后旧 Token 失效）：${autoKey.slice(0, 8)}...`);
    console.warn("   开发环境可设置 JWT_SECRET=dev-auto 固定本地密钥便于调试。");
    return autoKey;
}
function resolveRefreshSecret() {
    const fromEnv = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (fromEnv && fromEnv !== "dev-secret-key-change-in-production" && fromEnv !== "changeme" && fromEnv !== "secret") {
        return fromEnv + "_refresh";
    }
    const autoKey = crypto_1.default.randomBytes(32).toString("hex");
    return autoKey + "_refresh";
}
const JWT_SECRET = resolveJwtSecret();
const JWT_REFRESH_SECRET = resolveRefreshSecret();
// Token 有效期配置
const ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || "15m";
exports.ACCESS_TOKEN_EXPIRY = ACCESS_TOKEN_EXPIRY;
const REFRESH_TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
exports.REFRESH_TOKEN_EXPIRY_MS = REFRESH_TOKEN_EXPIRY_MS;
// 生成 JWT 访问令牌（15分钟）
function generateAccessToken(payload) {
    const jti = payload.jti || crypto_1.default.randomBytes(16).toString("hex");
    return jsonwebtoken_1.default.sign({ id: payload.id, email: payload.email, role: payload.role, jti, sessionId: payload.sessionId, type: "access" }, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRY });
}
// 生成刷新令牌（7天）
function generateRefreshToken() {
    return crypto_1.default.randomBytes(48).toString("base64url");
}
// 哈希刷新令牌用于安全存储
function hashRefreshToken(token) {
    return (0, crypto_1.createHash)("sha256").update(token).digest("hex");
}
// 生成客户端设备指纹
function generateDeviceFingerprint(req) {
    const ua = req.headers["user-agent"] || "";
    const ip = req.ip || req.socket.remoteAddress || "";
    return (0, crypto_1.createHash)("sha256").update(`${ua}|${ip}|${Date.now()}`).digest("hex").slice(0, 32);
}
// 验证 JWT 访问令牌
function verifyToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_SECRET);
    }
    catch {
        return null;
    }
}
// 验证刷新令牌
function verifyRefreshToken(token) {
    try {
        return jsonwebtoken_1.default.verify(token, JWT_REFRESH_SECRET);
    }
    catch {
        return null;
    }
}
// 认证中间件（必需登录）— 支持不同密钥版本（每季度轮换时兼容旧密钥）
const FALLBACK_JWT_SECRETS = process.env.JWT_FALLBACK_SECRETS
    ? process.env.JWT_FALLBACK_SECRETS.split(",").map((s) => s.trim()).filter(Boolean)
    : [];
function verifyWithFallback(token) {
    // 先尝试验证主密钥
    let result = verifyToken(token);
    if (result)
        return result;
    // 尝试回退密钥
    for (const secret of FALLBACK_JWT_SECRETS) {
        try {
            const decoded = jsonwebtoken_1.default.verify(token, secret);
            return decoded;
        }
        catch { /* continue */ }
    }
    return null;
}
var _AuthSession = null;
function getAuthSession() { if (!_AuthSession) {
    try {
        _AuthSession = require("../models/AuthSession").AuthSession;
    }
    catch (e) {
        return null;
    }
} return _AuthSession; }
async function isSessionActive(jti) {
    if (!jti)
        return true;
    var Model = getAuthSession();
    if (!Model)
        return true;
    try {
        return !!(await Model.findOne({ accessTokenJti: jti, status: "active" }).lean());
    }
    catch (e) {
        return true;
    }
}
// 认证中间件（必需登录）
async function requireAuth(req, res, next) {
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
function optionalAuth(req, _res, next) {
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
function requireAdmin(req, res, next) {
    if (!req.user || req.user.role !== "admin") {
        res.status(403).json({ error: "需要管理员权限" });
        return;
    }
    next();
}
// 设置刷新令牌 Cookie
function setRefreshTokenCookie(res, token) {
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
function clearRefreshTokenCookie(res) {
    res.clearCookie("refresh_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "strict" : "lax",
        path: "/api/auth",
    });
}
// 从请求中提取刷新令牌（Cookie 优先，兼容 Header）
function extractRefreshToken(req) {
    if (req.cookies?.refresh_token)
        return req.cookies.refresh_token;
    const header = req.headers["x-refresh-token"];
    if (typeof header === "string" && header)
        return header;
    return null;
}
//# sourceMappingURL=auth.js.map