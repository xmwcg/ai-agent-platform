import express from 'express';
import request from 'supertest';

let mockMemoryRedis = false;

jest.mock('../config/database', () => ({
  checkDatabaseHealth: jest.fn().mockResolvedValue({ mongodb: true, redis: true }),
  isUsingMemoryRedis: jest.fn(() => mockMemoryRedis),
}));

import diagnosticsRoutes from './diagnostics';

const ORIGINAL_ENV = { ...process.env };

function configureProduction() {
  process.env.NODE_ENV = 'production';
  process.env.ENABLE_MOCK_MODE = 'false';
  process.env.MOCK_MODE = 'false';
  process.env.DEFAULT_PAY_PROVIDER = 'wechat';
  process.env.SANDBOX_MODE = 'remote';
  mockMemoryRedis = false;
}

describe('GET /api/diagnostics/runtime-safety', () => {
  const app = express();
  app.use('/api/diagnostics', diagnosticsRoutes);

  beforeEach(configureProduction);

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('returns 200 only when production has no mock or memory fallback enabled', async () => {
    const response = await request(app).get('/api/diagnostics/runtime-safety');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.runtimeSafety).toEqual({
      production: true,
      mockMode: false,
      aiMockEnabled: false,
      paymentMockEnabled: false,
      sandboxMockEnabled: false,
      sandboxLocalEnabled: false,
      smsMockEnabled: false,
      wechatLoginMockEnabled: false,
      memoryRedisEnabled: false,
    });
  });

  it('returns 503 when any production mock switch is enabled', async () => {
    process.env.ENABLE_MOCK_MODE = 'true';

    const response = await request(app).get('/api/diagnostics/runtime-safety');

    expect(response.status).toBe(503);
    expect(response.body.success).toBe(false);
    expect(response.body.data.runtimeSafety.mockMode).toBe(true);
  });

  it('returns 503 when the process is using MemoryRedis', async () => {
    mockMemoryRedis = true;

    const response = await request(app).get('/api/diagnostics/runtime-safety');

    expect(response.status).toBe(503);
    expect(response.body.data.runtimeSafety.memoryRedisEnabled).toBe(true);
  });
});
