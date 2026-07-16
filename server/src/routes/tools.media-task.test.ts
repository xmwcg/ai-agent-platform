import express from 'express';
import request from 'supertest';

const mockQueryTask = jest.fn();

jest.mock('../services/translation.service', () => ({
  translationService: { getSupportedLanguages: jest.fn(() => []), translate: jest.fn() },
}));
jest.mock('../services/plan-generator.service', () => ({
  planGeneratorService: { generate: jest.fn() },
}));
jest.mock('../services/file-convert.service', () => ({
  fileConvertService: { convert: jest.fn() },
  getSupportedConversionList: jest.fn(() => []),
  getStoredConversion: jest.fn(),
}));
jest.mock('../services/media-gen.service', () => ({
  mediaGenService: { generate: jest.fn(), queryTask: mockQueryTask },
  listMediaProviders: jest.fn(() => []),
}));
jest.mock('../middleware/auth', () => ({
  optionalAuth: (_req: any, _res: any, next: any) => next(),
}));
jest.mock('../middleware/subscription', () => ({
  enforceQuota: () => (_req: any, _res: any, next: any) => next(),
  quotaIncrement: jest.fn(),
}));

import toolsRouter from './tools';

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/tools', toolsRouter);
  return app;
}

describe('工具媒体任务查询门禁', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    mockQueryTask.mockReset();
    process.env.NODE_ENV = 'test';
  });

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('允许查询 MoneyPrinterTurbo 返回的真实异步任务', async () => {
    mockQueryTask.mockResolvedValueOnce({
      taskId: 'job-1',
      provider: 'moneyprinterturbo',
      status: 'processing',
    });

    const response = await request(createApp())
      .get('/api/tools/media/task/moneyprinterturbo/job-1');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(mockQueryTask).toHaveBeenCalledWith('moneyprinterturbo', 'job-1');
  });

  it('生产环境在路由层拒绝 Mock 任务查询', async () => {
    process.env.NODE_ENV = 'production';

    const response = await request(createApp())
      .get('/api/tools/media/task/mock/mock-task');

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('MEDIA_MOCK_DISABLED');
    expect(mockQueryTask).not.toHaveBeenCalled();
  });
});
