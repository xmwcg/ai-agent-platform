/**
 * 用户账户管理路由
 *
 * POST   /api/account/export-data   — 申请个人数据导出
 * GET    /api/account/export-data/:token — 下载导出数据
 * POST   /api/account/delete        — 申请账号注销
 * DELETE /api/account/confirm-delete/:token — 确认注销
 * GET    /api/account/consents      — 查看协议同意记录
 * POST   /api/account/consent       — 记录协议同意
 */
import { Router, Response } from "express";
import { AuthRequest, requireAuth } from "../middleware/auth";
import { User } from "../models/User";
import { ConsentRecord } from "../models/ConsentRecord";
import { sendError } from "../lib/http-error";
import { logger } from "../lib/logger";
import { writeAuditLogAsync } from "../services/security-audit.service";
import crypto from "crypto";

const router = Router();

// 临时 token 存储（生产应使用 Redis）
const exportTokens = new Map<string, { userId: string; expiresAt: number }>();
const deleteTokens = new Map<string, { userId: string; expiresAt: number }>();

/** 申请个人数据导出 */
router.post("/account/export-data", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    // 聚合用户所有数据
    const data = {
      exportedAt: new Date().toISOString(),
      userId: user._id,
      profile: {
        name: user.name,
        email: user.email,
        avatar: user.avatar,
        phone: (user as any).phone ? "***" : undefined,
        role: user.role,
        plan: user.plan,
        membershipExpiresAt: user.membershipExpiresAt,
        createdAt: user.createdAt,
      },
      _note: "完整数据导出包含个人资料、订单、积分流水等。请联系管理员获取完整导出。",
    };

    const token = crypto.randomBytes(32).toString("hex");
    exportTokens.set(token, { userId: req.user!.id, expiresAt: Date.now() + 24 * 60 * 60 * 1000 });

    await writeAuditLogAsync({
      action: "account_action",
      resourceType: "user_data_export",
      resourceId: req.user!.id,
      details: { action: "export_requested", token },
      severity: "low",
      ctx: { adminId: req.user!.id, userId: req.user!.id, ipAddress: req.ip },
    });

    logger.info("account", `用户 ${user.email} 申请数据导出`);

    res.json({
      success: true,
      data,
      downloadToken: token,
      message: "数据导出申请已提交。下载链接 24 小时内有效。",
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 下载导出数据 */
router.get("/account/export-data/:token", async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const record = exportTokens.get(token);
    if (!record || record.expiresAt < Date.now()) {
      exportTokens.delete(token);
      return res.status(410).json({ success: false, error: "下载链接已过期或无效" });
    }

    const user = await User.findById(record.userId).select("-password").lean();
    if (!user) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    // 一次性使用，删除 token
    exportTokens.delete(token);

    const data = {
      exportedAt: new Date().toISOString(),
      userId: user._id,
      profile: {
        name: user.name,
        email: user.email,
        role: user.role,
        plan: user.plan,
        credits: user.credits,
        membershipExpiresAt: user.membershipExpiresAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
    };

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="aibak-data-export-${Date.now()}.json"`);
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

/** 申请账号注销 */
router.post("/account/delete", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    // 检查是否有未完成订单
    const { Order } = await import("../models/Order");
    const pendingOrders = await Order.countDocuments({
      userId: user._id,
      paymentStatus: { $in: ["pending", "paid"] },
    });

    if (pendingOrders > 0) {
      return res.status(400).json({
        success: false,
        error: `您有 ${pendingOrders} 笔未完成订单，请先处理后再申请注销`,
      });
    }

    const token = crypto.randomBytes(32).toString("hex");
    deleteTokens.set(token, { userId: req.user!.id, expiresAt: Date.now() + 60 * 60 * 1000 }); // 1 小时有效

    await writeAuditLogAsync({
      action: "account_action",
      resourceType: "user_deletion",
      resourceId: req.user!.id,
      details: { action: "deletion_requested", token },
      severity: "medium",
      ctx: { adminId: req.user!.id, userId: req.user!.id, ipAddress: req.ip },
    });

    logger.info("account", `用户 ${user.email} 申请账号注销`);

    res.json({
      success: true,
      message: "账号注销申请已提交。确认链接 1 小时内有效。请检查邮箱确认。",
      confirmToken: token,
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 确认账号注销 */
router.delete("/account/confirm-delete/:token", async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.params;
    const record = deleteTokens.get(token);
    if (!record || record.expiresAt < Date.now()) {
      deleteTokens.delete(token);
      return res.status(410).json({ success: false, error: "确认链接已过期或无效" });
    }

    const user = await User.findById(record.userId);
    if (!user) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    // 匿名化用户数据（依法保留支付、退款、安全审计记录）
    user.email = `deleted_${user._id}@anonymous.local`;
    user.name = "已注销用户";
    user.phone = undefined;
    (user as any).phoneHash = undefined;
    user.avatar = undefined;
    user.isBanned = true;
    await user.save();

    deleteTokens.delete(token);

    await writeAuditLogAsync({
      action: "account_action",
      resourceType: "user_deletion",
      resourceId: record.userId,
      details: { action: "deletion_confirmed" },
      severity: "medium",
      ctx: { userId: record.userId, ipAddress: req.ip },
    });

    logger.info("account", `用户 ${user._id} 账号已注销（匿名化）`);

    res.json({ success: true, message: "账号已注销。感谢您的使用。" });
  } catch (err) {
    sendError(res, err);
  }
});

/** 查看协议同意记录 */
router.get("/account/consents", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const consents = await ConsentRecord.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: consents });
  } catch (err) {
    sendError(res, err);
  }
});

/** 记录协议同意 */
router.post("/account/consent", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { consentType, version, accepted } = req.body;

    if (!consentType || !version) {
      return res.status(400).json({ success: false, error: "consentType 和 version 是必填项" });
    }

    const validTypes = ["terms_of_service", "privacy_policy", "cookie_policy", "refund_policy", "data_processing"];
    if (!validTypes.includes(consentType)) {
      return res.status(400).json({ success: false, error: "无效的协议类型" });
    }

    const record = await ConsentRecord.create({
      userId: req.user!.id,
      consentType,
      version,
      accepted: accepted !== false,
      ipAddress: req.ip || "unknown",
      userAgent: req.headers["user-agent"] || "",
      channel: (req.body as any)?.channel || "web",
    });

    logger.info("account", `用户 ${req.user!.id} 同意 ${consentType} v${version}`);

    res.json({ success: true, data: record });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;