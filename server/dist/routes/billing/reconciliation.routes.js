"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 对账路由 — 手动触发对账、对账列表、对账详情
 */
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const reconciliation_service_1 = require("../../services/reconciliation.service");
const http_error_1 = require("../../lib/http-error");
const router = (0, express_1.Router)();
// 手动触发对账（管理员）
router.post("/reconciliation/trigger", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const dateStr = req.body.date;
        const date = dateStr ? new Date(dateStr) : undefined;
        const result = await reconciliation_service_1.ReconciliationService.triggerReconciliation(date);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 对账列表（管理员）
router.get("/admin/reconciliation", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const result = await reconciliation_service_1.ReconciliationService.getReconciliationList(page, limit);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 对账详情（管理员）
router.get("/admin/reconciliation/:batchId", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const result = await reconciliation_service_1.ReconciliationService.getReconciliationDetail(req.params.batchId);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=reconciliation.routes.js.map