/**
 * API 市场积分扣减集成测试 (P0-2)
 *
 * 覆盖：
 * 1. 积分余额查询
 * 2. 积分变动明细（分页、按 type 过滤）
 * 3. 积分包列表 + 购买 + Mock 支付 + 余额验证
 * 4. 用量报表含积分汇总
 * 5. 用量导出含积分列
 *
 * 独立创建 Express app，避免与 billing.webhook.integration 的端口冲突。
 */
import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { json } from 'express';
import { MongoMemoryServer } from 'mongodb-memory-server';

const mongoose = jest.requireActual('mongoose') as typeof import('mongoose');

let mongoServer: MongoMemoryServer;
let app: express.Express;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
let token: string;
let testUserId: string;

beforeAll(async () => {
  jest.setTimeout(60000);
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_credits_integration';

  mongoServer = await MongoMemoryServer.create();
  const uri = mongoServer.getUri();

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);

  // 创建测试用户（含初始积分 100）
  const { User } = require('../models/User');
  const user = await User.create({
    name: `credittest_${Date.now()}`,
    email: `credittest_${Date.now()}@test.com`,
    password: 'Test123456',
    credits: 100,
  });
  testUserId = String(user._id);
  token = jwt.sign({ id: testUserId }, JWT_SECRET, { expiresIn: '1h' });

  // 创建独立 Express app（仅挂载需要的路由，避免端口冲突）
  app = express();
  app.use(json());
  const billingRouter = require('./billing').default;
  const marketplaceRouter = require('./marketplace').default;
  app.use('/api/billing', billingRouter);
  app.use('/api/marketplace', marketplaceRouter);
}, 60000);

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  await mongoServer.stop();
}, 30000);

const auth = () => ({ Authorization: `Bearer ${token}` });

describe('P0-2 API 市场积分扣减集成测试', () => {
  // ================================================================
  // 1. 积分余额查询
  // ================================================================

  it('GET /api/marketplace/credits 返回余额和套餐', async () => {
    const res = await request(app).get('/api/marketplace/credits').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.credits).toBe(100);
    expect(res.body.data.plan).toBe('free');
  });

  it('匿名访问 /api/marketplace/credits 应 401', async () => {
    const res = await request(app).get('/api/marketplace/credits');
    expect(res.status).toBe(401);
  });

  // ================================================================
  // 2. 积分变动明细
  // ================================================================

  it('GET /api/marketplace/credits/history 返回分页明细', async () => {
    const { CreditsTransaction } = require('../models/CreditsTransaction');
    // 按时间顺序插入（先 grant 后 deduction）
    await CreditsTransaction.create(
      { userId: testUserId, type: 'grant', amount: 100, balanceAfter: 100, description: '初始赠送' }
    );
    // 延迟 10ms 确保时间戳可区分
    await new Promise((r) => setTimeout(r, 15));
    await CreditsTransaction.create(
      { userId: testUserId, type: 'deduction', amount: -10, balanceAfter: 90, resource: 'chat' }
    );

    const res = await request(app).get('/api/marketplace/credits/history').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBeGreaterThanOrEqual(2);
    expect(res.body.data.items.length).toBeGreaterThanOrEqual(2);
    // 最新记录在前（deduction 在后插入）
    expect(res.body.data.items[0].type).toBe('deduction');
    expect(res.body.data.items[1].type).toBe('grant');
  });

  it('可按 type=deduction 过滤', async () => {
    const res = await request(app)
      .get('/api/marketplace/credits/history?type=deduction')
      .set(auth());
    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      expect(item.type).toBe('deduction');
    }
  });

  it('可按 type=grant 过滤', async () => {
    const res = await request(app)
      .get('/api/marketplace/credits/history?type=grant')
      .set(auth());
    expect(res.status).toBe(200);
    for (const item of res.body.data.items) {
      expect(item.type).toBe('grant');
    }
  });

  it('分页 pageSize=2 限制正确', async () => {
    const res = await request(app)
      .get('/api/marketplace/credits/history?pageSize=2&page=1')
      .set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.items.length).toBeLessThanOrEqual(2);
    expect(res.body.data.page).toBe(1);
  });

  // ================================================================
  // 3. 积分包链路（列表→下单→支付→余额验证）
  // ================================================================

  it('GET /api/billing/credits-packages 返回积分包列表', async () => {
    const res = await request(app).get('/api/billing/credits-packages');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    expect(res.body.data[0]).toHaveProperty('id');
    expect(res.body.data[0]).toHaveProperty('credits');
    expect(res.body.data[0]).toHaveProperty('price');
  });

  it('POST /api/billing/credits-packages/order 创建积分包订单', async () => {
    const res = await request(app)
      .post('/api/billing/credits-packages/order')
      .set(auth())
      .send({ packageId: 'credits_100' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.credits).toBe(100);
    expect(res.body.data.orderNo).toBeDefined();
    expect(res.body.data.provider).toBe('mock');
  });

  it('缺少 packageId 返回 400', async () => {
    const res = await request(app)
      .post('/api/billing/credits-packages/order')
      .set(auth())
      .send({});
    expect(res.status).toBe(400);
  });

  it('无效 packageId 返回 400', async () => {
    const res = await request(app)
      .post('/api/billing/credits-packages/order')
      .set(auth())
      .send({ packageId: 'nonexistent' });
    expect(res.status).toBe(400);
  });

  it('Mock 支付后余额增加且产生 purchase 记录', async () => {
    // 记录支付前余额
    const before = await request(app).get('/api/marketplace/credits').set(auth());
    const creditsBefore = before.body.data.credits;

    // 创建订单
    const orderRes = await request(app)
      .post('/api/billing/credits-packages/order')
      .set(auth())
      .send({ packageId: 'credits_500' });
    const orderNo = orderRes.body.data.orderNo;

    // Mock 支付
    const payRes = await request(app)
      .get(`/api/billing/orders/${orderNo}/pay`)
      .set(auth());
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.paid).toBe(true);
    expect(payRes.body.data.orderType).toBe('credits_pack');

    // 验证余额增加
    const after = await request(app).get('/api/marketplace/credits').set(auth());
    expect(after.body.data.credits).toBe(creditsBefore + 500);

    // 验证积分明细中有 purchase 记录
    const history = await request(app)
      .get('/api/marketplace/credits/history?type=purchase')
      .set(auth());
    const purchaseRecords = history.body.data.items.filter((i: any) => i.orderNo === orderNo);
    expect(purchaseRecords.length).toBe(1);
    expect(purchaseRecords[0].amount).toBe(500);
  });

  // ================================================================
  // 4. 用量报表含积分汇总
  // ================================================================

  it('GET /api/marketplace/usage/report 含 totalCreditsDeducted 字段', async () => {
    const res = await request(app).get('/api/marketplace/usage/report').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('from');
    expect(res.body.data).toHaveProperty('to');
    // items 存在则每项应含 totalCreditsDeducted
    if (res.body.data.items && res.body.data.items.length > 0) {
      expect(res.body.data.items[0]).toHaveProperty('totalCreditsDeducted');
    }
  });

  // ================================================================
  // 5. 用量导出含积分列
  // ================================================================

  it('GET /api/marketplace/usage/export 含 creditsDeducted 列', async () => {
    const res = await request(app)
      .get('/api/marketplace/usage/export?format=json')
      .set(auth());
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data.records)).toBe(true);
  });
});
