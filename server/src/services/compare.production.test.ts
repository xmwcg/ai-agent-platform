jest.mock('../gateway/ai-gateway.service', () => ({
  __esModule: true,
  route: jest.fn(),
}));

jest.mock('../config/ai-models', () => ({
  __esModule: true,
  getPreferredAgnesTextModel: jest.fn(() => 'agnes25/agnes-2.5-flash'),
}));

import { route } from '../gateway/ai-gateway.service';
import { CompareService } from './compare.service';

const mockedRoute = route as jest.MockedFunction<typeof route>;

describe('技术对比生产真实数据门禁', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };
    mockedRoute.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('真实 AI Provider 失败时不回退硬编码参考数据', async () => {
    mockedRoute.mockRejectedValue(new Error('provider unavailable'));

    const service = new CompareService();
    await expect(service.generateCompare({ items: ['gpt-4o', 'deepseek-v3'] }))
      .rejects.toMatchObject({ code: 'COMPARE_PROVIDER_UNAVAILABLE', statusCode: 503 });
  });

  it('真实 AI 返回空结构时不使用硬编码价格和评分补齐', async () => {
    mockedRoute.mockResolvedValue({
      reply: '{}',
      provider: 'agnes25',
      model: 'agnes-2.5-flash',
    } as any);

    const service = new CompareService();
    await expect(service.generateCompare({ items: ['gpt-4o', 'deepseek-v3'] }))
      .rejects.toMatchObject({ code: 'COMPARE_INVALID_RESPONSE', statusCode: 502 });
  });

  it('默认调用明确指定 Agnes 2.5', async () => {
    mockedRoute.mockResolvedValue({
      reply: JSON.stringify({
        rows: [{ dimension: 'provider', values: ['A', 'B'], winner: -1 }],
        recommendation: '按业务需求选择',
      }),
      provider: 'agnes25',
      model: 'agnes-2.5-flash',
    } as any);

    const service = new CompareService();
    await service.generateCompare({ items: ['gpt-4o', 'deepseek-v3'] });
    expect(mockedRoute).toHaveBeenCalledWith(expect.objectContaining({
      model: 'agnes25/agnes-2.5-flash',
    }));
  });
});
