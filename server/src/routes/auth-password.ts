/**
 * 密码重置路由
 *
 * POST /api/auth/forgot-password    - 发送重置验证码到邮箱
 * POST /api/auth/reset-password     - 使用验证码重置密码
 * PUT  /api/auth/change-password    - 登录后修改密码（强制撤销所有会话）
 */
import { Router, Response } from "express";
import { AuthRequest, requireAuth, clearRefreshTokenCookie } from "../middleware/auth";
import { authLimiter } from "../middleware/rate-limit";
import { User } from "../models/User";
import { AuthSession } from "../models/AuthSession";
import { SecurityAuditLog } from "../models/SecurityAuditLog";
import { redisClient } from "../config/database";
import { sendError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { validate, ValidationSchema } from "../lib/validation";
import crypto from "crypto";

const router = Router();

const RESET_EXPIRE = 15 * 60; // 15 分钟

function generateResetCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function setResetCode(email: string, code: string): Promise<void> {
  const key = "reset:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.setEx) {
    await redisClient.setEx(key, RESET_EXPIRE, code);
  } else {
    (global as any).__resetCodes = (global as any).__resetCodes || new Map();
    (global as any).__resetCodes.set(key, { code, exp: Date.now() + RESET_EXPIRE * 1000 });
  }
}

async function getResetCode(email: string): Promise<string | null> {
  const key = "reset:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.get) {
    return await redisClient.get(key);
  }
  const entry = ((global as any).__resetCodes || new Map()).get(key);
  if (entry && entry.exp > Date.now()) return entry.code;
  return null;
}

async function deleteResetCode(email: string): Promise<void> {
  const key = "reset:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.del) {
    await redisClient.del(key);
  }
  ((global as any).__resetCodes || new Map()).delete(key);
}

// 忘记密码 → 发送重置验证码
router.post("/forgot-password", authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: "请输入邮箱地址" });

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      // 不泄露用户是否存在
      return res.json({ success: true, message: "如果该邮箱已注册，您将收到重置验证码" });
    }

    const code = generateResetCode();
    await setResetCode(user.email, code);

    logger.info("auth", "reset-password code: " + code + " for " + user.email);

    SecurityAuditLog.create({
      userId: user._id,
      action: "password_reset",
      outcome: "success",
      details: { step: "code_sent" },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, message: "如果该邮箱已注册，您将收到重置验证码" });
  } catch (err) {
    sendError(res, err);
  }
});

// 重置密码
router.post("/reset-password", authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "请提供邮箱、验证码和新密码" });
    }
    if (newPassword.length < 10) {
      return res.status(400).json({ error: "密码长度至少10位" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) return res.status(404).json({ error: "用户不存在" });

    const stored = await getResetCode(user.email);
    if (!stored || stored !== String(code)) {
      SecurityAuditLog.create({
        userId: user._id,
        action: "password_reset",
        outcome: "failure",
        failureReason: "invalid_code",
        ipAddress: req.ip,
        severity: "medium",
      }).catch(() => {});
      return res.status(400).json({ error: "验证码无效或已过期" });
    }

    user.password = newPassword;
    await user.save();
    await deleteResetCode(user.email);

    // 强制撤销所有会话
    await AuthSession.updateMany(
      { userId: user._id, status: "active" },
      { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" }
    );

    SecurityAuditLog.create({
      userId: user._id,
      action: "password_reset",
      outcome: "success",
      details: { step: "completed" },
      severity: "high",
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, message: "密码已重置，所有设备已登出，请重新登录" });
  } catch (err) {
    sendError(res, err);
  }
});

// 修改密码（登录后）— 强制撤销所有会话
const changePasswordSchema: ValidationSchema = {
  currentPassword: { required: true, type: "string", minLength: 1 },
  newPassword: { required: true, type: "string", minLength: 10, maxLength: 64 },
};

router.put("/change-password", requireAuth, validate(changePasswordSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user!.id).select("+password");
    if (!user) return res.status(404).json({ error: "用户不存在" });

    const valid = await user.comparePassword(currentPassword);
    if (!valid) {
      SecurityAuditLog.create({
        userId: user._id,
        action: "password_change",
        outcome: "failure",
        failureReason: "wrong_current_password",
        severity: "medium",
        ipAddress: req.ip,
      }).catch(() => {});
      return res.status(403).json({ error: "当前密码错误" });
    }

    user.password = newPassword;
    await user.save();

    // 强制撤销所有其他会话（保留当前会话如果sessionId匹配）
    const currentSessionId = req.user?.sessionId;
    if (currentSessionId) {
      await AuthSession.updateMany(
        { userId: user._id, status: "active", _id: { $ne: currentSessionId } },
        { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" }
      );
    } else {
      await AuthSession.updateMany(
        { userId: user._id, status: "active" },
        { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" }
      );
    }

    SecurityAuditLog.create({
      userId: user._id,
      action: "password_change",
      outcome: "success",
      severity: "medium",
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, message: "密码已修改，其他设备已自动登出" });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
