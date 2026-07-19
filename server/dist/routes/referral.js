"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const referral_service_1 = require("../services/referral.service");
const http_error_1 = require("../lib/http-error");
const Withdrawal_1 = require("../models/Withdrawal");
const router = (0, express_1.Router)();
router.get('/', (req, res) => { res.json({ ok: true, name: 'referral', routes: ['/code', '/stats', '/list', '/commissions', '/withdraw'] }); });
// 所有路由需要登录
router.use(auth_1.requireAuth);
/**
 * GET /api/referral/stats
 * 获取推荐统计
 */
router.get('/stats', async (req, res) => {
    try {
        const stats = await (0, referral_service_1.getReferralStats)(req.user._id);
        res.json({ success: true, data: stats });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/referral/list
 * 获取推荐列表（分页）
 */
router.get('/list', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
        const data = await (0, referral_service_1.getReferralList)(req.user._id, page, pageSize);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/referral/commissions
 * 获取佣金列表（分页）
 */
router.get('/commissions', async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize) || 20));
        const data = await (0, referral_service_1.getCommissionList)(req.user._id, page, pageSize);
        res.json({ success: true, data });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/referral/code
 * 获取当前用户的推荐码
 */
router.get('/code', async (req, res) => {
    try {
        const user = await Promise.resolve().then(() => __importStar(require('../models/User'))).then((m) => m.User.findById(req.user._id).select('referralCode'));
        res.json({
            success: true,
            data: {
                referralCode: user?.referralCode || '',
                referralLink: user?.referralCode
                    ? `https://aibak.site/register?ref=${user.referralCode}`
                    : '',
            },
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 申请提现（真实锁定佣金，生成提现单，管理员/财务复核打款）
router.post('/withdraw', async (req, res) => {
    try {
        const { amount, method, account } = req.body || {};
        const amt = Number(amount);
        const userId = req.user._id;
        const result = await (0, referral_service_1.requestWithdrawal)(userId, amt, method === 'alipay' ? 'alipay' : 'wechat', account);
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 我的提现记录
router.get('/withdrawals', async (req, res) => {
    try {
        const list = await Withdrawal_1.Withdrawal.find({ userId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50)
            .lean();
        res.json({ success: true, data: list });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=referral.js.map