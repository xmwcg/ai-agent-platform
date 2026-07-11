/**
 * text2img 路由集成测试（成本防护）
 * 不依赖真实 DB / Redis，mock 掉 MediaTask、media-gen.service、redisClient。
 * 重点验证：① 服务端数量/分辨率封顶；② 匿名用户每日限次真实生成后转 Mock。
 */
import express from 'express';
import request from 'supertest';

// —— 内存版 redis，驱动匿名限次逻辑 ——
const store = new Map<string, string>();
jest.mock('../config/database', () => ({
  redisClient: {
    async get(k: string) { return store.has(k) ? store.get(k)! : null; },
    async set(k: string, v: any) { store.set(k, String(v)); return 'OK'; },
    async incr(k: string) { const n = (Number(store.get(k)) || 0) + 1; store.set(k, String(n)); return n; },
    async incrby(k: string, by: number) { const n = (Number(store.get(k)) || 0) + by; store.set(k, String(n)); return n; },
    async expire() { return 1; },
    async del(k: string) { store.delete(k); return 1; },
  },
}));

jest.mock('../models/MediaTask', () => ({
  MediaTask: {
    findOne: jest.fn().mockResolvedValue(null),
    findOneAndUpdate: jest.fn().mockResolvedValue(null),
    find: jest.fn(),
  },
}));

// 捕获 media-gen 实际收到的参数，用于断言封顶逻辑
const generateSpy = jest.fn((params: any) => ({
  taskId: 'task-1',
  status: 'processing',
  provider: params.provider || 'hunyuan',
  note: '',
}));
jest.mock('../services/media-gen.service', () => ({
  mediaGenService: {
    generate: (params: any) => generateSpy(params),
    queryTask: jest.fn(),
  },
}));

import text2imgRouter from './text2img';

const app = express();
app.use(express.json());
app.use(text2imgRouter);

const ANON_KEY_PREFIX = 'anon_t2i:';
function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

beforeEach(() => {
  store.clear();
  generateSpy.mockClear();
});

describe('成本封顶：数量与分辨率', () => {
  it('n 超过上限被钳制为 2，非法分辨率归一为 1024x1024', async () => {
    const res = await request(app)
      .post('/generate')
      .send({ prompt: '一只猫', n: 99, size: '4096x4096' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // media-gen 实际收到的参数应当被封顶
    expect(generateSpy).toHaveBeenCalledTimes(1);
    const called = generateSpy.mock.calls[0][0];
    expect(called.n).toBe(2);
    expect(called.size).toBe('1024x1024');
  });

  it('n 缺失时默认 1，合法分辨率放行', async () => {
    await request(app).post('/generate').send({ prompt: '山', size: '768x768' });
    const called = generateSpy.mock.calls[0][0];
    expect(called.n).toBe(1);
    expect(called.size).toBe('768x768');
  });
});

describe('匿名用户每日限次真实生成', () => {
  const XFF = '1.2.3.4'; // 用 X-Forwarded-For 固定匿名 IP，key 可预测
  const ipKey = `${ANON_KEY_PREFIX}${XFF}:${todayKey()}`;

  it('未达上限：走真实混元（返回 hunyuan）并累加计数', async () => {
    store.clear();
    const res = await request(app)
      .post('/generate')
      .set('X-Forwarded-For', XFF)
      .send({ prompt: '猫' });
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('hunyuan');
    expect(res.body.data.anonRealLeft).toBe(2); // 默认 3 次，本次后剩 2
    expect(Number(store.get(ipKey))).toBe(1); // 计数已写入
  });

  it('已达上限：强制 Mock，不再垫付', async () => {
    store.clear();
    store.set(ipKey, '3'); // 预置到上限
    const res = await request(app)
      .post('/generate')
      .set('X-Forwarded-For', XFF)
      .send({ prompt: '狗' });
    expect(res.status).toBe(200);
    expect(res.body.data.provider).toBe('mock');
    expect(res.body.data.anonRealLeft).toBe(0);
    expect(Number(store.get(ipKey))).toBe(3); // 计数不再增长
  });
});

describe('安全校验', () => {
  it('空 prompt 被拒', async () => {
    const res = await request(app).post('/generate').send({ prompt: '   ' });
    expect(res.status).toBe(400);
  });
});
