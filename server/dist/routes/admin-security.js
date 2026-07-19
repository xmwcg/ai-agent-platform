"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 安全审计管理路由
 *
 * GET  /api/admin/audit-logs   管理员查询安全审计日志
 * GET  /api/admin/sessions     管理员查看所有活跃会话（安全审计）
 * POST /api/admin/sessions/revoke 管理员强制撤销用户会话
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const security_audit_service_1 = require("../services/security-audit.service");
const AuthSession_1 = require("../models/AuthSession");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
// 管理员查询安全审计日志
router.get("/admin/audit-logs", auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await (0, security_audit_service_1.queryAuditLogs)({
            userId: req.query.userId,
            action: req.query.action,
            severity: req.query.severity,
            outcome: req.query.outcome,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
            page: parseInt(req.query.page, 10) || 1,
            limit: parseInt(req.query.limit, 10) || 20,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 管理员查看所有活跃会话
router.get("/admin/sessions", auth_1.requireAdmin, async (req, res) => {
    try {
        const userId = req.query.userId;
        const filter = { status: "active" };
        if (userId)
            filter.userId = userId;
        const sessions = await AuthSession_1.AuthSession.find(filter)
            .select("-refreshToken")
            .populate("userId", "email name role")
            .sort({ createdAt: -1 })
            .limit(200)
            .lean();
        res.json({ success: true, data: sessions });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 管理员强制撤销会话
router.post("/admin/sessions/:sessionId/revoke", auth_1.requireAdmin, async (req, res) => {
    try {
        const session = await AuthSession_1.AuthSession.findByIdAndUpdate(req.params.sessionId, { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "admin_revoke" } });
        if (!session) {
            return res.status(404).json({ error: "会话不存在" });
        }
        res.json({ success: true, message: "会话已撤销" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=admin-security.js.map