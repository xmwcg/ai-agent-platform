/**
 * 支付 Webhook 端到端集成测试（内存 MongoDB）
 *
 * 覆盖：下单→Webhook 验签→幂等去重→订阅激活→状态查询 完整链路
 *
 * 前置：mongodb-memory-server 提供隔离的临时 MongoDB 实例
 */
import request from 'supertest';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { MongoMemoryServer } from 'mongodb-memory-server';

// 使用 jest.requireActual 获取真实 mongoose（绕过 test/setup.ts 的 mock），
// 因为 mongodb-memory-server 需要真实的 mongoose 连接
const mongoose = jest.requireActual('mongoose') as typeof import('mongoose');
import app from '../index';

let mongoServer: MongoMemoryServer;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
const BASE = '/api/billing';
let token: string;
let testUserId: string;

function isMongoClientAlreadyClosed(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;

  const candidate = error as {
    name?: unknown;
    message?: unknown;
  };

  return candidate.name === 'MongoClientClosedError'
    || (typeof candidate.message === 'string' && /client was closed/i.test(candidate.message));
}

async function disconnectTestMongoose(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;

  try {
    await mongoose.disconnect();
  } catch (error) {
    // mongodb-memory-server/Jest teardown can race with a driver-side close after
    // every request has completed. An already-closed client is the desired final
    // state; all other disconnect failures must still fail the suite.
    if (!isMongoClientAlreadyClosed(error)) throw error;
  }
}

// ═══════════════ Setup / Teardown ═══════════════

beforeAll(async () => {
  jest.setTimeout(60000);
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_integration';

  // 启动内存 MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // 断开旧连接后重连
  await disconnectTestMongoose();
  await mongoose.connect(uri);

  // 创建测试用户
  const { User } = require('../models/User');
  const user = await User.create({
    name: `whtest_${Date.now()}`,
    email: `whtest_${Date.now()}@test.com`,
    password: 'hashedPassword123',
  });
  testUserId = String(user._id);
  token = jwt.sign({ id: testUserId }, JWT_SECRET, { expiresIn: '1h' });
}, 60000);

afterAll(async () => {
  try {
    await disconnectTestMongoose();
  } finally {
    if (mongoServer) await mongoServer.stop();
  }
}, 30000);

beforeEach(async () => {
  // 清理测试数据
  const { Order } = require('../models/Order');
  const { WebhookEvent } = require('../models/WebhookEvent');
  await Order.deleteMany({});
  await WebhookEvent.deleteMany({});
});

// ═══════════════════════════════════════════════════════
// E2E-1: 完整 Mock 支付链路
// ═══════════════════════════════════════════════════════

describe('E2E-1: Mock 支付完整链路', () => {
  jest.setTimeout(15000);

  it('下单 → 模拟支付 → 订阅激活 → 状态查询 → 重复支付幂等', async () => {
    // Step 1: 创建订单
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    expect(orderRes.status).toBe(200);
    expect(orderRes.body.success).toBe(true);
    const { orderNo } = orderRes.body.data;

    // Step 2: 模拟支付
    const payRes = await request(app)
      .get(`${BASE}/orders/${orderNo}/pay`)
      .set('Authorization', `Bearer ${token}`);
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.paid).toBe(true);

    // Step 3: 查询订阅状态
    const subRes = await request(app)
      .get(`${BASE}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(subRes.status).toBe(200);
    expect(subRes.body.data.plan).toBe('pro');
    expect(subRes.body.data.expired).toBe(false);
    // 积分应为 pro 套餐赠送的 500+
    expect(subRes.body.data.credits).toBeGreaterThanOrEqual(500);

    // Step 4: 重复支付同一订单 → alreadyPaid
    const payAgainRes = await request(app)
      .get(`${BASE}/orders/${orderNo}/pay`)
      .set('Authorization', `Bearer ${token}`);
    expect(payAgainRes.status).toBe(200);
    expect(payAgainRes.body.data.alreadyPaid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// E2E-2: Stripe Webhook 验签 + 幂等去重
// ═══════════════════════════════════════════════════════

describe('E2E-2: Stripe Webhook 验签与幂等', () => {
  jest.setTimeout(15000);

  it('合法 Stripe Webhook → 验签通过 → 激活订阅', async () => {
    // 用 mock 网关创建订单（无需真实 Stripe 密钥），然后发 Stripe 格式 webhook
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    // 构造合法 Stripe 签名
    const eventBody = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test_001', metadata: { orderNo } } },
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${eventBody}`).digest('hex');

    // 发送 Webhook
    const whRes = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${ts},v1=${sig}`)
      .send(eventBody);
    expect(whRes.status).toBe(200);

    // 验证订阅激活
    const subRes = await request(app)
      .get(`${BASE}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(subRes.body.data.plan).toBe('pro');

    // 验证 WebhookEvent 已记录
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    expect(events.some((e: any) => e.status === 'processed')).toBe(true);
  });

  it('同一 Webhook 事件重复发送 → 幂等跳过', async () => {
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    const eventBody = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_idempotent_001', metadata: { orderNo } } },
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${eventBody}`).digest('hex');
    const sigHeader = `t=${ts},v1=${sig}`;

    // 第一次
    await request(app).post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sigHeader)
      .send(eventBody);
    // 第二次
    const whRes2 = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', sigHeader)
      .send(eventBody);
    expect(whRes2.body.idempotent).toBe(true);

    // 应只有一个 processed 事件（eventId 唯一索引，重复回调不重复记录）
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    expect(events.filter((e: any) => e.status === 'processed').length).toBe(1);
    // 总数应为 1（不是 2），因为同一 eventId 的重复回调不再创建新记录
    expect(events.length).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════
// E2E-3: 畸形容错（不崩溃、不泄密）
// ═══════════════════════════════════════════════════════

describe('E2E-3: Webhook 畸形容错', () => {
  jest.setTimeout(15000);

  it('缺少签名 → 200，不激活', async () => {
    const res = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'payment_intent.succeeded' }));
    expect(res.status).toBe(200);
  });

  it('无效签名 → 200，不激活', async () => {
    const res = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', 't=1000,v1=deadbeef')
      .send(JSON.stringify({ type: 'payment_intent.succeeded' }));
    expect(res.status).toBe(200);
  });

  it('Webhook 携带不存在的订单号 → 记录失败，不崩溃', async () => {
    const eventBody = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_nonexistent', metadata: { orderNo: 'AI_GHOST_ORDER' } } },
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${eventBody}`).digest('hex');

    const res = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${ts},v1=${sig}`)
      .send(eventBody);
    expect(res.status).toBe(200);

    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo: 'AI_GHOST_ORDER' });
    expect(events.some((e: any) => e.status === 'failed')).toBe(true);
  });

  it('已支付订单再次接收 Webhook → 跳过', async () => {
    // 先通过 Mock 创建并支付
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;
    await request(app).get(`${BASE}/orders/${orderNo}/pay`).set('Authorization', `Bearer ${token}`);

    // 再用 Stripe Webhook 尝试回调同一订单
    const eventBody = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_already_paid', metadata: { orderNo } } },
    });
    const ts = Math.floor(Date.now() / 1000).toString();
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const sig = crypto.createHmac('sha256', secret).update(`${ts}.${eventBody}`).digest('hex');

    const res = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${ts},v1=${sig}`)
      .send(eventBody);
    expect(res.status).toBe(200);
    expect(res.body.alreadyPaid).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════
// E2E-4: 重放攻击防护（时间戳过期）
// ═══════════════════════════════════════════════════════

describe('E2E-4: 重放攻击防护', () => {
  jest.setTimeout(15000);

  it('过期时间戳（>5 分钟）→ 拒绝并记录 skipped', async () => {
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    // 10 分钟前的时间戳
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const eventBody = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_replay_001', metadata: { orderNo } } },
    });
    const secret = process.env.STRIPE_WEBHOOK_SECRET!;
    const sig = crypto.createHmac('sha256', secret).update(`${oldTs}.${eventBody}`).digest('hex');

    const res = await request(app)
      .post(`${BASE}/webhook/stripe`)
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${oldTs},v1=${sig}`)
      .send(eventBody);
    expect(res.status).toBe(200);

    // 验证 skipped 事件记录了重放原因
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    const replayed = events.filter((e: any) => e.status === 'skipped' && e.errorMessage?.includes('重放攻击'));
    expect(replayed.length).toBeGreaterThanOrEqual(1);

    // 订单仍为 pending
    const { Order } = require('../models/Order');
    const order = await Order.findOne({ orderNo });
    expect(order?.status).toBe('pending');
  });
});

// ═══════════════════════════════════════════════════════
// E2E-5: 微信支付 Webhook 验签 + 解密 + 激活（端到端）
// ═══════════════════════════════════════════════════════

describe('E2E-5: 微信支付 Webhook 验签与幂等', () => {
  jest.setTimeout(15000);

  let wechatKeyPair: { publicKey: string; privateKey: string };
  const API_V3_KEY = 'A'.repeat(32); // 32 字节 APIv3 密钥
  const MCH_ID = '1900000001';

  beforeAll(() => {
    // 生成 RSA 密钥对用于签名/验签
    wechatKeyPair = crypto.generateKeyPairSync('rsa', {
      modulusLength: 2048,
      publicKeyEncoding: { type: 'spki', format: 'pem' },
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    });
  });

  /** 构造微信支付 v3 回调的密文 resource */
  function encryptWeChatResource(plaintext: string, nonce: string, associated: string): string {
    const cipher = crypto.createCipheriv(
      'aes-256-gcm',
      Buffer.from(API_V3_KEY, 'utf8'),
      Buffer.from(nonce, 'utf8')
    );
    if (associated) cipher.setAAD(Buffer.from(associated, 'utf8'));
    const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([enc, tag]).toString('base64');
  }

  /** 生成微信支付 v3 回调签名 */
  function signWeChatPayload(rawBody: string, timestamp: string, nonce: string): string {
    const signer = crypto.createSign('RSA-SHA256');
    signer.update(`${timestamp}\n${nonce}\n${rawBody}\n`);
    return signer.sign(wechatKeyPair.privateKey, 'base64');
  }

  it('合法微信 Webhook → 验签通过 + 解密成功 → 激活订阅', async () => {
    // 配置平台证书用于验签
    process.env.WECHAT_PLATFORM_CERT = wechatKeyPair.publicKey;
    process.env.WECHAT_API_V3_KEY = API_V3_KEY;

    // 用 mock 创建订单
    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    // 构造微信回调密文
    const innerJson = JSON.stringify({
      out_trade_no: orderNo,
      transaction_id: `WX_TXN_${Date.now()}`,
      trade_state: 'SUCCESS',
    });
    const resourceNonce = crypto.randomBytes(12).toString('base64').substring(0, 12);
    const associated = 'transaction';
    const ciphertext = encryptWeChatResource(innerJson, resourceNonce, associated);

    const callbackBody = JSON.stringify({
      id: `evt_${Date.now()}`,
      create_time: new Date().toISOString(),
      resource_type: 'encrypt-resource',
      event_type: 'TRANSACTION.SUCCESS',
      summary: '支付成功',
      resource: {
        original_type: 'transaction',
        algorithm: 'AEAD_AES_256_GCM',
        ciphertext,
        associated_data: associated,
        nonce: resourceNonce,
      },
    });

    // 生成微信签名
    const ts = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const wechatSig = signWeChatPayload(callbackBody, ts, nonceStr);

    // 发送 Webhook
    const whRes = await request(app)
      .post(`${BASE}/webhook/wechat`)
      .set('Content-Type', 'application/json')
      .set('wechatpay-timestamp', ts)
      .set('wechatpay-nonce', nonceStr)
      .set('wechatpay-signature', wechatSig)
      .set('wechatpay-serial', 'SERIAL_001')
      .send(callbackBody);
    expect(whRes.status).toBe(200);

    // 验证订阅激活
    const subRes = await request(app)
      .get(`${BASE}/subscription`)
      .set('Authorization', `Bearer ${token}`);
    expect(subRes.body.data.plan).toBe('pro');

    // 验证 WebhookEvent 已记录
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    expect(events.some((e: any) => e.status === 'processed')).toBe(true);

    // 清理环境
    delete process.env.WECHAT_PLATFORM_CERT;
    delete process.env.WECHAT_API_V3_KEY;
  });

  it('微信签名错误 → 拒绝，不激活', async () => {
    // 设置公钥使验签会执行
    process.env.WECHAT_PLATFORM_CERT = wechatKeyPair.publicKey;
    process.env.WECHAT_API_V3_KEY = API_V3_KEY;

    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    const innerJson = JSON.stringify({
      out_trade_no: orderNo,
      transaction_id: `WX_FAKE_${Date.now()}`,
    });
    const resourceNonce = crypto.randomBytes(12).toString('base64').substring(0, 12);
    const ciphertext = encryptWeChatResource(innerJson, resourceNonce, 'transaction');

    const callbackBody = JSON.stringify({
      id: `evt_bad_${Date.now()}`,
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext, associated_data: 'transaction', nonce: resourceNonce },
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '');
    // 使用错误签名
    const badSig = signWeChatPayload('{"fake":true}', ts, nonceStr);

    const whRes = await request(app)
      .post(`${BASE}/webhook/wechat`)
      .set('Content-Type', 'application/json')
      .set('wechatpay-timestamp', ts)
      .set('wechatpay-nonce', nonceStr)
      .set('wechatpay-signature', badSig)
      .set('wechatpay-serial', 'SERIAL_FAKE')
      .send(callbackBody);
    expect(whRes.status).toBe(200);

    // 订单仍为 pending
    const { Order } = require('../models/Order');
    const order = await Order.findOne({ orderNo });
    expect(order?.status).toBe('pending');

    delete process.env.WECHAT_PLATFORM_CERT;
    delete process.env.WECHAT_API_V3_KEY;
  });

  it('微信重复回调同一事件 → 幂等跳过', async () => {
    process.env.WECHAT_PLATFORM_CERT = wechatKeyPair.publicKey;
    process.env.WECHAT_API_V3_KEY = API_V3_KEY;

    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;
    const txnId = `WX_IDEM_${Date.now()}`;

    const innerJson = JSON.stringify({
      out_trade_no: orderNo,
      transaction_id: txnId,
    });
    const resourceNonce = crypto.randomBytes(12).toString('base64').substring(0, 12);
    const ciphertext = encryptWeChatResource(innerJson, resourceNonce, 'transaction');

    const callbackBody = JSON.stringify({
      id: `evt_${Date.now()}`,
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext, associated_data: 'transaction', nonce: resourceNonce },
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const nonceStr = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const wechatSig = signWeChatPayload(callbackBody, ts, nonceStr);

    // 第一次
    await request(app)
      .post(`${BASE}/webhook/wechat`)
      .set('Content-Type', 'application/json')
      .set('wechatpay-timestamp', ts)
      .set('wechatpay-nonce', nonceStr)
      .set('wechatpay-signature', wechatSig)
      .set('wechatpay-serial', 'SERIAL_001')
      .send(callbackBody);

    // 第二次（幂等）
    const whRes2 = await request(app)
      .post(`${BASE}/webhook/wechat`)
      .set('Content-Type', 'application/json')
      .set('wechatpay-timestamp', ts)
      .set('wechatpay-nonce', nonceStr)
      .set('wechatpay-signature', wechatSig)
      .set('wechatpay-serial', 'SERIAL_001')
      .send(callbackBody);
    expect(whRes2.body.idempotent).toBe(true);

    // 应只有一个 processed
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    expect(events.filter((e: any) => e.status === 'processed').length).toBe(1);

    delete process.env.WECHAT_PLATFORM_CERT;
    delete process.env.WECHAT_API_V3_KEY;
  });

  it('微信过期时间戳 → 重放攻击防护跳过', async () => {
    process.env.WECHAT_PLATFORM_CERT = wechatKeyPair.publicKey;
    process.env.WECHAT_API_V3_KEY = API_V3_KEY;

    const orderRes = await request(app)
      .post(`${BASE}/orders`)
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider: 'mock' });
    const { orderNo } = orderRes.body.data;

    const innerJson = JSON.stringify({
      out_trade_no: orderNo,
      transaction_id: `WX_OLD_${Date.now()}`,
    });
    const resourceNonce = crypto.randomBytes(12).toString('base64').substring(0, 12);
    const ciphertext = encryptWeChatResource(innerJson, resourceNonce, 'transaction');

    const callbackBody = JSON.stringify({
      id: `evt_old_${Date.now()}`,
      event_type: 'TRANSACTION.SUCCESS',
      resource: { ciphertext, associated_data: 'transaction', nonce: resourceNonce },
    });

    // 10 分钟前的时间戳
    const oldTs = String(Math.floor(Date.now() / 1000) - 600);
    const nonceStr = crypto.randomUUID().replace(/-/g, '').substring(0, 32);
    const wechatSig = signWeChatPayload(callbackBody, oldTs, nonceStr);

    const whRes = await request(app)
      .post(`${BASE}/webhook/wechat`)
      .set('Content-Type', 'application/json')
      .set('wechatpay-timestamp', oldTs)
      .set('wechatpay-nonce', nonceStr)
      .set('wechatpay-signature', wechatSig)
      .set('wechatpay-serial', 'SERIAL_001')
      .send(callbackBody);
    expect(whRes.status).toBe(200);

    // 订单仍为 pending
    const { Order } = require('../models/Order');
    const order = await Order.findOne({ orderNo });
    expect(order?.status).toBe('pending');

    // 验证 skipped 事件
    const { WebhookEvent } = require('../models/WebhookEvent');
    const events = await WebhookEvent.find({ orderNo });
    const skipped = events.filter((e: any) => e.status === 'skipped' && e.errorMessage?.includes('重放攻击'));
    expect(skipped.length).toBeGreaterThanOrEqual(1);

    delete process.env.WECHAT_PLATFORM_CERT;
    delete process.env.WECHAT_API_V3_KEY;
  });
});
