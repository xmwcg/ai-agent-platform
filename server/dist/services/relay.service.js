"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelayError = void 0;
exports.hashToken = hashToken;
exports.generateToken = generateToken;
exports.proxyChatCompletions = proxyChatCompletions;
exports.listModels = listModels;
exports.getAdminPasswordHash = getAdminPasswordHash;
exports.setAdminPassword = setAdminPassword;
exports.verifyAdminLogin = verifyAdminLogin;
const crypto_1 = require("crypto");
const axios_1 = __importDefault(require("axios"));
const RelayChannel_1 = require("../models/RelayChannel");
const RelayToken_1 = require("../models/RelayToken");
const RelayConfig_1 = require("../models/RelayConfig");
const crypto_2 = require("../lib/crypto");
/** 中转站统一错误 */
class RelayError extends Error {
    constructor(message, status = 400) {
        super(message);
        this.status = status;
    }
}
exports.RelayError = RelayError;
/** 令牌只存哈希，明文仅在发放时返回一次 */
function hashToken(token) {
    return (0, crypto_1.createHash)('sha256').update(token).digest('hex');
}
function generateToken() {
    return 'sk-relay-' + (0, crypto_1.randomBytes)(24).toString('base64url');
}
/** 选渠道：优先匹配模型，否则按权重随机（简单负载均衡） */
async function selectChannel(model) {
    const channels = await RelayChannel_1.RelayChannel.find({ enabled: true }).lean();
    if (!channels.length)
        return null;
    if (model) {
        const hit = channels.find((c) => (c.models || []).includes(model));
        if (hit)
            return hit;
    }
    const total = channels.reduce((s, c) => s + (c.weight || 1), 0);
    let r = Math.random() * total;
    for (const c of channels) {
        r -= c.weight || 1;
        if (r <= 0)
            return c;
    }
    return channels[0];
}
/** 核心：把金网通的 OpenAI 兼容请求转发到上游，并记账 */
async function proxyChatCompletions(token, body) {
    if (!token)
        throw new RelayError('缺少令牌', 401);
    const rt = await RelayToken_1.RelayToken.findOne({ tokenHash: hashToken(token), status: 'active' });
    if (!rt)
        throw new RelayError('无效的令牌', 401);
    if (rt.expireAt && rt.expireAt.getTime() < Date.now()) {
        rt.status = 'expired';
        await rt.save();
        throw new RelayError('令牌已过期', 401);
    }
    const model = body?.model;
    if (rt.quotaTotal > 0 && rt.quotaUsed >= rt.quotaTotal) {
        throw new RelayError('额度已用完', 402);
    }
    const channel = await selectChannel(model);
    if (!channel)
        throw new RelayError('暂无可用上游渠道', 503);
    const base = (channel.baseURL || '').replace(/\/+$/, '');
    const url = `${base}/chat/completions`;
    const apiKey = (0, crypto_2.decryptSecret)(channel.apiKey || '');
    const headers = { 'Content-Type': 'application/json' };
    if (channel.authMode === 'x-api-key') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    }
    else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }
    let resp;
    try {
        resp = await axios_1.default.post(url, body, { headers, timeout: 180000 });
    }
    catch (e) {
        const status = e?.response?.status || 502;
        const msg = e?.response?.data?.error?.message || e?.message || '上游调用失败';
        throw new RelayError(`上游错误: ${msg}`, status);
    }
    const usage = resp.data?.usage;
    const used = Number(usage?.total_tokens) || 1;
    if (rt.quotaTotal > 0) {
        rt.quotaUsed = Math.min(rt.quotaTotal, rt.quotaUsed + used);
        await rt.save();
    }
    await RelayToken_1.RelayUsage.create({
        tokenId: String(rt._id),
        licenseId: rt.licenseId,
        modelName: model || '',
        used,
    });
    return resp.data;
}
/** OpenAI 兼容：列出所有启用渠道的模型 */
async function listModels(token) {
    const rt = await RelayToken_1.RelayToken.findOne({ tokenHash: hashToken(token), status: 'active' });
    if (!rt)
        throw new RelayError('无效的令牌', 401);
    const channels = (await RelayChannel_1.RelayChannel.find({ enabled: true }).lean());
    const ids = new Set();
    for (const c of channels)
        (c.models || []).forEach((m) => ids.add(m));
    return Array.from(ids);
}
// ───────────── 中转站独立管理员密码（存数据库，首次登录即初始化） ─────────────
const RELAY_AUTH_PEPPER = process.env.RELAY_AUTH_PEPPER || 'aibak-relay-admin-pepper-v1';
function hashAdminPassword(pwd) {
    const salt = (0, crypto_1.randomBytes)(16).toString('hex');
    const derived = (0, crypto_1.scryptSync)(pwd, salt + RELAY_AUTH_PEPPER, 64).toString('hex');
    return `${salt}:${derived}`;
}
function verifyAdminPassword(pwd, stored) {
    const [salt, derived] = stored.split(':');
    if (!salt || !derived)
        return false;
    const check = (0, crypto_1.scryptSync)(pwd, salt + RELAY_AUTH_PEPPER, 64).toString('hex');
    const a = Buffer.from(derived, 'hex');
    const b = Buffer.from(check, 'hex');
    return a.length === b.length && (0, crypto_1.timingSafeEqual)(a, b);
}
async function getAdminPasswordHash() {
    const doc = await RelayConfig_1.RelayConfig.findOne({ key: 'adminPasswordHash' }).lean();
    return doc ? doc.value : null;
}
async function setAdminPassword(pwd) {
    const value = hashAdminPassword(pwd);
    await RelayConfig_1.RelayConfig.findOneAndUpdate({ key: 'adminPasswordHash' }, { key: 'adminPasswordHash', value }, { upsert: true });
}
/** 校验中转站管理员密码；若从未设置，则把本次密码作为初始密码并返回 true */
async function verifyAdminLogin(pwd) {
    const stored = await getAdminPasswordHash();
    if (!stored) {
        await setAdminPassword(pwd);
        return true;
    }
    return verifyAdminPassword(pwd, stored);
}
//# sourceMappingURL=relay.service.js.map