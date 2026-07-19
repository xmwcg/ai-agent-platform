"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PAYMENT_METHOD_META = exports.alipayVerify = exports.alipaySign = exports.alipayBeijingTimestamp = exports.normalizeAlipayPem = exports.verifyWeChatSignature = exports.decryptWeChatResource = exports.verifyStripeSignature = void 0;
exports.getPaymentGateway = getPaymentGateway;
exports.listPaymentMethods = listPaymentMethods;
exports.isRealGateway = isRealGateway;
/**
 * 支付网关抽象层 —— 可扩展的商业变现基座
 *
 * - `PaymentGateway` 为统一接口，新增支付渠道只需实现该接口并在工厂注册。
 * - 内置 `MockGateway`（开发/演示，无需任何密钥即可跑通下单→支付→激活完整链路）、
 *   `WeChatPayGateway`（微信支付 v3 Native，含 HMAC-SHA256 签名）、
 *   `StripeGateway`（通过 REST 创建 PaymentIntent，无需官方 SDK）。
 * - 接入真实渠道：在 `.env` 配置对应密钥后，下单时传入 `provider` 即可切换。
 */
const crypto_1 = __importDefault(require("crypto"));
const axios_1 = __importDefault(require("axios"));
// 验签 / 解密纯函数已抽取至 payment-crypto.ts（与网关实现解耦，便于复用与单测）
const payment_crypto_1 = require("./payment-crypto");
// 保持对外导出兼容：billing 路由与既有测试仍从 payment.service 引入这些函数
var payment_crypto_2 = require("./payment-crypto");
Object.defineProperty(exports, "verifyStripeSignature", { enumerable: true, get: function () { return payment_crypto_2.verifyStripeSignature; } });
Object.defineProperty(exports, "decryptWeChatResource", { enumerable: true, get: function () { return payment_crypto_2.decryptWeChatResource; } });
Object.defineProperty(exports, "verifyWeChatSignature", { enumerable: true, get: function () { return payment_crypto_2.verifyWeChatSignature; } });
Object.defineProperty(exports, "normalizeAlipayPem", { enumerable: true, get: function () { return payment_crypto_2.normalizeAlipayPem; } });
Object.defineProperty(exports, "alipayBeijingTimestamp", { enumerable: true, get: function () { return payment_crypto_2.alipayBeijingTimestamp; } });
Object.defineProperty(exports, "alipaySign", { enumerable: true, get: function () { return payment_crypto_2.alipaySign; } });
Object.defineProperty(exports, "alipayVerify", { enumerable: true, get: function () { return payment_crypto_2.alipayVerify; } });
/* ----------------------------- Mock 网关 ----------------------------- */
class MockGateway {
    constructor() {
        this.name = 'mock';
    }
    isConfigured() {
        // Mock 网关无需密钥；但前端不渲染 Mock 入口（listPaymentMethods 仅遍历真实渠道）
        return true;
    }
    async createOrder(input) {
        return {
            provider: 'mock',
            orderNo: input.orderNo,
            amount: input.amount,
            currency: input.currency,
            status: 'pending',
            payParams: {
                // 前端点击该地址即视为「支付成功」
                payUrl: `/api/billing/orders/${input.orderNo}/pay`,
                method: 'GET',
            },
        };
    }
    async verifyWebhook() {
        return null;
    }
}
/* --------------------------- 微信支付 v3 --------------------------- */
class WeChatPayGateway {
    constructor() {
        this.name = 'wechat';
    }
    get mchId() { return process.env.WECHAT_MCH_ID || ''; }
    get appId() { return process.env.WECHAT_APP_ID || ''; }
    get apiKey() { return process.env.WECHAT_API_V3_KEY || ''; }
    get serialNo() { return process.env.WECHAT_CERT_SERIAL || ''; }
    get privateKey() { return process.env.WECHAT_PRIVATE_KEY || ''; }
    /** 微信平台证书公钥（PEM），用于回调验签 */
    get platformCert() { return process.env.WECHAT_PLATFORM_CERT || ''; }
    isConfigured() {
        const baseConfigured = !!(this.mchId
            && this.appId
            && this.apiKey
            && this.serialNo
            && this.privateKey);
        return process.env.NODE_ENV === 'production'
            ? baseConfigured && !!this.platformCert
            : baseConfigured;
    }
    ensureConfigured() {
        const required = [
            ['WECHAT_MCH_ID', this.mchId],
            ['WECHAT_APP_ID', this.appId],
            ['WECHAT_API_V3_KEY', this.apiKey],
            ['WECHAT_CERT_SERIAL', this.serialNo],
            ['WECHAT_PRIVATE_KEY', this.privateKey],
        ];
        if (process.env.NODE_ENV === 'production') {
            required.push(['WECHAT_PLATFORM_CERT', this.platformCert]);
        }
        const missing = required.filter(([, value]) => !value).map(([key]) => key);
        if (missing.length > 0) {
            throw new Error(`微信支付未配置完整：缺少 ${missing.join(' / ')}`);
        }
    }
    platformCertificateSerial() {
        if (!this.platformCert)
            return null;
        try {
            return new crypto_1.default.X509Certificate(this.platformCert).serialNumber.replace(/:/g, '').toUpperCase();
        }
        catch {
            return null;
        }
    }
    /** 生成 v3 请求签名（RSA-SHA256） */
    buildSignature(method, urlPath, body, timestamp, nonce) {
        const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
        const signer = crypto_1.default.createSign('RSA-SHA256');
        signer.update(message);
        return signer.sign(this.privateKey, 'base64');
    }
    authHeader(method, urlPath, body) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto_1.default.randomUUID().replace(/-/g, '');
        const signature = this.buildSignature(method, urlPath, body, timestamp, nonce);
        return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`;
    }
    async createOrder(input) {
        this.ensureConfigured();
        const urlPath = '/v3/pay/transactions/native';
        const body = JSON.stringify({
            appid: this.appId,
            mchid: this.mchId,
            description: input.description,
            out_trade_no: input.orderNo,
            notify_url: `${process.env.PUBLIC_BASE_URL || ''}/api/billing/webhook/wechat`,
            time_expire: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
            amount: { total: input.amount, currency: input.currency },
        });
        const resp = await axios_1.default.post(`https://api.mch.weixin.qq.com${urlPath}`, body, {
            headers: {
                Authorization: this.authHeader('POST', urlPath, body),
                'Content-Type': 'application/json',
                Accept: 'application/json',
            },
        });
        return {
            provider: 'wechat',
            orderNo: input.orderNo,
            amount: input.amount,
            currency: input.currency,
            status: 'pending',
            payParams: { codeUrl: resp.data.code_url },
        };
    }
    async verifyWebhook(rawBody, signature, extra) {
        try {
            // ===== 第一步：签名验证（使用微信平台证书公钥） =====
            const production = process.env.NODE_ENV === 'production';
            const timestamp = extra?.wechatTimestamp || '';
            const nonce = extra?.wechatNonce || '';
            const serial = (extra?.wechatSerial || '').replace(/:/g, '').toUpperCase();
            const platformSerial = this.platformCertificateSerial();
            if (production && (!signature || !timestamp || !nonce || !serial || !this.platformCert || !platformSerial)) {
                return null;
            }
            if (production && serial !== platformSerial) {
                return null;
            }
            if (production) {
                const signedAt = Number(timestamp);
                const now = Math.floor(Date.now() / 1000);
                if (!Number.isFinite(signedAt) || Math.abs(now - signedAt) > 300) {
                    return null;
                }
            }
            if (this.platformCert) {
                if (!timestamp || !nonce || !signature)
                    return null;
                const sigValid = (0, payment_crypto_1.verifyWeChatSignature)(timestamp, nonce, rawBody, signature, this.platformCert);
                if (!sigValid)
                    return null;
            }
            else if (production) {
                return null;
            }
            // ===== 第二步：解析回调体并解密（如有必要） =====
            const data = JSON.parse(rawBody);
            const eventType = data?.event_type || data?.eventType || '';
            let orderNo;
            let transactionId;
            // 若回调携带密文 resource，则使用 APIv3 密钥解密（微信 v3 标准路径）
            if (data?.resource?.ciphertext && this.apiKey) {
                const res = (0, payment_crypto_1.decryptWeChatResource)(data.resource.ciphertext, data.resource.nonce || '', data.resource.associated_data || '', this.apiKey);
                orderNo = res?.out_trade_no;
                transactionId = res?.transaction_id;
            }
            else {
                orderNo = data?.out_trade_no || data?.resource?.out_trade_no;
                transactionId = data?.transaction_id;
            }
            return {
                orderNo,
                success: eventType === 'TRANSACTION.SUCCESS',
                transactionId,
                eventType, // 透传事件类型到路由层：TRANSACTION.SUCCESS / REFUND.SUCCESS 等
            };
        }
        catch {
            return null;
        }
    }
    /** 主动查单（微信 v3：按商户订单号查询），前端轮询兜底 */
    async queryOrder(orderNo) {
        if (!this.mchId || !this.privateKey)
            return { paid: false };
        const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${this.mchId}`;
        const resp = await axios_1.default.get(`https://api.mch.weixin.qq.com${urlPath}`, {
            headers: {
                Authorization: this.authHeader('GET', urlPath, ''),
                Accept: 'application/json',
            },
        });
        const state = resp.data?.trade_state;
        return { paid: state === 'SUCCESS', transactionId: resp.data?.transaction_id };
    }
}
/* ----------------------------- Stripe ----------------------------- */
class StripeGateway {
    constructor() {
        this.name = 'stripe';
    }
    get secretKey() { return process.env.STRIPE_SECRET_KEY || ''; }
    isConfigured() {
        return !!this.secretKey;
    }
    ensureConfigured() {
        if (!this.secretKey) {
            throw new Error('Stripe 未配置：请在 .env 设置 STRIPE_SECRET_KEY');
        }
    }
    async createOrder(input) {
        this.ensureConfigured();
        const resp = await axios_1.default.post('https://api.stripe.com/v1/payment_intents', new URLSearchParams({
            amount: String(input.amount),
            currency: input.currency.toLowerCase(),
            description: input.description,
            'metadata[orderNo]': input.orderNo,
        }).toString(), {
            headers: {
                Authorization: `Bearer ${this.secretKey}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });
        return {
            provider: 'stripe',
            orderNo: input.orderNo,
            amount: input.amount,
            currency: input.currency,
            status: 'pending',
            paymentIntentId: resp.data.id,
            payParams: { clientSecret: resp.data.client_secret },
        };
    }
    async verifyWebhook(rawBody, signature) {
        const secret = process.env.STRIPE_WEBHOOK_SECRET;
        if (!secret)
            return null;
        const { valid } = (0, payment_crypto_1.verifyStripeSignature)(rawBody, signature, secret);
        if (!valid)
            return null; // 验签失败：拒绝伪造回调
        try {
            const event = JSON.parse(rawBody);
            const success = event?.type === 'payment_intent.succeeded';
            return {
                orderNo: event?.data?.object?.metadata?.orderNo,
                success,
                transactionId: event?.data?.object?.id,
                eventType: event?.type, // 将事件类型透传到路由层用于区分处理
            };
        }
        catch {
            return null;
        }
    }
}
/* ----------------------------- 支付宝当面付 ----------------------------- */
class AlipayGateway {
    constructor() {
        this.name = 'alipay';
    }
    get appId() { return process.env.ALIPAY_APP_ID || ''; }
    get privateKey() {
        return process.env.ALIPAY_PRIVATE_KEY ? (0, payment_crypto_1.normalizeAlipayPem)(process.env.ALIPAY_PRIVATE_KEY, 'PRIVATE') : '';
    }
    /** 支付宝公钥（PEM/裸 base64），用于异步通知验签 */
    get alipayPublicKey() {
        return process.env.ALIPAY_PUBLIC_KEY ? (0, payment_crypto_1.normalizeAlipayPem)(process.env.ALIPAY_PUBLIC_KEY, 'PUBLIC') : '';
    }
    get gateway() { return process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'; }
    isConfigured() {
        return !!(this.appId && this.privateKey);
    }
    ensureConfigured() {
        if (!this.appId || !this.privateKey) {
            throw new Error('支付宝未配置：请在 .env 设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY');
        }
    }
    /** 统一发起一次已签名的开放平台调用 */
    async call(method, bizContent, withNotify = false) {
        const params = {
            app_id: this.appId,
            method,
            format: 'JSON',
            charset: 'utf-8',
            sign_type: 'RSA2',
            timestamp: (0, payment_crypto_1.alipayBeijingTimestamp)(),
            version: '1.0',
            biz_content: JSON.stringify(bizContent),
        };
        if (withNotify) {
            params.notify_url = `${process.env.PUBLIC_BASE_URL || ''}/api/billing/webhook/alipay`;
        }
        params.sign = (0, payment_crypto_1.alipaySign)(params, this.privateKey);
        const resp = await axios_1.default.post(this.gateway, new URLSearchParams(params).toString(), {
            headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
        });
        return resp.data;
    }
    async createOrder(input) {
        this.ensureConfigured();
        const data = await this.call('alipay.trade.precreate', {
            out_trade_no: input.orderNo,
            total_amount: (input.amount / 100).toFixed(2), // 元，两位小数
            subject: input.description,
        }, true);
        const node = data?.alipay_trade_precreate_response;
        if (!node || node.code !== '10000' || !node.qr_code) {
            throw new Error(`支付宝下单失败：${node?.sub_msg || node?.msg || 'unknown'}`);
        }
        return {
            provider: 'alipay',
            orderNo: input.orderNo,
            amount: input.amount,
            currency: input.currency,
            status: 'pending',
            payParams: { qrCode: node.qr_code },
        };
    }
    async verifyWebhook(_rawBody, _signature, extra) {
        const params = extra?.alipayParams;
        if (!params)
            return null;
        // 配置了支付宝公钥则强制验签，防伪造回调
        if (this.alipayPublicKey && !(0, payment_crypto_1.alipayVerify)(params, this.alipayPublicKey)) {
            return null;
        }
        const status = params.trade_status;
        return {
            orderNo: params.out_trade_no,
            success: status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED',
            transactionId: params.trade_no,
            eventType: status,
        };
    }
    /** 主动查单（alipay.trade.query），前端轮询兜底 */
    async queryOrder(orderNo) {
        if (!this.appId || !this.privateKey)
            return { paid: false };
        const data = await this.call('alipay.trade.query', { out_trade_no: orderNo });
        const node = data?.alipay_trade_query_response;
        const status = node?.trade_status;
        return {
            paid: status === 'TRADE_SUCCESS' || status === 'TRADE_FINISHED',
            transactionId: node?.trade_no,
        };
    }
}
/* ------------------------------ 工厂 ------------------------------ */
const gateways = {
    mock: new MockGateway(),
    wechat: new WeChatPayGateway(),
    stripe: new StripeGateway(),
    alipay: new AlipayGateway(),
};
function getPaymentGateway(provider) {
    const selected = provider || (process.env.NODE_ENV === 'production' ? 'wechat' : 'mock');
    if (!(selected in gateways)) {
        throw new Error(`不支持的支付渠道: ${selected}`);
    }
    if (process.env.NODE_ENV === 'production' && selected !== 'wechat') {
        throw new Error('生产环境仅允许微信支付');
    }
    return gateways[selected];
}
/** 各支付渠道展示元信息（顺序即前端展示顺序） */
exports.PAYMENT_METHOD_META = [
    { key: 'wechat', label: '微信支付' },
    { key: 'alipay', label: '支付宝' },
    { key: 'stripe', label: 'Stripe' },
];
/** 返回各真实支付渠道的「是否已配置」状态，供前端动态展示入口（缺密钥的渠道自动隐藏） */
function listPaymentMethods() {
    const methods = process.env.NODE_ENV === 'production'
        ? exports.PAYMENT_METHOD_META.filter((method) => method.key === 'wechat')
        : exports.PAYMENT_METHOD_META;
    return methods.map((m) => ({
        key: m.key,
        label: m.label,
        enabled: getPaymentGateway(m.key).isConfigured(),
    }));
}
function isRealGateway(provider) {
    return provider !== 'mock';
}
//# sourceMappingURL=payment.service.js.map