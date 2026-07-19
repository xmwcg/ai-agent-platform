"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateApiKey = generateApiKey;
exports.hashKey = hashKey;
exports.isSameDay = isSameDay;
exports.resetQuotaIfNeeded = resetQuotaIfNeeded;
exports.isWithinQuota = isWithinQuota;
exports.remainingQuota = remainingQuota;
exports.applyUsage = applyUsage;
exports.logApiUsage = logApiUsage;
const crypto_1 = __importDefault(require("crypto"));
const ApiUsageLog_1 = require("../models/ApiUsageLog");
/** API 密钥生成 / 哈希 / 配额计量 —— 开放 API 市场按量计费基座 */
const PREFIX = 'rx_live_';
function generateApiKey() {
    const plain = PREFIX + crypto_1.default.randomBytes(24).toString('hex');
    return { plain, prefix: plain.slice(0, PREFIX.length + 8), hash: hashKey(plain) };
}
function hashKey(plain) {
    return crypto_1.default.createHash('sha256').update(plain).digest('hex');
}
function isSameDay(a, b) {
    return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
/** 按自然日重置用量，返回是否发生重置 */
function resetQuotaIfNeeded(key, now = new Date()) {
    if (!isSameDay(new Date(key.lastReset), now)) {
        key.usedToday = 0;
        key.lastReset = now;
        return true;
    }
    return false;
}
function isWithinQuota(key, now = new Date()) {
    resetQuotaIfNeeded(key, now);
    return key.usedToday < key.quotaDaily;
}
function remainingQuota(key, now = new Date()) {
    resetQuotaIfNeeded(key, now);
    return Math.max(0, key.quotaDaily - key.usedToday);
}
/** 累加用量（调用方需先确认 isWithinQuota） */
function applyUsage(key, by = 1, now = new Date()) {
    resetQuotaIfNeeded(key, now);
    key.usedToday += by;
}
/** 记录 API 调用日志（异步，不阻塞主流程），支撑用量报表与账单导出 */
async function logApiUsage(params) {
    await ApiUsageLog_1.ApiUsageLog.create({
        keyId: params.keyId,
        ownerId: params.ownerId,
        prefix: params.prefix,
        resource: params.resource || 'chat',
        requestId: params.requestId,
        modelId: params.modelId,
        providerId: params.providerId,
        promptBytes: params.promptBytes,
        replyBytes: params.replyBytes,
        status: params.status || 'success',
        creditsDeducted: params.creditsDeducted,
        timestamp: new Date(),
    });
}
//# sourceMappingURL=apikey.service.js.map