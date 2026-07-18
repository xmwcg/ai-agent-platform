/**
 * 邮箱验证路由
 *
 * POST /api/auth/verify-email/send    - 发送验证邮件
 * POST /api/auth/verify-email/confirm - 确认验证码
 * GET  /api/auth/verify-email/status  - 查询验证状态
 */
import { Router, Response } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { authLimiter } from "../middleware/rate-limit";
import { User } from "../models/User";
import { SecurityAuditLog } from "../models/SecurityAuditLog";
import { redisClient } from "../config/database";
import { sendError } from "../lib/http-error";
import { logger } from "../lib/logger";
import crypto from "crypto";

const router = Router();

const VERIFY_EXPIRE = 10 * 60; // 10 分钟

function generateVerifyCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function setVerifyCode(email: string, code: string): Promise<void> {
  const key = "verify:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.setEx) {
    await redisClient.setEx(key, VERIFY_EXPIRE, code);
  } else {
    (global as any).__emailCodes = (global as any).__emailCodes || new Map();
    (global as any).__emailCodes.set(key, { code, exp: Date.now() + VERIFY_EXPIRE * 1000 });
  }
}

async function getVerifyCode(email: string): Promise<string | null> {
  const key = "verify:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.get) {
    return await redisClient.get(key);
  }
  const entry = ((global as any).__emailCodes || new Map()).get(key);
  if (entry && entry.exp > Date.now()) return entry.code;
  return null;
}

async function deleteVerifyCode(email: string): Promise<void> {
  const key = "verify:email:" + email.toLowerCase().trim();
  if (redisClient && redisClient.del) {
    await redisClient.del(key);
  }
  ((global as any).__emailCodes || new Map()).delete(key);
}

// 发送验证邮件
router.post("/verify-email/send", requireAuth, authLimiter, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "用户不存在" });
    if (user.emailVerified) return res.status(400).json({ error: "邮箱已验证", code: "ALREADY_VERIFIED" });

    const code = generateVerifyCode();
    await setVerifyCode(user.email, code);

    // 控制台输出验证码（生产环境应通过邮件服务发送）
    logger.info("auth", "verify-email code: " + code + " for " + user.email);

    SecurityAuditLog.create({
      userId: user._id,
      action: "email_verify",
      outcome: "success",
      details: { step: "code_sent" },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({
      success: true,
      message: "验证码已发送至您的邮箱（开发环境请查看服务器日志）",
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 确认验证码
router.post("/verify-email/confirm", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body;
    if (!code || String(code).length !== 6) {
      return res.status(400).json({ error: "请输入6位验证码" });
    }

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: "用户不存在" });
    if (user.emailVerified) return res.status(400).json({ error: "邮箱已验证" });

    const stored = await getVerifyCode(user.email);
    if (!stored || stored !== String(code)) {
      SecurityAuditLog.create({
        userId: user._id,
        action: "email_verify",
        outcome: "failure",
        failureReason: "invalid_code",
        ipAddress: req.ip,
      }).catch(() => {});
      return res.status(400).json({ error: "验证码无效或已过期" });
    }

    user.emailVerified = true;
    user.emailVerifiedAt = new Date();
    await user.save();
    await deleteVerifyCode(user.email);

    SecurityAuditLog.create({
      userId: user._id,
      action: "email_verify",
      outcome: "success",
      details: { step: "confirmed" },
      ipAddress: req.ip,
    }).catch(() => {});

    res.json({ success: true, message: "邮箱验证成功" });
  } catch (err) {
    sendError(res, err);
  }
});

// 查询验证状态
router.get("/verify-email/status", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select("emailVerified emailVerifiedAt").lean();
    if (!user) return res.status(404).json({ error: "用户不存在" });
    res.json({
      success: true,
      data: {
        verified: !!(user as any).emailVerified,
        verifiedAt: (user as any).emailVerifiedAt || null,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
