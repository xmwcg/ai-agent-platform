"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyStripeSignature = verifyStripeSignature;
exports.decryptWeChatResource = decryptWeChatResource;
exports.verifyWeChatSignature = verifyWeChatSignature;
exports.normalizeAlipayPem = normalizeAlipayPem;
exports.alipayBeijingTimestamp = alipayBeijingTimestamp;
exports.alipaySign = alipaySign;
exports.alipayVerify = alipayVerify;
/**
 * 支付渠道密码学 / 验签工具（纯函数，可单测）
 *
 * 从 payment.service.ts 抽取，集中管理 Stripe / 微信 / 支付宝的签名与解密逻辑，
 * 与具体支付网关实现解耦，便于复用与回归测试。
 */
const crypto_1 = __importDefault(require("crypto"));
/** Stripe 风格验签：HMAC-SHA256 over `${t}.${rawBody}`，与 Webhook Secret 比较 */
function verifyStripeSignature(rawBody, header, secret) {
    const parts = header.split(',').reduce((acc, p) => {
        const idx = p.indexOf('=');
        if (idx > -1)
            acc[p.slice(0, idx).trim()] = p.slice(idx + 1);
        return acc;
    }, {});
    const timestamp = parts['t'];
    const signature = parts['v1'];
    if (!timestamp || !signature)
        return { valid: false };
    const payload = `${timestamp}.${rawBody}`;
    const expected = crypto_1.default.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');
    if (sigBuf.length !== expBuf.length)
        return { valid: false };
    return { valid: crypto_1.default.timingSafeEqual(sigBuf, expBuf), timestamp: Number(timestamp) };
}
/** 微信支付 v3 回调报文解密（AES-256-GCM，APIv3 密钥） */
function decryptWeChatResource(ciphertext, nonce, associatedData, apiV3Key) {
    const key = Buffer.from(apiV3Key, 'utf8');
    const data = Buffer.from(ciphertext, 'base64');
    const authTag = data.subarray(data.length - 16);
    const cipherData = data.subarray(0, data.length - 16);
    const decipher = crypto_1.default.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
    decipher.setAuthTag(authTag);
    if (associatedData)
        decipher.setAAD(Buffer.from(associatedData, 'utf8'));
    const decrypted = Buffer.concat([decipher.update(cipherData), decipher.final()]);
    return JSON.parse(decrypted.toString('utf8'));
}
/** 微信支付回调签名验证（RSA-SHA256 over `${timestamp}\n${nonce}\n${body}\n`，用平台证书公钥） */
function verifyWeChatSignature(timestamp, nonce, body, signature, publicKeyPem) {
    const message = `${timestamp}\n${nonce}\n${body}\n`;
    const verifier = crypto_1.default.createVerify('RSA-SHA256');
    verifier.update(message, 'utf8');
    try {
        return verifier.verify(publicKeyPem, signature, 'base64');
    }
    catch {
        return false;
    }
}
/** 将裸 base64 密钥补全为 PEM 格式（兼容用户直接粘贴支付宝控制台的无头密钥） */
function normalizeAlipayPem(key, type) {
    const k = (key || '').trim().replace(/\\n/g, '\n');
    if (k.includes('BEGIN'))
        return k;
    const header = type === 'PRIVATE' ? 'PRIVATE KEY' : 'PUBLIC KEY';
    const body = k.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || k;
    return `-----BEGIN ${header}-----\n${body}\n-----END ${header}-----`;
}
/** 支付宝要求北京时间（UTC+8）格式 yyyy-MM-dd HH:mm:ss */
function alipayBeijingTimestamp(now = Date.now()) {
    const d = new Date(now + 8 * 3600 * 1000);
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}
/** 支付宝请求签名：按 key 升序拼接 `k=v&k=v`（排除 sign 与空值），RSA-SHA256 → base64 */
function alipaySign(params, privateKeyPem) {
    const str = Object.keys(params)
        .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
    const signer = crypto_1.default.createSign('RSA-SHA256');
    signer.update(str, 'utf8');
    return signer.sign(privateKeyPem, 'base64');
}
/** 支付宝异步通知验签：排除 sign / sign_type，按 key 升序拼接后用支付宝公钥验证 */
function alipayVerify(params, publicKeyPem) {
    const sign = params.sign;
    if (!sign)
        return false;
    const str = Object.keys(params)
        .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
        .sort()
        .map((k) => `${k}=${params[k]}`)
        .join('&');
    const verifier = crypto_1.default.createVerify('RSA-SHA256');
    verifier.update(str, 'utf8');
    try {
        return verifier.verify(publicKeyPem, sign, 'base64');
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=payment-crypto.js.map