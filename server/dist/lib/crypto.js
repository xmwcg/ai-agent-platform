"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.keyFromHex = keyFromHex;
exports.encryptSecret = encryptSecret;
exports.decryptSecret = decryptSecret;
exports.isEncrypted = isEncrypted;
const crypto_1 = __importDefault(require("crypto"));
/**
 * 字段级加密工具（AES-256-GCM）
 * ----------------------------------------------------------------
 * 用途：把用户配置的第三方厂商 apiKey（ModelConfig.apiKey）以密文落库，
 *       即使数据库被拖库/备份泄露，攻击者也拿不到明文 key。
 *
 * 设计要点：
 *   - 算法 AES-256-GCM：带认证标签，能检测密文被篡改。
 *   - 密钥来自环境变量 ENCRYPTION_KEY（32 字节 = 64 个十六进制字符），
 *     由服务器保管，绝不进代码/镜像/前端。
 *   - 密文格式：enc::v1:<ivHex>:<tagHex>:<cipherHex>
 *   - 向后兼容：decrypt 遇到无前缀的明文直接原样返回（迁移期老数据不报错）。
 *   - 密钥轮换：解密时若当前 ENCRYPTION_KEY 失败，自动尝试历史密钥
 *     ENCRYPTION_KEY_PREV（或 OLD_ENCRYPTION_KEY），兼容轮换过渡期的老密文。
 */
const ALGO = 'aes-256-gcm';
const PREFIX = 'enc::v1:';
/** 将 hex 字符串规范化为 32 字节密钥 Buffer，并校验长度。 */
function normalizeKey(raw, label) {
    const buf = Buffer.from(raw, 'hex');
    if (buf.length !== 32) {
        throw new Error(`${label} 长度非法：期望 32 字节（64 个十六进制字符），实际 ${buf.length} 字节`);
    }
    return buf;
}
/** 从 hex 字符串构造密钥 Buffer（供外部脚本显式传入双密钥）。 */
function keyFromHex(hex) {
    return normalizeKey(hex, 'key');
}
function getKey() {
    const raw = process.env.ENCRYPTION_KEY;
    if (!raw) {
        throw new Error('ENCRYPTION_KEY 未配置：请在服务器 .env 设置 32 字节 hex（执行 `openssl rand -hex 32` 生成）');
    }
    return normalizeKey(raw, 'ENCRYPTION_KEY');
}
/**
 * 可选的历史密钥（轮换过渡期）。
 * 解密失败时用它再试一次，兼容尚未用新密钥重加密的老密文。
 */
function getFallbackKey() {
    const raw = process.env.ENCRYPTION_KEY_PREV || process.env.OLD_ENCRYPTION_KEY;
    if (!raw)
        return null;
    try {
        return normalizeKey(raw, 'ENCRYPTION_KEY_PREV');
    }
    catch (e) {
        loggerWarn(e.message);
        return null;
    }
}
// 避免与 lib/logger 形成循环依赖，这里仅做最简降级日志
function loggerWarn(msg) {
    // eslint-disable-next-line no-console
    console.warn(`[crypto] ${msg}`);
}
/** 加密明文。空值原样返回，避免把空串写成密文。 */
function encryptSecret(plaintext, opts) {
    if (!plaintext)
        return plaintext;
    const key = opts?.key ?? getKey();
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, key, iv);
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}
/** 用指定密钥尝试解密一次（密钥必须能匹配 GCM 认证标签）。 */
function tryDecryptOnce(payload, key) {
    const rest = payload.slice(PREFIX.length);
    const [ivHex, tagHex, cipherHex] = rest.split(':');
    if (!ivHex || !tagHex || !cipherHex) {
        throw new Error('apiKey 密文格式非法，无法解密');
    }
    const decipher = crypto_1.default.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const dec = Buffer.concat([
        decipher.update(Buffer.from(cipherHex, 'hex')),
        decipher.final(),
    ]);
    return dec.toString('utf8');
}
/**
 * 解密密文。
 *   - 无前缀的明文（迁移期老数据）原样返回。
 *   - 未显式指定密钥且当前密钥解密失败，则尝试历史密钥 ENCRYPTION_KEY_PREV。
 *   - 显式指定 key 时只使用该密钥（不回退），便于轮换脚本确定性解密。
 */
function decryptSecret(payload, opts) {
    if (!payload)
        return payload;
    if (!payload.startsWith(PREFIX)) {
        // 兼容迁移：尚未加密的历史数据按明文处理
        return payload;
    }
    if (opts?.key) {
        return tryDecryptOnce(payload, opts.key);
    }
    try {
        return tryDecryptOnce(payload, getKey());
    }
    catch (e) {
        const fallback = getFallbackKey();
        if (fallback) {
            // GCM 认证失败说明密钥不匹配，尝试历史密钥（兼容轮换过渡期）
            return tryDecryptOnce(payload, fallback);
        }
        throw e;
    }
}
/** 是否密文（用于判断是否需要解密）。 */
function isEncrypted(payload) {
    return !!payload && payload.startsWith(PREFIX);
}
//# sourceMappingURL=crypto.js.map