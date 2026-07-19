"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 媒体生成 BYOK（用户自带 Key）管理接口
 * ----------------------------------------------------------------
 * 登录用户在此保存/查看/删除自己的媒体厂商凭据（混元/可灵/即梦）。
 * 凭据以 AES-256-GCM 密文落库（复用 lib/crypto），接口永不返回明文，
 * 仅返回掩码（如 sk-ab****12cd）供用户确认。
 *
 * 与平台垫付模式的关系：
 *   - 用户配置了启用中的 BYOK key 后，文生图 /generate 会自动优先走用户 Key，
 *     平台零垫付（配额/成本阀门自动 bypass）。
 *   - 删除或禁用 key 后，自动回落平台垫付（受既有配额/成本阀门约束）。
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const MediaUserKey_1 = require("../models/MediaUserKey");
const crypto_1 = require("../lib/crypto");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
const VALID_PROVIDERS = ['hunyuan', 'keling', 'jimeng'];
/** 凭据掩码：保留首尾各 4 位，中间打码，避免明文泄露 */
function maskKey(plain) {
    if (!plain)
        return '';
    if (plain.length <= 8)
        return '****';
    return `${plain.slice(0, 4)}****${plain.slice(-4)}`;
}
/** 列出当前用户已配置的媒体 Key（掩码，无明文） */
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const docs = await MediaUserKey_1.MediaUserKey.find({ userId }).lean();
        const data = docs.map((d) => {
            let secretKeyMask = '';
            let secretIdMask = '';
            try {
                secretKeyMask = maskKey((0, crypto_1.decryptSecret)(d.secretKeyEnc));
            }
            catch { /* 解密失败不阻塞列表 */ }
            if (d.secretIdEnc) {
                try {
                    secretIdMask = maskKey((0, crypto_1.decryptSecret)(d.secretIdEnc));
                }
                catch { /* 忽略 */ }
            }
            return {
                provider: d.provider,
                enabled: d.enabled,
                secretIdMask,
                secretKeyMask,
                updatedAt: d.updatedAt,
            };
        });
        res.json({ success: true, data });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/**
 * 保存/更新某厂商的 BYOK Key（upsert）。
 * body: { provider, secretKey(必填), secretId?(混元需要), enabled? }
 */
router.put('/', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider, secretId, secretKey, enabled } = req.body || {};
        if (!VALID_PROVIDERS.includes(provider)) {
            return res.status(400).json({ success: false, error: '不支持的媒体厂商', valid: VALID_PROVIDERS });
        }
        if (!secretKey || !String(secretKey).trim()) {
            return res.status(400).json({ success: false, error: 'secretKey 不能为空' });
        }
        const doc = await MediaUserKey_1.MediaUserKey.findOneAndUpdate({ userId, provider }, {
            $set: {
                secretIdEnc: secretId ? (0, crypto_1.encryptSecret)(String(secretId)) : null,
                secretKeyEnc: (0, crypto_1.encryptSecret)(String(secretKey)),
                enabled: enabled !== false,
            },
        }, { upsert: true, new: true, setDefaultsOnInsert: true });
        res.json({
            success: true,
            data: { provider: doc.provider, enabled: doc.enabled, updatedAt: doc.updatedAt },
            message: '已保存（密文落库，明文不存储）',
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 删除某厂商的 BYOK Key（回落平台垫付） */
router.delete('/:provider', auth_1.requireAuth, async (req, res) => {
    try {
        const userId = req.user.id;
        const { provider } = req.params;
        if (!VALID_PROVIDERS.includes(provider)) {
            return res.status(400).json({ success: false, error: '不支持的媒体厂商', valid: VALID_PROVIDERS });
        }
        const r = await MediaUserKey_1.MediaUserKey.deleteOne({ userId, provider });
        res.json({ success: true, deleted: r.deletedCount > 0 });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=media-byok.js.map