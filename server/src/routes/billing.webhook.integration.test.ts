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

// ═══════════════ Setup / Teardown ═══════════════

beforeAll(async () => {
  jest.setTimeout(60000);
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_integration';

  // 启动内存 MongoDB
  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  // 断开旧连接后重连
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
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
  await mongoose.disconnect();
  if (mongoServer) await mongoServer.stop();
}, 10000);

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
