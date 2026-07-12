/**
 * 支付网关抽象层 —— 可扩展的商业变现基座
 *
 * - `PaymentGateway` 为统一接口，新增支付渠道只需实现该接口并在工厂注册。
 * - 内置 `MockGateway`（开发/演示，无需任何密钥即可跑通下单→支付→激活完整链路）、
 *   `WeChatPayGateway`（微信支付 v3 Native，含 HMAC-SHA256 签名）、
 *   `StripeGateway`（通过 REST 创建 PaymentIntent，无需官方 SDK）。
 * - 接入真实渠道：在 `.env` 配置对应密钥后，下单时传入 `provider` 即可切换。
 */
import crypto from 'crypto';
import axios from 'axios';

export type PaymentProvider = 'wechat' | 'stripe' | 'alipay' | 'mock';

export interface CreateOrderInput {
  orderNo: string;
  amount: number; // 分
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
  payParams: Record<string, any>;
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

/* ----------------------- 真实 Webhook 验签工具（可单测） ----------------------- */

/** Stripe 风格验签：HMAC-SHA256 over `${t}.${rawBody}`，与 Webhook Secret 比较 */
export function verifyStripeSignature(rawBody: string, header: string, secret: string): { valid: boolean; timestamp?: number } {
  const parts = header.split(',').reduce<Record<string, string>>((acc, p) => {
    const idx = p.indexOf('=');
    if (idx > -1) acc[p.slice(0, idx).trim()] = p.slice(idx + 1);
    return acc;
  }, {});
  const timestamp = parts['t'];
  const signature = parts['v1'];
  if (!timestamp || !signature) return { valid: false };
  const payload = `${timestamp}.${rawBody}`;
  const expected = crypto.createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  const sigBuf = Buffer.from(signature, 'hex');
  const expBuf = Buffer.from(expected, 'hex');
  if (sigBuf.length !== expBuf.length) return { valid: false };
  return { valid: crypto.timingSafeEqual(sigBuf, expBuf), timestamp: Number(timestamp) };
}

/** 微信支付 v3 回调报文解密（AES-256-GCM，APIv3 密钥） */
export function decryptWeChatResource(ciphertext: string, nonce: string, associatedData: string, apiV3Key: string): any {
  const key = Buffer.from(apiV3Key, 'utf8');
  const data = Buffer.from(ciphertext, 'base64');
  const authTag = data.subarray(data.length - 16);
  const cipherData = data.subarray(0, data.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(nonce, 'utf8'));
  decipher.setAuthTag(authTag);
  if (associatedData) decipher.setAAD(Buffer.from(associatedData, 'utf8'));
  const decrypted = Buffer.concat([decipher.update(cipherData), decipher.final()]);
  return JSON.parse(decrypted.toString('utf8'));
}

/** 微信支付回调签名验证（RSA-SHA256 over `${timestamp}\n${nonce}\n${body}\n`，用平台证书公钥） */
export function verifyWeChatSignature(timestamp: string, nonce: string, body: string, signature: string, publicKeyPem: string): boolean {
  const message = `${timestamp}\n${nonce}\n${body}\n`;
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(message, 'utf8');
  try {
    return verifier.verify(publicKeyPem, signature, 'base64');
  } catch {
    return false;
  }
}

/* ----------------------- 支付宝 RSA2 签名/验签工具 ----------------------- */

/** 将裸 base64 密钥补全为 PEM 格式（兼容用户直接粘贴支付宝控制台的无头密钥） */
export function normalizeAlipayPem(key: string, type: 'PRIVATE' | 'PUBLIC'): string {
  const k = (key || '').trim().replace(/\\n/g, '\n');
  if (k.includes('BEGIN')) return k;
  const header = type === 'PRIVATE' ? 'PRIVATE KEY' : 'PUBLIC KEY';
  const body = k.replace(/\s+/g, '').match(/.{1,64}/g)?.join('\n') || k;
  return `-----BEGIN ${header}-----\n${body}\n-----END ${header}-----`;
}

/** 支付宝要求北京时间（UTC+8）格式 yyyy-MM-dd HH:mm:ss */
export function alipayBeijingTimestamp(now: number = Date.now()): string {
  const d = new Date(now + 8 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
}

/** 支付宝请求签名：按 key 升序拼接 `k=v&k=v`（排除 sign 与空值），RSA-SHA256 → base64 */
export function alipaySign(params: Record<string, string>, privateKeyPem: string): string {
  const str = Object.keys(params)
    .filter((k) => k !== 'sign' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signer = crypto.createSign('RSA-SHA256');
  signer.update(str, 'utf8');
  return signer.sign(privateKeyPem, 'base64');
}

/** 支付宝异步通知验签：排除 sign / sign_type，按 key 升序拼接后用支付宝公钥验证 */
export function alipayVerify(params: Record<string, string>, publicKeyPem: string): boolean {
  const sign = params.sign;
  if (!sign) return false;
  const str = Object.keys(params)
    .filter((k) => k !== 'sign' && k !== 'sign_type' && params[k] !== '' && params[k] != null)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(str, 'utf8');
  try {
    return verifier.verify(publicKeyPem, sign, 'base64');
  } catch {
    return false;
  }
}

/* ----------------------------- Mock 网关 ----------------------------- */

class MockGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'mock';

  isConfigured() {
    // Mock 网关无需密钥；但前端不渲染 Mock 入口（listPaymentMethods 仅遍历真实渠道）
    return true;
  }


  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
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

  async verifyWebhook(): Promise<WebhookResult | null> {
    return null;
  }
}

/* --------------------------- 微信支付 v3 --------------------------- */

class WeChatPayGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'wechat';

  private get mchId() { return process.env.WECHAT_MCH_ID || ''; }
  private get appId() { return process.env.WECHAT_APP_ID || ''; }
  private get apiKey() { return process.env.WECHAT_API_V3_KEY || ''; }
  private get serialNo() { return process.env.WECHAT_CERT_SERIAL || ''; }
  private get privateKey() { return process.env.WECHAT_PRIVATE_KEY || ''; }
  /** 微信平台证书公钥（PEM），用于回调验签 */
  private get platformCert() { return process.env.WECHAT_PLATFORM_CERT || ''; }

  isConfigured() {
    return !!(this.mchId && this.apiKey && this.privateKey);
  }

  private ensureConfigured() {
    if (!this.mchId || !this.apiKey || !this.privateKey) {
      throw new Error('微信支付未配置：请在 .env 设置 WECHAT_MCH_ID / WECHAT_API_V3_KEY / WECHAT_PRIVATE_KEY');
    }
  }

  /** 生成 v3 请求签名（RSA-SHA256） */
  private buildSignature(method: string, urlPath: string, body: string, timestamp: string, nonce: string): string {
    const message = `${method}\n${urlPath}\n${timestamp}\n${nonce}\n${body}\n`;
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(message);
    return signer.sign(this.privateKey, 'base64');
  }

  private authHeader(method: string, urlPath: string, body: string): string {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID().replace(/-/g, '');
    const signature = this.buildSignature(method, urlPath, body, timestamp, nonce);
    return `WECHATPAY2-SHA256-RSA2048 mchid="${this.mchId}",nonce_str="${nonce}",signature="${signature}",timestamp="${timestamp}",serial_no="${this.serialNo}"`;
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
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
    const resp = await axios.post(`https://api.mch.weixin.qq.com${urlPath}`, body, {
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

  async verifyWebhook(rawBody: string, signature: string, extra?: WebhookExtraHeaders): Promise<WebhookResult | null> {
    try {
      // ===== 第一步：签名验证（使用微信平台证书公钥） =====
      if (this.platformCert && extra?.wechatTimestamp && extra?.wechatNonce) {
        const sigValid = verifyWeChatSignature(
          extra.wechatTimestamp,
          extra.wechatNonce,
          rawBody,
          signature,
          this.platformCert
        );
        if (!sigValid) {
          return null; // 签名验证失败，拒绝伪造回调
        }
      }
      // 注意：未配置 WECHAT_PLATFORM_CERT 时跳过验签（开发/Mock 环境兼容）

      // ===== 第二步：解析回调体并解密（如有必要） =====
      const data = JSON.parse(rawBody);
      const eventType = data?.event_type || data?.eventType || '';
      let orderNo: string | undefined;
      let transactionId: string | undefined;

      // 若回调携带密文 resource，则使用 APIv3 密钥解密（微信 v3 标准路径）
      if (data?.resource?.ciphertext && this.apiKey) {
        const res = decryptWeChatResource(
          data.resource.ciphertext,
          data.resource.nonce || '',
          data.resource.associated_data || '',
          this.apiKey
        );
        orderNo = res?.out_trade_no;
        transactionId = res?.transaction_id;
      } else {
        orderNo = data?.out_trade_no || data?.resource?.out_trade_no;
        transactionId = data?.transaction_id;
      }

      return {
        orderNo,
        success: eventType === 'TRANSACTION.SUCCESS',
        transactionId,
        eventType, // 透传事件类型到路由层：TRANSACTION.SUCCESS / REFUND.SUCCESS 等
      };
    } catch {
      return null;
    }
  }

  /** 主动查单（微信 v3：按商户订单号查询），前端轮询兜底 */
  async queryOrder(orderNo: string): Promise<QueryOrderResult> {
    if (!this.mchId || !this.privateKey) return { paid: false };
    const urlPath = `/v3/pay/transactions/out-trade-no/${encodeURIComponent(orderNo)}?mchid=${this.mchId}`;
    const resp = await axios.get(`https://api.mch.weixin.qq.com${urlPath}`, {
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

class StripeGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'stripe';
  private get secretKey() { return process.env.STRIPE_SECRET_KEY || ''; }

  isConfigured() {
    return !!this.secretKey;
  }

  private ensureConfigured() {
    if (!this.secretKey) {
      throw new Error('Stripe 未配置：请在 .env 设置 STRIPE_SECRET_KEY');
    }
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
    this.ensureConfigured();
    const resp = await axios.post(
      'https://api.stripe.com/v1/payment_intents',
      new URLSearchParams({
        amount: String(input.amount),
        currency: input.currency.toLowerCase(),
        description: input.description,
        'metadata[orderNo]': input.orderNo,
      }).toString(),
      {
        headers: {
          Authorization: `Bearer ${this.secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      }
    );
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

  async verifyWebhook(rawBody: string, signature: string): Promise<WebhookResult | null> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return null;
    const { valid } = verifyStripeSignature(rawBody, signature, secret);
    if (!valid) return null; // 验签失败：拒绝伪造回调
    try {
      const event = JSON.parse(rawBody);
      const success = event?.type === 'payment_intent.succeeded';
      return {
        orderNo: event?.data?.object?.metadata?.orderNo,
        success,
        transactionId: event?.data?.object?.id,
        eventType: event?.type, // 将事件类型透传到路由层用于区分处理
      };
    } catch {
      return null;
    }
  }
}

/* ----------------------------- 支付宝当面付 ----------------------------- */

class AlipayGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'alipay';

  private get appId() { return process.env.ALIPAY_APP_ID || ''; }
  private get privateKey() {
    return process.env.ALIPAY_PRIVATE_KEY ? normalizeAlipayPem(process.env.ALIPAY_PRIVATE_KEY, 'PRIVATE') : '';
  }
  /** 支付宝公钥（PEM/裸 base64），用于异步通知验签 */
  private get alipayPublicKey() {
    return process.env.ALIPAY_PUBLIC_KEY ? normalizeAlipayPem(process.env.ALIPAY_PUBLIC_KEY, 'PUBLIC') : '';
  }
  private get gateway() { return process.env.ALIPAY_GATEWAY || 'https://openapi.alipay.com/gateway.do'; }

  isConfigured() {
    return !!(this.appId && this.privateKey);
  }

  private ensureConfigured() {
    if (!this.appId || !this.privateKey) {
      throw new Error('支付宝未配置：请在 .env 设置 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY');
    }
  }

  /** 统一发起一次已签名的开放平台调用 */
  private async call(method: string, bizContent: Record<string, any>, withNotify = false): Promise<any> {
    const params: Record<string, string> = {
      app_id: this.appId,
      method,
      format: 'JSON',
      charset: 'utf-8',
      sign_type: 'RSA2',
      timestamp: alipayBeijingTimestamp(),
      version: '1.0',
      biz_content: JSON.stringify(bizContent),
    };
    if (withNotify) {
      params.notify_url = `${process.env.PUBLIC_BASE_URL || ''}/api/billing/webhook/alipay`;
    }
    params.sign = alipaySign(params, this.privateKey);
    const resp = await axios.post(this.gateway, new URLSearchParams(params).toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
    });
    return resp.data;
  }

  async createOrder(input: CreateOrderInput): Promise<PaymentOrderResult> {
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

  async verifyWebhook(_rawBody: string, _signature: string, extra?: WebhookExtraHeaders): Promise<WebhookResult | null> {
    const params = extra?.alipayParams;
    if (!params) return null;
    // 配置了支付宝公钥则强制验签，防伪造回调
    if (this.alipayPublicKey && !alipayVerify(params, this.alipayPublicKey)) {
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
  async queryOrder(orderNo: string): Promise<QueryOrderResult> {
    if (!this.appId || !this.privateKey) return { paid: false };
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

const gateways: Record<PaymentProvider, PaymentGateway> = {
  mock: new MockGateway(),
  wechat: new WeChatPayGateway(),
  stripe: new StripeGateway(),
  alipay: new AlipayGateway(),
};

export function getPaymentGateway(provider: PaymentProvider = 'mock'): PaymentGateway {
  return gateways[provider] || gateways.mock;
}

/** 各支付渠道展示元信息（顺序即前端展示顺序） */
export const PAYMENT_METHOD_META: { key: PaymentProvider; label: string }[] = [
  { key: 'wechat', label: '微信支付' },
  { key: 'alipay', label: '支付宝' },
  { key: 'stripe', label: 'Stripe' },
];

/** 返回各真实支付渠道的「是否已配置」状态，供前端动态展示入口（缺密钥的渠道自动隐藏） */
export function listPaymentMethods() {
  return PAYMENT_METHOD_META.map((m) => ({
    key: m.key,
    label: m.label,
    enabled: getPaymentGateway(m.key).isConfigured(),
  }));
}

export function isRealGateway(provider: PaymentProvider): boolean {
  return provider !== 'mock';
}
