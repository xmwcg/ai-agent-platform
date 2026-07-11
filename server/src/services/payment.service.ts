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

export type PaymentProvider = 'wechat' | 'stripe' | 'mock';

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
}

export interface PaymentGateway {
  readonly name: PaymentProvider;
  createOrder(input: CreateOrderInput): Promise<PaymentOrderResult>;
  verifyWebhook(rawBody: string, signature: string, extra?: WebhookExtraHeaders): Promise<WebhookResult | null>;
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

/* ----------------------------- Mock 网关 ----------------------------- */

class MockGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'mock';

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
  private mchId = process.env.WECHAT_MCH_ID || '';
  private appId = process.env.WECHAT_APP_ID || '';
  private apiKey = process.env.WECHAT_API_V3_KEY || '';
  private serialNo = process.env.WECHAT_CERT_SERIAL || '';
  private privateKey = process.env.WECHAT_PRIVATE_KEY || '';
  /** 微信平台证书公钥（PEM），用于回调验签 */
  private platformCert = process.env.WECHAT_PLATFORM_CERT || '';

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
}

/* ----------------------------- Stripe ----------------------------- */

class StripeGateway implements PaymentGateway {
  readonly name: PaymentProvider = 'stripe';
  private secretKey = process.env.STRIPE_SECRET_KEY || '';

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

/* ------------------------------ 工厂 ------------------------------ */

const gateways: Record<PaymentProvider, PaymentGateway> = {
  mock: new MockGateway(),
  wechat: new WeChatPayGateway(),
  stripe: new StripeGateway(),
};

export function getPaymentGateway(provider: PaymentProvider = 'mock'): PaymentGateway {
  return gateways[provider] || gateways.mock;
}

export function isRealGateway(provider: PaymentProvider): boolean {
  return provider !== 'mock';
}
