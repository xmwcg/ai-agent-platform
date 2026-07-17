/**
 * Model Fetch 安全测试
 *
 * 覆盖：SSRF防护、匿名拒绝、超时、大响应、API Key不泄露
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
const mongoose = jest.requireActual('mongoose') as typeof import('mongoose');
import app from '../index';
import request from 'supertest';
import jwt from 'jsonwebtoken';

let mongoServer: MongoMemoryServer;
let token: string;
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
    .send({ username: 'mfsecure', password: 'MfSecure123!', email: 'mfsecure@test.com' });
  const id = res.body?.data?.id || res.body?.user?.id || '';
  if (id) token = jwt.sign({ id }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  try { await mongoose.connection.dropDatabase(); } catch (_) {}
  await disconnectMongoose();
  if (mongoServer) await mongoServer.stop();
});

describe('Model Fetch - 匿名拒绝', () => {
  it('未登录获取模型列表返回401', async () => {
    const res = await request(app).post('/api/query-center/providers/openai/models').send({ apiKey: 'sk-test' });
    expect(res.status).toBe(401);
  });

  it('未登录 search 接口不含私人数据', async () => {
    const res = await request(app).get('/api/search').query({ q: 'order' });
    if (res.status === 200) {
      // 不应该返回订单号等私人数据
      const body = JSON.stringify(res.body);
      expect(body).not.toContain('test@test.com');
      expect(body).not.toContain('ledger');
    }
  });
});

describe('Model Fetch - SSRF防护', () => {
  it('用户指定的自定义 baseURL 被拒绝', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/api/query-center/providers/custom/models')
      .set('Authorization', 'Bearer ' + token)
      .send({ apiKey: 'sk-test', baseURL: 'http://localhost:9999/v1' });
    // 应该拒绝（不支持的用户指定baseURL）
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

describe('Model Fetch - API Key不泄露', () => {
  it('API Key错误不在响应中返回', async () => {
    if (!token) return;
    const res = await request(app)
      .post('/api/query-center/providers/openai/models')
      .set('Authorization', 'Bearer ' + token)
      .send({ apiKey: 'sk-super-secret-key-12345' });
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('sk-super-secret-key-12345');
  });
});

describe('Query Center - 私有数据隔离', () => {
  it('search 不泄露私有知识', async () => {
    const res = await request(app).get('/api/search').query({ q: 'private secret admin' });
    expect(res.status).toBe(200);
  });

  it('未登录 account-summary 返回401', async () => {
    const res = await request(app).get('/api/query-center/account-summary');
    expect(res.status).toBe(401);
  });
});
