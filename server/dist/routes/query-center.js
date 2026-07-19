"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const provider_catalog_1 = require("../config/provider-catalog");
const model_fetch_service_1 = require("../services/model-fetch.service");
const User_1 = require("../models/User");
const CreditLot_1 = require("../models/CreditLot");
const ApiUsageLog_1 = require("../models/ApiUsageLog");
const Order_1 = require("../models/Order");
const billing_1 = require("../config/billing");
const credits_pricing_1 = require("../config/credits-pricing");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
router.get('/', (_req, res) => {
    res.json({ success: true, data: { endpoints: ['/providers', '/providers/:providerId/models', '/account-summary', '/usage'] } });
});
router.get('/providers', (_req, res) => {
    res.json({ success: true, data: (0, provider_catalog_1.publicProviderCatalog)() });
});
router.post('/providers/:providerId/models', auth_1.requireAuth, rate_limit_1.modelFetchLimiter, async (req, res) => {
    try {
        if ('baseURL' in (req.body || {}) || 'url' in (req.body || {})) {
            return res.status(400).json({ success: false, error: '不允许自定义请求地址，请选择官方厂商 Endpoint' });
        }
        const apiKey = String(req.body?.apiKey || '');
        const endpointId = req.body?.endpointId ? String(req.body.endpointId) : undefined;
        const ids = await (0, model_fetch_service_1.fetchCatalogProviderModels)({ providerId: req.params.providerId, endpointId, apiKey });
        res.json({ success: true, data: ids, count: ids.length });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
router.get('/account-summary', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const [user, lots, recentOrder, monthUsage] = await Promise.all([
            User_1.User.findById(userId).select('plan membershipExpiresAt credits').lean(),
            CreditLot_1.CreditLot.find({
                userId,
                status: 'active',
                remainingAmount: { $gt: 0 },
                $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gt: new Date() } }],
            }).select('sourceType remainingAmount expiresAt').lean(),
            Order_1.Order.findOne({ userId }).sort({ createdAt: -1 }).select('orderNo orderType plan amount currency provider status paidAt createdAt').lean(),
            ApiUsageLog_1.ApiUsageLog.aggregate([
                { $match: { ownerId: userId, timestamp: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) } } },
                { $group: { _id: null, calls: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }, credits: { $sum: { $ifNull: ['$creditsDeducted', 0] } } } },
            ]),
        ]);
        if (!user)
            return res.status(404).json({ success: false, error: '用户不存在' });
        const lotTotals = { free: 0, paid: 0, legacyProtected: 0, adjustment: 0 };
        for (const lot of lots) {
            if (lot.sourceType === 'subscription_free' || lot.sourceType === 'promotion_free')
                lotTotals.free += lot.remainingAmount;
            else if (lot.sourceType === 'purchase' || lot.sourceType === 'refund')
                lotTotals.paid += lot.remainingAmount;
            else if (lot.sourceType === 'legacy_protected')
                lotTotals.legacyProtected += lot.remainingAmount;
            else
                lotTotals.adjustment += lot.remainingAmount;
        }
        const hasLots = lots.length > 0;
        if (!hasLots && Number(user.credits) > 0)
            lotTotals.legacyProtected = Number(user.credits);
        const trackedTotal = lotTotals.free + lotTotals.paid + lotTotals.legacyProtected + lotTotals.adjustment;
        const usage = monthUsage[0] || { calls: 0, success: 0, credits: 0 };
        res.json({
            success: true,
            data: {
                plan: user.plan,
                membershipExpiresAt: user.membershipExpiresAt || null,
                credits: {
                    free: lotTotals.free,
                    paid: lotTotals.paid,
                    legacyProtected: lotTotals.legacyProtected,
                    adjustment: lotTotals.adjustment,
                    total: trackedTotal,
                    cachedTotal: Number(user.credits || 0),
                    reconciled: trackedTotal === Number(user.credits || 0),
                    migrationState: hasLots ? 'lot-tracked' : 'legacy-fallback',
                },
                monthUsage: {
                    calls: usage.calls,
                    successRate: usage.calls ? Number(((usage.success / usage.calls) * 100).toFixed(2)) : 0,
                    creditsConsumed: usage.credits,
                },
                recentOrder: recentOrder || null,
            },
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
router.get('/usage', auth_1.requireAuth, async (req, res) => {
    try {
        const to = req.query.to ? new Date(String(req.query.to)) : new Date();
        const from = req.query.from ? new Date(String(req.query.from)) : new Date(to.getTime() - 29 * 86400 * 1000);
        if (!Number.isFinite(from.getTime()) || !Number.isFinite(to.getTime()) || from > to) {
            return res.status(400).json({ success: false, error: '时间范围无效' });
        }
        if (to.getTime() - from.getTime() > 366 * 86400 * 1000) {
            return res.status(400).json({ success: false, error: '单次最多查询 366 天' });
        }
        to.setHours(23, 59, 59, 999);
        const ownerId = req.user.id;
        const [daily, resources, models, orders] = await Promise.all([
            ApiUsageLog_1.ApiUsageLog.aggregate([
                { $match: { ownerId, timestamp: { $gte: from, $lte: to } } },
                { $group: { _id: { $dateToString: { date: '$timestamp', format: '%Y-%m-%d' } }, calls: { $sum: 1 }, success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }, credits: { $sum: { $ifNull: ['$creditsDeducted', 0] } } } },
                { $sort: { _id: 1 } },
            ]),
            ApiUsageLog_1.ApiUsageLog.aggregate([
                { $match: { ownerId, timestamp: { $gte: from, $lte: to } } },
                { $group: { _id: '$resource', calls: { $sum: 1 }, credits: { $sum: { $ifNull: ['$creditsDeducted', 0] } } } },
                { $sort: { calls: -1 } }, { $limit: 20 },
            ]),
            ApiUsageLog_1.ApiUsageLog.aggregate([
                { $match: { ownerId, timestamp: { $gte: from, $lte: to }, status: 'success', modelId: { $exists: true, $nin: ['', null] } } },
                { $group: { _id: '$modelId', calls: { $sum: 1 }, credits: { $sum: { $ifNull: ['$creditsDeducted', 0] } } } },
                { $sort: { calls: -1 } }, { $limit: 20 },
            ]),
            Order_1.Order.find({ userId: ownerId }).sort({ createdAt: -1 }).limit(50)
                .select('orderNo orderType plan packageId amount currency provider status paidAt createdAt').lean(),
        ]);
        const calls = daily.reduce((sum, row) => sum + row.calls, 0);
        const success = daily.reduce((sum, row) => sum + row.success, 0);
        const credits = daily.reduce((sum, row) => sum + row.credits, 0);
        res.json({ success: true, data: {
                range: { from, to },
                totals: { calls, successRate: calls ? Number(((success / calls) * 100).toFixed(2)) : 0, creditsConsumed: credits },
                daily: daily.map((row) => ({ date: row._id, calls: row.calls, success: row.success, creditsConsumed: row.credits })),
                resourceRanking: resources.map((row) => ({ resource: row._id, calls: row.calls, creditsConsumed: row.credits })),
                modelRanking: models.map((row) => ({ model: row._id, calls: row.calls, creditsConsumed: row.credits })),
                modelTrackingAvailable: models.length > 0,
                orders,
                pricing: { plans: Object.values(billing_1.PLANS), creditPackages: credits_pricing_1.CREDITS_PACKAGES },
            } });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=query-center.js.map