import express from 'express';
import request from 'supertest';
import billingRoutes from './billing';
import authRoutes from './auth';
import { generateToken } from '../middleware/auth';

const originalEnv = process.env;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/billing', billingRoutes);
  app.use('/api/auth', authRoutes);
  return app;
}

function setProductionEnv() {
  process.env = {
    ...originalEnv,
    NODE_ENV: 'production',
    DEFAULT_PAY_PROVIDER: 'wechat',
    WECHAT_MCH_ID: '1900000001',
    WECHAT_APP_ID: 'wx-app-id',
    WECHAT_API_V3_KEY: '12345678901234567890123456789012',
    WECHAT_CERT_SERIAL: 'merchant-cert-serial',
    WECHAT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
    WECHAT_PLATFORM_CERT: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
  };
}

describe('Batch 0 生产路由门禁', () => {
  beforeEach(setProductionEnv);

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each(['mock', 'alipay', 'stripe'])('下单拒绝 provider=%s', async (provider) => {
    const token = generateToken({ id: 'user-1', email: 'user@example.com', role: 'user' });
    const response = await request(createApp())
      .post('/api/billing/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ plan: 'pro', period: 'monthly', provider });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PAYMENT_PROVIDER_DISABLED');
  });

  it('生产 Mock 支付确认入口不可用', async () => {
    const token = generateToken({ id: 'user-1', email: 'user@example.com', role: 'user' });
    const response = await request(createApp())
      .get('/api/billing/orders/AI123/pay')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(404);
  });

  it('生产支付方式只返回微信', async () => {
    const response = await request(createApp()).get('/api/billing/payment-methods');
    expect(response.status).toBe(200);
    expect(response.body.data.methods).toEqual([
      { key: 'wechat', label: '微信支付', enabled: true },
    ]);
  });

  it.each(['mock', 'alipay', 'stripe'])('生产拒绝 %s webhook', async (provider) => {
    const response = await request(createApp())
      .post(`/api/billing/webhook/${provider}`)
      .send({});
    expect(response.status).toBe(404);
  });

  it('生产微信 webhook 缺少签名头时返回签名错误', async () => {
    const response = await request(createApp())
      .post('/api/billing/webhook/wechat')
      .send({ event_type: 'TRANSACTION.SUCCESS' });
    expect(response.status).toBe(401);
    expect(response.body.code).toBe('SIGN_ERROR');
  });

  it('生产短信发送和登录均关闭', async () => {
    const send = await request(createApp()).post('/api/auth/sms/send').send({ phone: '13800138000' });
    const login = await request(createApp()).post('/api/auth/sms/login').send({ phone: '13800138000', code: '123456' });
    expect(send.status).toBe(503);
    expect(login.status).toBe(503);
  });

  it('生产未配置微信登录时隐藏并拒绝演示回调', async () => {
    delete process.env.WECHAT_OPEN_APPID;
    delete process.env.WECHAT_OPEN_SECRET;

    const methods = await request(createApp()).get('/api/auth/login-methods');
    const qr = await request(createApp()).get('/api/auth/wechat/qr');
    const callback = await request(createApp()).get('/api/auth/wechat/callback?code=mock&state=test');

    expect(methods.body.data).toEqual({ email: true, wechat: false, sms: false });
    expect(qr.status).toBe(503);
    expect(callback.status).toBe(503);
  });
});
