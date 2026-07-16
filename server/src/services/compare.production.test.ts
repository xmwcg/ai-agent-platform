jest.mock('../config/ai-models', () => ({
  __esModule: true,
  createAIClient: jest.fn(),
  aiModelManager: {
    getDefaultProvider: jest.fn(() => ({ defaultModel: 'real-model' })),
  },
}));

import { createAIClient } from '../config/ai-models';
import { CompareService } from './compare.service';

const mockedCreateAIClient = createAIClient as jest.MockedFunction<typeof createAIClient>;

describe('技术对比生产真实数据门禁', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };
    mockedCreateAIClient.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('真实 AI Provider 失败时不回退硬编码参考数据', async () => {
    mockedCreateAIClient.mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockRejectedValue(new Error('provider unavailable')),
        },
      },
    } as any);

    const service = new CompareService();
    await expect(service.generateCompare({ items: ['gpt-4o', 'deepseek-v3'] }))
      .rejects.toMatchObject({ code: 'COMPARE_PROVIDER_UNAVAILABLE', statusCode: 503 });
  });

  it('真实 AI 返回空结构时不使用硬编码价格和评分补齐', async () => {
    mockedCreateAIClient.mockReturnValue({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: '{}' } }],
          }),
        },
      },
    } as any);

    const service = new CompareService();
    await expect(service.generateCompare({ items: ['gpt-4o', 'deepseek-v3'] }))
      .rejects.toMatchObject({ code: 'COMPARE_INVALID_RESPONSE', statusCode: 502 });
  });
});
