"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const http_error_1 = require("../lib/http-error");
const validation_1 = require("../lib/validation");
const marketplace_revenue_service_1 = require("../services/marketplace-revenue.service");
const router = (0, express_1.Router)();
router.use(auth_1.requireAuth);
const withdrawSchema = {
    amount: { required: true, type: 'number' },
    method: { required: true, type: 'string', oneOf: ['wechat', 'alipay'] },
    account: { required: true, type: 'string', minLength: 1 },
};
/**
 * GET /api/marketplace/revenue/stats
 * 收益概览
 */
router.get('/revenue/stats', async (req, res) => {
    try {
        const stats = await (0, marketplace_revenue_service_1.getCreatorRevenueStats)(req.user.id);
        const byResource = await (0, marketplace_revenue_service_1.getRevenueByResource)(req.user.id);
        res.json({ success: true, data: { ...stats, byResource } });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/marketplace/revenue/list
 * 收益明细列表（分页）
 * Query: status, page, pageSize
 */
router.get('/revenue/list', async (req, res) => {
    try {
        const { status, page, pageSize } = req.query;
        const data = await (0, marketplace_revenue_service_1.getRevenueList)(req.user.id, status, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/marketplace/revenue/by-resource
 * 按资源类型统计收益
 */
router.get('/revenue/by-resource', async (req, res) => {
    try {
        const data = await (0, marketplace_revenue_service_1.getRevenueByResource)(req.user.id);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * POST /api/marketplace/revenue/withdraw
 * 创建提现申请
 */
router.post('/revenue/withdraw', (0, validation_1.validate)(withdrawSchema), async (req, res) => {
    try {
        const { amount, method, account } = req.body;
        const result = await (0, marketplace_revenue_service_1.createWithdrawRequest)(req.user.id, amount, method, account);
        res.json({ success: true, data: result });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/marketplace/revenue/withdraws
 * 提现申请列表
 */
router.get('/revenue/withdraws', async (req, res) => {
    try {
        const { page, pageSize } = req.query;
        const data = await (0, marketplace_revenue_service_1.getWithdrawList)(req.user.id, parseInt(page) || 1, parseInt(pageSize) || 20);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=marketplace-revenue.js.map