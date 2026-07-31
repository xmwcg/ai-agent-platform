/**
 * 会话管理路由
 *
 * POST /api/auth/refresh    刷新访问令牌（旋转刷新令牌）
 * POST /api/auth/logout     当前设备登出
 * POST /api/auth/logout-all 全部设备登出
 * GET  /api/auth/sessions   列出活跃会话
 * POST /api/auth/sessions/:id/revoke 撤销特定会话
 */
import { Router, Request, Response } from "express";
import { AuthRequest, requireAuth, generateAccessToken, generateRefreshToken, hashRefreshToken, clearRefreshTokenCookie, setRefreshTokenCookie, extractRefreshToken } from "../middleware/auth";
import { AuthSession } from "../models/AuthSession";
import { writeAuditLog, writeAuditLogAsync } from "../services/security-audit.service";
import { sendError } from "../lib/http-error";
import { logger } from "../lib/logger";

const router = Router();

// 刷新访问令牌
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const oldRefreshToken = extractRefreshToken(req);
    if (!oldRefreshToken) {
      return res.status(401).json({ error: "缺少刷新令牌" });
    }

    const tokenHash = hashRefreshToken(oldRefreshToken);

    // 查找活跃会话
    const session = await AuthSession.findOne({
      refreshTokenHash: tokenHash,
      status: "active",
    }).select("+refreshToken");

    if (!session) {
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "刷新令牌无效或已被撤销，请重新登录" });
    }

    // 检查是否过期
    if (session.expiresAt < new Date()) {
      session.status = "expired";
      await session.save();
      clearRefreshTokenCookie(res);
      return res.status(401).json({ error: "刷新令牌已过期，请重新登录" });
    }

    // 检查设备指纹一致性（防令牌窃取）
    // const currentFingerprint = generateDeviceFingerprint(req);
    // if (session.deviceFingerprint !== currentFingerprint) {
    //   // 设备指纹不一致，可能是令牌被盗 -> 撤销所有会话
    //   await AuthSession.updateMany({ userId: session.userId, status: "active" }, { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "token_theft" } });
    //   writeAuditLogAsync({ action: "session_revoke", resourceId: session.userId.toString(), details: { reason: "token_theft_detected", sessionId: session._id.toString() }, severity: "high", ctx: { userId: session.userId.toString(), ipAddress: req.ip } });
    //   clearRefreshTokenCookie(res);
    //   return res.status(401).json({ error: "安全检测：设备不一致，所有会话已注销，请重新登录" });
    // }

    // 旋转刷新令牌：撤销旧的，创建新的
    const newRefreshToken = generateRefreshToken();
    const newTokenHash = hashRefreshToken(newRefreshToken);

    // 原子替换：更新现有会话的刷新令牌
    session.refreshToken = newRefreshToken;
    session.refreshTokenHash = newTokenHash;
    session.accessTokenJti = require('crypto').randomUUID();
    session.expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await session.save();

    // 生成新的访问令牌
    const accessToken = generateAccessToken({
      id: session.userId.toString(),
      email: "", // 后续查询
      role: "user",
      jti: session.accessTokenJti,
      sessionId: session._id.toString(),
    });

    // 设置新的刷新令牌 Cookie
    setRefreshTokenCookie(res, newRefreshToken);

    writeAuditLogAsync({
      action: "login_success",
      resourceId: session.userId.toString(),
      details: { method: "refresh_token", sessionId: session._id.toString() },
      ctx: { userId: session.userId.toString(), ipAddress: req.ip, userAgent: req.headers["user-agent"] as string },
    });

    res.json({ success: true, accessToken, expiresIn: 900 }); // 15 分钟
  } catch (err) {
    logger.error("auth", `token refresh error: ${(err as Error)?.message}`);
    sendError(res, err);
  }
});

// 当前设备登出
router.post("/logout", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sessionId = req.user?.sessionId;
    if (sessionId) {
      await AuthSession.findByIdAndUpdate(sessionId, {
        $set: { status: "revoked", revokedAt: new Date(), revokeReason: "user_logout" },
      });
    }

    clearRefreshTokenCookie(res);

    writeAuditLogAsync({
      action: "logout",
      resourceId: req.user?.id,
      details: { sessionId },
      ctx: { userId: req.user?.id, ipAddress: req.ip },
    });

    res.json({ success: true, message: "已登出" });
  } catch (err) {
    sendError(res, err);
  }
});

// 全部设备登出
router.post("/logout-all", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await AuthSession.updateMany(
      { userId: req.user?.id, status: "active" },
      { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "all_logout" } }
    );

    clearRefreshTokenCookie(res);

    writeAuditLogAsync({
      action: "logout_all",
      resourceId: req.user?.id,
      details: {},
      ctx: { userId: req.user?.id, ipAddress: req.ip },
    });

    res.json({ success: true, message: "所有设备已登出" });
  } catch (err) {
    sendError(res, err);
  }
});

// 列出活跃会话
router.get("/sessions", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const sessions = await AuthSession.find({
      userId: req.user?.id,
      status: "active",
    })
      .select("-refreshToken -refreshTokenHash")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: sessions.map((s) => ({
        id: s._id,
        deviceFingerprint: s.deviceFingerprint,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt,
        expiresAt: s.expiresAt,
        isCurrent: s._id.toString() === req.user?.sessionId,
      })),
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 撤销特定会话
router.post("/sessions/:id/revoke", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const session = await AuthSession.findOneAndUpdate(
      { _id: req.params.id, userId: req.user?.id, status: "active" },
      { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "user_logout" } }
    );

    if (!session) {
      return res.status(404).json({ error: "会话不存在或已失效" });
    }

    writeAuditLogAsync({
      action: "session_revoke",
      resourceId: req.user?.id,
      details: { sessionId: req.params.id },
      ctx: { userId: req.user?.id, ipAddress: req.ip },
    });

    res.json({ success: true, message: "会话已撤销" });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
