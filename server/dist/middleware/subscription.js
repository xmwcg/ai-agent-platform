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
exports.resolveUserPlan = resolveUserPlan;
exports.requirePlan = requirePlan;
exports.enforceQuota = enforceQuota;
exports.quotaIncrement = quotaIncrement;
exports.getQuotaUsage = getQuotaUsage;
exports.enforceCostValve = enforceCostValve;
exports.quotaCostRecord = quotaCostRecord;
const User_1 = require("../models/User");
const database_1 = require("../config/database");
const billing_1 = require("../config/billing");
const cost_control_service_1 = require("../services/cost-control.service");
function todayKey() {
    return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
/** 读取用户当前有效套餐（过期则降级为 free） */
async function resolveUserPlan(userId) {
    const user = await User_1.User.findById(userId).select('plan membershipExpiresAt').lean();
    if (!user)
        return { plan: billing_1.DEFAULT_PLAN, expired: false };
    const plan = user.plan || billing_1.DEFAULT_PLAN;
    const expired = !!user.membershipExpiresAt && user.membershipExpiresAt.getTime() < Date.now();
    return { plan: expired ? billing_1.DEFAULT_PLAN : plan, expired };
}
/** 要求套餐等级 */
function requirePlan(min) {
    return async (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: '请先登录' });
            return;
        }
        const { plan } = await resolveUserPlan(req.user.id);
        if (!(0, billing_1.planSatisfies)(plan, min)) {
            res.status(403).json({
                error: '权限不足',
                code: 'PLAN_REQUIRED',
                requiredPlan: min,
                currentPlan: plan,
                message: `该功能需要 ${billing_1.PLANS[min].name}，请升级套餐`,
            });
            return;
        }
        next();
    };
}
/** 配额强制（在 requireAuth 之后使用） */
function enforceQuota(resource) {
    return async (req, res, next) => {
        // BYOK：用户自带 Key 生成，平台零垫付，直接放行配额闸门
        if (req.byokBypass)
            return next();
        if (!req.user) {
            next();
            return;
        }
        try {
            const { plan } = await resolveUserPlan(req.user.id);
            const limit = billing_1.PLANS[plan].limits[resource];
            if (limit === -1)
                return next(); // 无限制
            const key = `quota:${req.user.id}:${resource}:${todayKey()}`;
            const used = Number(await database_1.redisClient.get(key)) || 0;
            if (used >= limit) {
                res.status(402).json({
                    error: '今日配额已用尽',
                    code: 'QUOTA_EXCEEDED',
                    resource,
                    limit,
                    used,
                    currentPlan: plan,
                    message: `当前 ${billing_1.PLANS[plan].name} 的「${resource}」今日配额已用尽，升级套餐以获得更多额度`,
                    upgradeUrl: '/pricing',
                });
                return;
            }
            // 预占配额（请求成功后由业务层调用 quotaIncrement 真正累加）
            next();
        }
        catch (err) {
            // 配额系统异常不阻断主流程
            next();
        }
    };
}
/** 业务成功后累加用量（供路由在处理完成后调用） */
async function quotaIncrement(userId, resource, by = 1) {
    try {
        const key = `quota:${userId}:${resource}:${todayKey()}`;
        const ttl = 86400; // 一天
        await database_1.redisClient.incrby(key, by);
        await database_1.redisClient.expire(key, ttl);
    }
    catch {
        /* 忽略配额计数异常 */
    }
}
/** 查询用户当日各资源用量 */
async function getQuotaUsage(userId) {
    const { plan } = await resolveUserPlan(userId);
    const limits = billing_1.PLANS[plan].limits;
    const result = {};
    for (const resource of Object.keys(limits)) {
        const used = Number(await database_1.redisClient.get(`quota:${userId}:${resource}:${todayKey()}`)) || 0;
        result[resource] = { used, limit: limits[resource] };
    }
    return result;
}
/**
 * 成本阀门（垫付模式第二道闸门）：请求开始时按「当日已累计 AI 成本」拦截。
 * 业务层在真实 AI 调用返回后调用 `quotaCostRecord` 记录本次成本。
 * @param contact 告警接收方（openid/手机号），可选
 */
function enforceCostValve(contact = '') {
    return async (req, res, next) => {
        // BYOK：用户自带 Key 生成，平台零垫付，成本阀门直接放行
        if (req.byokBypass)
            return next();
        if (!req.user) {
            next();
            return;
        }
        try {
            const { plan } = await resolveUserPlan(req.user.id);
            const valve = await (0, cost_control_service_1.checkCostValve)(req.user.id, plan, contact);
            if (!valve.allowed) {
                res.status(402).json({
                    error: '今日 AI 成本预算已用尽',
                    code: 'COST_BUDGET_EXCEEDED',
                    message: '为保障平台稳定，您今日的 AI 调用成本已达上限。可升级套餐或改用自带 Key（BYOK）继续。',
                    upgradeUrl: '/pricing',
                    dailyCostFen: valve.usedFen,
                });
                return;
            }
            next();
        }
        catch (err) {
            // 异常不阻断主流程
            next();
        }
    };
}
/** 记录一次 AI 调用成本（业务层在 AI 返回后调用） */
async function quotaCostRecord(userId, estimatedFen) {
    try {
        const { recordAiCost } = await Promise.resolve().then(() => __importStar(require('../services/cost-control.service')));
        await recordAiCost(userId, estimatedFen);
    }
    catch {
        /* 忽略 */
    }
}
//# sourceMappingURL=subscription.js.map