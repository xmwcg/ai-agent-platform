import express from 'express';
import request from 'supertest';
import sandboxRoutes from './sandbox';
import { generateAccessToken } from '../middleware/auth';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/sandbox', sandboxRoutes);
  return app;
}

describe('Sandbox 部署与生产模式门禁', () => {
  const oldEnv = process.env;

  afterEach(() => {
    process.env = oldEnv;
  });

  it('公开状态探针返回部署能力', async () => {
    const response = await request(createApp()).get('/api/sandbox/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.objectContaining({
      defaultMode: expect.any(String),
      providers: expect.any(Array),
      supportedLanguages: expect.any(Array),
    }));
  });

  it('生产探针固定 remote 且 mock/local 不可用', async () => {
    process.env = {
      ...oldEnv,
      NODE_ENV: 'production',
      SANDBOX_MODE: 'remote',
      SANDBOX_REMOTE_URL: 'https://sandbox.internal.example.com/run',
      SANDBOX_REMOTE_TOKEN: 'remote-token',
    };

    const response = await request(createApp()).get('/api/sandbox/status');
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      production: true,
      defaultMode: 'remote',
      mockEnabled: false,
      localEnabled: false,
    }));
    expect(response.body.data.providers).toEqual(expect.arrayContaining([
      { mode: 'mock', configured: false },
      { mode: 'local', configured: false },
      { mode: 'remote', configured: true },
    ]));
  });

  it('生产 /run 拒绝客户端提交 mode', async () => {
    process.env = {
      ...oldEnv,
      NODE_ENV: 'production',
      SANDBOX_MODE: 'remote',
      SANDBOX_REMOTE_URL: 'https://sandbox.internal.example.com/run',
      SANDBOX_REMOTE_TOKEN: 'remote-token',
    };
    const token = generateAccessToken({ id: 'user-1', email: 'user@example.com', role: 'user' });

    const response = await request(createApp())
      .post('/api/sandbox/run')
      .set('Authorization', `Bearer ${token}`)
      .send({ language: 'python', code: 'print(1)', mode: 'mock' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('mode');
  });
});
