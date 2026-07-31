jest.mock('../gateway/ai-gateway.service', () => ({
  __esModule: true,
  route: jest.fn(),
}));

import { route } from '../gateway/ai-gateway.service';
import { generateText } from './ai-text.service';

const mockedRoute = route as jest.MockedFunction<typeof route>;

describe('统一文本生成服务默认模型', () => {
  beforeEach(() => {
    mockedRoute.mockReset();
    mockedRoute.mockResolvedValue({
      reply: '完成',
      provider: 'agnes25',
      model: 'agnes-2.5-flash',
    } as any);
  });

  it('未显式指定时固定调用 Agnes 2.5', async () => {
    await generateText({ user: '生成方案' });
    expect(mockedRoute).toHaveBeenCalledWith(expect.objectContaining({
      model: 'agnes25/agnes-2.5-flash',
    }));
  });

  it('显式模型仍可用于管理员测试和用户手动选择', async () => {
    await generateText({ user: '测试', provider: 'zhipu', model: 'zhipu/glm-4.7-flash' });
    expect(mockedRoute).toHaveBeenCalledWith(expect.objectContaining({
      provider: 'zhipu',
      model: 'zhipu/glm-4.7-flash',
    }));
  });
});
