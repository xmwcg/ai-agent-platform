/**
 * 登录增强集成测试（手机号验证码 + 微信扫码，Mock 模式）
 * 不依赖真实 DB / 短信 / 微信，验证路由闭环与校验逻辑。
 */
import express from 'express';
import request from 'supertest';

// mock User 模型，避免真实 DB 连接
jest.mock('../models/User', () => {
  const fakeUser = {
    _id: 'uid-1',
    email: 'phoneuser@example.com',
    toJSON: () => ({ id: 'uid-1', email: 'phoneuser@example.com', phone: '13800000000' }),
  };
  return {
    __esModule: true,
    User: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(fakeUser),
    },
  };
});

import authRouter from './auth';
import { redisClient } from '../config/database';
import { generateToken } from '../middleware/auth';

const app = express();
app.use(express.json());
app.use(authRouter);

const PHONE = '13800000000';

// 清理短信限频/验证码 key，避免用例间串扰
beforeEach(async () => {
  await redisClient.del(`sms:limit:${PHONE}`);
  await redisClient.del(`sms:code:${PHONE}`);
});

describe('微信扫码登录（Mock）', () => {
  it('GET /auth/wechat/qr 返回可渲染的 authorizeUrl 与 state', async () => {
    const res = await request(app).get('/wechat/qr');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mock).toBe(true);
    expect(res.body.authorizeUrl).toContain('state=');
    expect(res.body.state).toBeTruthy();
  });

  it('GET /auth/wechat/callback?code=mock&state=xxx 返回 token（format=json）', async () => {
    // 先拿一个合法 state
    const qr = await request(app).get('/wechat/qr');
    const state = qr.body.state;
    const res = await request(app).get(`/wechat/callback?code=mock&state=${state}&format=json`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  it('非法 state 回调被拒', async () => {
    const res = await request(app).get('/wechat/callback?code=mock&state=invalid-state&format=json');
    expect(res.status).toBe(400);
  });
});

describe('手机号验证码登录', () => {
  it('POST /auth/sms/send 返回 devCode 并写入 redis', async () => {
    const res = await request(app).post('/sms/send').send({ phone: PHONE });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.devCode).toMatch(/^\d{6}$/);
    const stored = await redisClient.get(`sms:code:${PHONE}`);
    expect(stored).toBe(res.body.devCode);
  });

  it('POST /auth/sms/login 用正确验证码登录成功', async () => {
    const send = await request(app).post('/sms/send').send({ phone: PHONE });
    const code = send.body.devCode;
    const res = await request(app).post('/sms/login').send({ phone: PHONE, code });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
  });

  it('验证码错误被拒', async () => {
    await request(app).post('/sms/send').send({ phone: PHONE });
    const res = await request(app).post('/sms/login').send({ phone: PHONE, code: '000000' });
    expect(res.status).toBe(400);
  });

  it('手机号格式非法被校验拦截', async () => {
    const res = await request(app).post('/sms/send').send({ phone: '123' });
    expect(res.status).toBe(400);
  });
});
