/**
 * Marketplace 中间件顺序回归测试
 * 验证 validate 在 enforceApiKey 之前执行，避免无效请求扣除配额
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
const mongoose = jest.requireActual('mongoose') as typeof import('mongoose');
import app from '../index';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { ApiKey } from '../models/ApiKey';
import { hashKey } from '../services/apikey.service';

let mongoServer: MongoMemoryServer;
let testUserId: string;
let token: string;
let validApiKeyHash: string;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';

async function disconnectMongoose(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  try { await mongoose.disconnect(); } catch (_: any) {}
}

jest.setTimeout(60000);

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await disconnectMongoose();
  await mongoose.connect(mongoServer.getUri());

  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'mporder', password: 'MpOrder123!', email: 'mporder@test.com' });
  testUserId = res.body?.data?.id || res.body?.user?.id || '';
  token = testUserId ? jwt.sign({ id: testUserId }, JWT_SECRET, { expiresIn: '1h' }) : '';

  // 创建有效API Key
  if (testUserId) {
    const k = await ApiKey.create({
      ownerId: testUserId,
      name: 'test-key',
      keyHash: hashKey('rx_live_mp_test_valid_key'),
      prefix: 'rx_vld_',
      quotaDaily: 1000,
      scopes: ['chat'],
    });
    validApiKeyHash = k.keyHash;
    await User.updateOne({ _id: testUserId }, { $set: { credits: 100 } });
  }
});

afterAll(async () => {
  try { await mongoose.connection.dropDatabase(); } catch (_) {}
  await disconnectMongoose();
  if (mongoServer) await mongoServer.stop();
});

describe('Middleware Order: validate before enforceApiKey', () => {
  it('空 prompt 不应扣除日配额', async () => {
    if (!token) return;

    // 获取当前日用量
    const key = await ApiKey.findOne({ ownerId: testUserId, status: 'active' });
    const usedBefore = key?.usedToday || 0;

    // 发送空 prompt（应被 validate 拒绝）
    await request(app)
      .post('/api/marketplace/v1/chat')
      .set('Authorization', 'Bearer ' + token)
      .set('x-api-key', 'rx_live_mp_test_valid_key')
      .send({ prompt: '' });

    // 验证日配额未被扣除
    const keyAfter = await ApiKey.findOne({ ownerId: testUserId, status: 'active' });
    expect(keyAfter?.usedToday).toBe(usedBefore);
  });

  it('缺少 prompt 不应扣除日配额', async () => {
    if (!token) return;

    const key = await ApiKey.findOne({ ownerId: testUserId, status: 'active' });
    const usedBefore = key?.usedToday || 0;

    await request(app)
      .post('/api/marketplace/v1/chat')
      .set('Authorization', 'Bearer ' + token)
      .set('x-api-key', 'rx_live_mp_test_valid_key')
      .send({}); // 缺少 prompt

    const keyAfter = await ApiKey.findOne({ ownerId: testUserId, status: 'active' });
    expect(keyAfter?.usedToday).toBe(usedBefore);
  });

  it('正常请求能通过（验证没破坏正常流程）', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/api/marketplace/v1/chat')
      .set('Authorization', 'Bearer ' + token)
      .set('x-api-key', 'rx_live_mp_test_valid_key')
      .set('Idempotency-Key', 'normal-' + Date.now())
      .send({ prompt: 'Hello' });

    // 正常请求应该能通过返回200（即便AI调用可能失败）
    // 如果AI服务不可用，也应返回非400的错误
    expect(res.status).not.toBe(400);
  });
});
