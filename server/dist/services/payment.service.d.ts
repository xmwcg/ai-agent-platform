export type PaymentProvider = 'wechat' | 'stripe' | 'alipay' | 'mock';
export interface CreateOrderInput {
    orderNo: string;
    amount: number;
    currency: string;
    description: string;
    clientIp?: string;
    userOpenid?: string;
    returnUrl?: string;
}
export interface PaymentOrderResult {
    provider: PaymentProvider;
    orderNo: string;
    amount: number;
    currency: string;
    status: 'pending' | 'paid';
    /** Stripe PaymentIntent ID（pi_xxx），用于 Webhook 对账 */
    paymentIntentId?: string;
    /** 渠道相关预支付参数，前端据此拉起支付 */
    payParams: Record<string, unknown>;
    expiredAt?: number;
}
export interface WebhookResult {
    orderNo: string;
    success: boolean;
    transactionId?: string;
    /** 事件类型，用于区分成功/失败/退款事件（如 payment_intent.succeeded / TRANSACTION.SUCCESS） */
    eventType?: string;
}
export interface WebhookExtraHeaders {
    wechatTimestamp?: string;
    wechatNonce?: string;
    wechatSerial?: string;
    /** 支付宝异步通知：express.urlencoded 解析后的表单参数对象（验签用） */
    alipayParams?: Record<string, string>;
}
/** 主动查单结果（前端轮询兜底激活） */
export interface QueryOrderResult {
    paid: boolean;
    transactionId?: string;
}
export interface PaymentGateway {
    readonly name: PaymentProvider;
    createOrder(input: CreateOrderInput): Promise<PaymentOrderResult>;
    verifyWebhook(rawBody: string, signature: string, extra?: WebhookExtraHeaders): Promise<WebhookResult | null>;
    /** 可选：向渠道主动查询订单支付状态（回调延迟/未配公网时的兜底） */
    queryOrder?(orderNo: string): Promise<QueryOrderResult>;
    /** 该渠道是否已在 .env 配置真实密钥（前端据此决定是否展示入口） */
    isConfigured(): boolean;
}
export { verifyStripeSignature, decryptWeChatResource, verifyWeChatSignature, normalizeAlipayPem, alipayBeijingTimestamp, alipaySign, alipayVerify, } from './payment-crypto';
export declare function getPaymentGateway(provider?: PaymentProvider | string): PaymentGateway;
/** 各支付渠道展示元信息（顺序即前端展示顺序） */
export declare const PAYMENT_METHOD_META: {
    key: PaymentProvider;
    label: string;
}[];
/** 返回各真实支付渠道的「是否已配置」状态，供前端动态展示入口（缺密钥的渠道自动隐藏） */
export declare function listPaymentMethods(): {
    key: PaymentProvider;
    label: string;
    enabled: boolean;
}[];
export declare function isRealGateway(provider: PaymentProvider): boolean;
//# sourceMappingURL=payment.service.d.ts.map