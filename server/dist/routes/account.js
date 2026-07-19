"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 用户账户管理路由
 *
 * POST   /api/account/export-data        — 申请个人数据导出
 * GET    /api/account/export-data/:token — 下载导出数据
 * POST   /api/account/delete             — 申请账号注销（7天冷静期）
 * POST   /api/account/cancel-delete      — 撤销注销申请
 * DELETE /api/account/confirm-delete/:token — 确认注销
 * GET    /api/account/consents           — 查看协议同意记录
 * POST   /api/account/consent            — 记录协议同意
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const Order_1 = require("../models/Order");
const CreditsTransaction_1 = require("../models/CreditsTransaction");
const CreditLot_1 = require("../models/CreditLot");
const ConsentRecord_1 = require("../models/ConsentRecord");
const Refund_1 = require("../models/Refund");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const security_audit_service_1 = require("../services/security-audit.service");
const crypto_1 = __importDefault(require("crypto"));
const router = (0, express_1.Router)();
// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'account' }); });
// 临时 token 存储（生产应使用 Redis）
const exportTokens = new Map();
const deleteTokens = new Map();
// 注销冷静期：7 天
const DELETION_COOLING_OFF_MS = 7 * 24 * 60 * 60 * 1000;
// 确认链接有效期：72 小时（冷却期内）
const DELETION_TOKEN_TTL_MS = 72 * 60 * 60 * 1000;
// 导出 token 有效期：24 小时
const EXPORT_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
/** 申请个人数据导出 */
router.post("/account/export-data", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User_1.User.findById(userId).select("-password").lean();
        if (!user) {
            return res.status(404).json({ success: false, error: "用户不存在" });
        }
        // 并行获取所有关联数据
        const [orders, creditsTransactions, creditLots, consents, refunds] = await Promise.all([
            Order_1.Order.find({ userId }).sort({ createdAt: -1 }).lean(),
            CreditsTransaction_1.CreditsTransaction.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
            CreditLot_1.CreditLot.find({ userId }).sort({ createdAt: -1 }).lean(),
            ConsentRecord_1.ConsentRecord.find({ userId }).sort({ createdAt: -1 }).lean(),
            Refund_1.Refund.find({ userId }).sort({ createdAt: -1 }).lean(),
        ]);
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
            orders: orders.map((o) => ({
                orderNo: o.orderNo,
                plan: o.plan,
                amount: o.amount,
                credits: o.credits,
                paymentProvider: o.paymentProvider,
                paymentStatus: o.paymentStatus,
                fulfillmentStatus: o.fulfillmentStatus,
                createdAt: o.createdAt,
            })),
            creditsTransactions: creditsTransactions.map((t) => ({
                type: t.type,
                amount: t.amount,
                balanceBefore: t.balanceBefore,
                balanceAfter: t.balanceAfter,
                businessType: t.businessType,
                description: t.description,
                createdAt: t.createdAt,
            })),
            creditLots: creditLots.map((l) => ({
                sourceType: l.sourceType,
                originalAmount: l.originalAmount,
                remainingAmount: l.remainingAmount,
                status: l.status,
                expiresAt: l.expiresAt,
                createdAt: l.createdAt,
            })),
            consents: consents.map((c) => ({
                consentType: c.consentType,
                version: c.version,
                accepted: c.accepted,
                channel: c.channel,
                createdAt: c.createdAt,
            })),
            refunds: refunds.map((r) => ({
                orderNo: r.orderNo,
                amount: r.amount,
                status: r.status,
                reason: r.reason,
                createdAt: r.createdAt,
            })),
            _counts: {
                orders: orders.length,
                creditsTransactions: creditsTransactions.length,
                creditLots: creditLots.length,
                consents: consents.length,
                refunds: refunds.length,
            },
            _note: "此为您的完整个人数据导出。包含个人资料、订单、积分流水、额度批次、协议同意记录和退款记录。请妥善保管此文件。",
        };
        const token = crypto_1.default.randomBytes(32).toString("hex");
        exportTokens.set(token, { userId, expiresAt: Date.now() + EXPORT_TOKEN_TTL_MS });
        await (0, security_audit_service_1.writeAuditLogAsync)({
            action: "account_action",
            resourceType: "user_data_export",
            resourceId: userId,
            details: { action: "export_requested" },
            severity: "low",
            ctx: { adminId: userId, userId, ipAddress: req.ip },
        });
        logger_1.logger.info("account", `用户 ${user.email} 申请完整数据导出（含 ${data._counts.orders} 订单、${data._counts.creditsTransactions} 积分流水）`);
        res.json({
            success: true,
            data,
            downloadToken: token,
            message: `数据导出完成。包含 ${data._counts.orders} 笔订单、${data._counts.creditsTransactions} 条积分流水等。下载链接 24 小时内有效。`,
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 下载导出数据（无需登录，凭 token） */
router.get("/account/export-data/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const record = exportTokens.get(token);
        if (!record || record.expiresAt < Date.now()) {
            exportTokens.delete(token);
            return res.status(410).json({ success: false, error: "下载链接已过期或无效" });
        }
        const userId = record.userId;
        const user = await User_1.User.findById(userId).select("-password").lean();
        if (!user) {
            exportTokens.delete(token);
            return res.status(404).json({ success: false, error: "用户不存在" });
        }
        // 重新获取最新数据
        const [orders, creditsTransactions, creditLots, consents, refunds] = await Promise.all([
            Order_1.Order.find({ userId }).sort({ createdAt: -1 }).lean(),
            CreditsTransaction_1.CreditsTransaction.find({ userId }).sort({ createdAt: -1 }).limit(500).lean(),
            CreditLot_1.CreditLot.find({ userId }).sort({ createdAt: -1 }).lean(),
            ConsentRecord_1.ConsentRecord.find({ userId }).sort({ createdAt: -1 }).lean(),
            Refund_1.Refund.find({ userId }).sort({ createdAt: -1 }).lean(),
        ]);
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
            orders,
            creditsTransactions,
            creditLots,
            consents,
            refunds,
        };
        // 一次性使用，删除 token
        exportTokens.delete(token);
        logger_1.logger.info("account", `用户 ${user.email} 下载数据导出`);
        res.setHeader("Content-Type", "application/json");
        res.setHeader("Content-Disposition", `attachment; filename="aibak-data-export-${Date.now()}.json"`);
        res.json({ success: true, data });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 申请账号注销（7 天冷静期） */
router.post("/account/delete", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: "用户不存在" });
        }
        // 检查是否已有待处理的注销申请
        const existingToken = [...deleteTokens.entries()].find(([, r]) => r.userId === userId && r.expiresAt > Date.now());
        if (existingToken) {
            const remainingMs = existingToken[1].expiresAt - Date.now();
            const remainingDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));
            return res.status(400).json({
                success: false,
                error: `您已提交注销申请，冷静期还剩约 ${remainingDays} 天。如需撤销，请使用 /api/account/cancel-delete。`,
                existingToken: existingToken[0],
            });
        }
        // 检查是否有未完成订单
        const pendingOrders = await Order_1.Order.countDocuments({
            userId,
            paymentStatus: { $in: ["pending", "paid"] },
        });
        if (pendingOrders > 0) {
            return res.status(400).json({
                success: false,
                error: `您有 ${pendingOrders} 笔未完成订单，请先处理后再申请注销`,
            });
        }
        const coolingOffExpiresAt = Date.now() + DELETION_COOLING_OFF_MS;
        const tokenExpiresAt = Math.min(coolingOffExpiresAt, Date.now() + DELETION_TOKEN_TTL_MS);
        const token = crypto_1.default.randomBytes(32).toString("hex");
        deleteTokens.set(token, {
            userId,
            requestedAt: Date.now(),
            expiresAt: tokenExpiresAt,
        });
        // 标记用户为待注销状态
        user.deletionRequestedAt = new Date();
        user.deletionToken = token;
        await user.save();
        await (0, security_audit_service_1.writeAuditLogAsync)({
            action: "account_action",
            resourceType: "user_deletion",
            resourceId: userId,
            details: {
                action: "deletion_requested",
                coolingOffExpiresAt: new Date(coolingOffExpiresAt).toISOString(),
            },
            severity: "medium",
            ctx: { adminId: userId, userId, ipAddress: req.ip },
        });
        logger_1.logger.info("account", `用户 ${user.email} 申请账号注销，冷静期至 ${new Date(coolingOffExpiresAt).toISOString()}`);
        res.json({
            success: true,
            message: `账号注销申请已提交。注销将在 7 天冷静期后生效（${new Date(coolingOffExpiresAt).toLocaleDateString("zh-CN")}）。期间重新登录将自动撤销注销申请。`,
            coolingOffExpiresAt: new Date(coolingOffExpiresAt).toISOString(),
            confirmToken: token,
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 撤销注销申请 */
router.post("/account/cancel-delete", auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const user = await User_1.User.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, error: "用户不存在" });
        }
        if (!user.deletionRequestedAt) {
            return res.status(400).json({ success: false, error: "您没有待处理的注销申请" });
        }
        // 清理 deleteTokens
        const tokenToDelete = user.deletionToken;
        if (tokenToDelete) {
            deleteTokens.delete(tokenToDelete);
        }
        user.deletionRequestedAt = undefined;
        user.deletionToken = undefined;
        await user.save();
        await (0, security_audit_service_1.writeAuditLogAsync)({
            action: "account_action",
            resourceType: "user_deletion",
            resourceId: userId,
            details: { action: "deletion_cancelled" },
            severity: "low",
            ctx: { adminId: userId, userId, ipAddress: req.ip },
        });
        logger_1.logger.info("account", `用户 ${user.email} 撤销注销申请`);
        res.json({ success: true, message: "注销申请已撤销。您的账户已恢复正常。" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 确认账号注销 */
router.delete("/account/confirm-delete/:token", async (req, res) => {
    try {
        const { token } = req.params;
        const record = deleteTokens.get(token);
        if (!record) {
            return res.status(410).json({ success: false, error: "确认链接无效" });
        }
        if (record.expiresAt < Date.now()) {
            deleteTokens.delete(token);
            // 检查是否已过冷却期
            const coolingOffEnd = record.requestedAt + DELETION_COOLING_OFF_MS;
            if (Date.now() < coolingOffEnd) {
                return res.status(400).json({
                    success: false,
                    error: `冷静期尚未结束。请等到 ${new Date(coolingOffEnd).toLocaleDateString("zh-CN")} 后再确认注销。`,
                });
            }
            return res.status(410).json({ success: false, error: "确认链接已过期，请重新提交注销申请" });
        }
        const user = await User_1.User.findById(record.userId);
        if (!user) {
            deleteTokens.delete(token);
            return res.status(404).json({ success: false, error: "用户不存在" });
        }
        // 二次检查是否有未完成订单
        const pendingOrders = await Order_1.Order.countDocuments({
            userId: user._id,
            paymentStatus: { $in: ["pending", "paid"] },
        });
        if (pendingOrders > 0) {
            return res.status(400).json({
                success: false,
                error: `您有 ${pendingOrders} 笔未完成订单，无法完成注销`,
            });
        }
        // 匿名化用户数据（依法保留支付、退款、安全审计记录）
        const originalEmail = user.email;
        user.email = `deleted_${user._id}@anonymous.local`;
        user.name = "已注销用户";
        user.phone = undefined;
        user.phoneHash = undefined;
        user.avatar = undefined;
        user.isBanned = true;
        user.deletionRequestedAt = undefined;
        user.deletionToken = undefined;
        user.deletedAt = new Date();
        await user.save();
        deleteTokens.delete(token);
        await (0, security_audit_service_1.writeAuditLogAsync)({
            action: "account_action",
            resourceType: "user_deletion",
            resourceId: record.userId,
            details: { action: "deletion_confirmed", originalEmail },
            severity: "medium",
            ctx: { userId: record.userId, ipAddress: req.ip },
        });
        logger_1.logger.info("account", `用户 ${record.userId} 账号已注销（匿名化），原邮箱 ${originalEmail}`);
        res.json({ success: true, message: "账号已注销。您的个人信息已被删除或匿名化。感谢您的使用。" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 查看协议同意记录 */
router.get("/account/consents", auth_1.requireAuth, async (req, res) => {
    try {
        const consents = await ConsentRecord_1.ConsentRecord.find({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: consents });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 记录协议同意 */
router.post("/account/consent", auth_1.requireAuth, async (req, res) => {
    try {
        const { consentType, version, accepted } = req.body;
        if (!consentType || !version) {
            return res.status(400).json({ success: false, error: "consentType 和 version 是必填项" });
        }
        const validTypes = [
            "terms_of_service",
            "privacy_policy",
            "cookie_policy",
            "refund_policy",
            "points_rules",
            "data_processing",
        ];
        if (!validTypes.includes(consentType)) {
            return res.status(400).json({ success: false, error: "无效的协议类型" });
        }
        const record = await ConsentRecord_1.ConsentRecord.create({
            userId: req.user.id,
            consentType,
            version,
            accepted: accepted !== false,
            ipAddress: req.ip || "unknown",
            userAgent: req.headers["user-agent"] || "",
            channel: req.body?.channel || "web",
        });
        logger_1.logger.info("account", `用户 ${req.user.id} 同意 ${consentType} v${version}`);
        res.json({ success: true, data: record });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=account.js.map