"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordAiCost = recordAiCost;
exports.getDailyCost = getDailyCost;
exports.getGlobalCost = getGlobalCost;
exports.checkCostValve = checkCostValve;
exports.estimateCostFen = estimateCostFen;
/**
 * 成本预警阀门 —— 低成本变现（方案A 垫付）的「第二道闸门」
 *
 * 第一道闸门是 middleware/subscription.ts 的「日配额上限」（次数限制）。
 * 本服务按「预估金额（分）」计量单用户每日 AI 调用成本：
 *   - 业务层在每次真实 AI 调用后调用 recordAiCost(userId, estimatedFen)
 *   - 每日成本累计进 Redis（按天滚动）
 *   - checkCostValve() 返回当前是否允许继续、告警级别，并在逼近/超限时发通知
 *
 * 与配额闸门解耦：配额管「次数」，成本阀门管「钱」。两者任一触发即限流。
 */
const database_1 = require("../config/database");
const billing_1 = require("../config/billing");
const notify_service_1 = require("./notify.service");
const logger_1 = require("../lib/logger");
function todayKey() {
    return new Date().toISOString().slice(0, 10);
}
function costKey(userId) {
    return `ai_cost:${userId}:${todayKey()}`;
}
/** 全局成本键（全站当日 AI 成本汇总，用于毛利看板，仅多一次 incrby，开销可忽略） */
function globalCostKey(date = todayKey()) {
    return `ai_cost:global:${date}`;
}
/** 记录一次 AI 调用的预估成本（分），返回累计值 */
async function recordAiCost(userId, estimatedFen) {
    try {
        if (estimatedFen <= 0)
            return 0;
        const key = costKey(userId);
        const total = await database_1.redisClient.incrby(key, Math.ceil(estimatedFen));
        await database_1.redisClient.expire(key, 86400);
        // 同步累加全局日成本（毛利看板用）
        const gKey = globalCostKey();
        await database_1.redisClient.incrby(gKey, Math.ceil(estimatedFen));
        await database_1.redisClient.expire(gKey, 86400 * 32); // 保留约一个月，便于月度聚合
        return total;
    }
    catch (err) {
        logger_1.logger.warn('cost-control', `记录成本失败(忽略): ${err?.message}`);
        return 0;
    }
}
/** 查询当日已累计成本（分） */
async function getDailyCost(userId) {
    try {
        return Number(await database_1.redisClient.get(costKey(userId))) || 0;
    }
    catch {
        return 0;
    }
}
/** 查询指定日期（YYYY-MM-DD）全站 AI 成本（分），用于毛利看板月度聚合 */
async function getGlobalCost(date) {
    try {
        return Number(await database_1.redisClient.get(globalCostKey(date))) || 0;
    }
    catch {
        return 0;
    }
}
/**
 * 检查成本阀门。会按需触发通知（warn/block 级别，且当日仅告警一次避免轰炸）。
 * @param userId 用户ID
 * @param plan 当前套餐
 * @param contact 告警接收方（openid/手机号/空=仅控制台）
 */
async function checkCostValve(userId, plan, contact = '') {
    const budget = billing_1.PLAN_AI_BUDGET_FEN[plan] ?? billing_1.PLAN_AI_BUDGET_FEN.free;
    const used = await getDailyCost(userId);
    // 无限预算（如旗舰版）：只计量不限制
    if (budget < 0) {
        return { allowed: true, level: 'ok', usedFen: used, budgetFen: budget, ratio: 0 };
    }
    const ratio = used / budget;
    let level = 'ok';
    let allowed = true;
    if (ratio >= 1) {
        level = 'block';
        allowed = false;
    }
    else if (ratio >= billing_1.COST_WARN_RATIO) {
        level = 'warn';
    }
    // 告警去重：当日每个级别只通知一次
    if (level !== 'ok') {
        const alertFlag = `ai_cost_alert:${userId}:${todayKey()}:${level}`;
        try {
            const already = await database_1.redisClient.get(alertFlag);
            if (!already) {
                await database_1.redisClient.set(alertFlag, '1', 'EX', 86400);
                await (0, notify_service_1.notifyCostAlert)(contact, plan, used, budget);
            }
        }
        catch (err) {
            logger_1.logger.warn('cost-control', `告警标记失败(忽略): ${err?.message}`);
        }
    }
    return { allowed, level, usedFen: used, budgetFen: budget, ratio };
}
/**
 * 把 token 用量估算为成本（分）。基于 DeepSeek 混合价：输入¥1/百万、输出¥2/百万。
 * @param promptTokens 输入 token
 * @param completionTokens 输出 token
 */
function estimateCostFen(promptTokens, completionTokens) {
    const inputFen = (promptTokens / 1000000) * 100 * 1; // ¥1/百万 → 100分/百万
    const outputFen = (completionTokens / 1000000) * 100 * 2; // ¥2/百万
    return inputFen + outputFen;
}
//# sourceMappingURL=cost-control.service.js.map