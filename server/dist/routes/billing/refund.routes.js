"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 退款路由 — 退款申请、审批、详情查询
 */
const express_1 = require("express");
const auth_1 = require("../../middleware/auth");
const refund_service_1 = require("../../services/refund.service");
const http_error_1 = require("../../lib/http-error");
const router = (0, express_1.Router)();
// 用户提交退款申请
router.post("/refunds", auth_1.requireAuth, async (req, res) => {
    try {
        const { orderNo, reason, description } = req.body;
        if (!orderNo)
            return res.status(400).json({ success: false, error: "缺少订单号" });
        if (!reason)
            return res.status(400).json({ success: false, error: "缺少退款原因" });
        const validReasons = ["duplicate_payment", "voluntary_refund", "service_unavailable", "fraud", "other"];
        if (!validReasons.includes(reason)) {
            return res.status(400).json({ success: false, error: "无效的退款原因" });
        }
        const result = await refund_service_1.RefundService.submitRefund({
            userId: req.user.id,
            orderNo,
            reason: reason,
            description,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 管理员审批退款
router.put("/refunds/:refundNo/approve", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { actualRefundAmount, adminNote } = req.body;
        if (!adminNote)
            return res.status(400).json({ success: false, error: "缺少审批备注" });
        const result = await refund_service_1.RefundService.approveRefund({
            refundNo: req.params.refundNo,
            adminId: req.user.id,
            actualRefundAmount,
            adminNote,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 管理员拒绝退款
router.put("/refunds/:refundNo/reject", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const { adminNote } = req.body;
        if (!adminNote)
            return res.status(400).json({ success: false, error: "缺少拒绝原因" });
        const result = await refund_service_1.RefundService.rejectRefund(req.params.refundNo, req.user.id, adminNote);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 退款详情（用户/管理员）
router.get("/refunds/:refundNo", auth_1.requireAuth, async (req, res) => {
    try {
        const refund = await refund_service_1.RefundService.getRefundDetail(req.params.refundNo, req.user.id);
        res.json({ success: true, data: refund });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 我的退款列表
router.get("/my-refunds", auth_1.requireAuth, async (req, res) => {
    try {
        const status = req.query.status;
        const validStatuses = ["pending", "approved", "rejected", "processing", "success", "failed"];
        const filterStatus = status && validStatuses.includes(status) ? status : undefined;
        const refunds = await refund_service_1.RefundService.getUserRefunds(req.user.id, filterStatus);
        res.json({ success: true, data: refunds });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 管理员：全部退款列表
router.get("/admin-refunds", auth_1.requireAuth, auth_1.requireAdmin, async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 20));
        const status = req.query.status;
        const result = await refund_service_1.RefundService.getAllRefunds(page, limit, status);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=refund.routes.js.map