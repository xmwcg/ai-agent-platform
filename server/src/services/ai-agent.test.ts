import { aiAgentService } from './ai-agent';

// 拦截网关路由，验证前端选择的模型是否真正透传
jest.mock('../gateway/ai-gateway.service', () => ({
  route: jest.fn(),
}));

import { route } from '../gateway/ai-gateway.service';

describe('AIAgentService.sendMessage 模型选择透传', () => {
  beforeEach(() => {
    (route as jest.Mock).mockReset();
    (route as jest.Mock).mockResolvedValue({ reply: 'ok', usage: { total_tokens: 1 } });
  });

  it('未指定覆盖时使用会话默认模型', async () => {
    const sid = await aiAgentService.createSession('u1', 'openai' as any);
    await aiAgentService.sendMessage(sid, 'hi');
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ model: 'openai/gpt-4.1' }));
  });

  it('前端选择器传入国内厂商模型（智谱 GLM）应透传', async () => {
    const sid = await aiAgentService.createSession('u1', 'openai' as any);
    await aiAgentService.sendMessage(sid, 'hi', undefined, { model: 'zhipu/glm-4-air' });
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ model: 'zhipu/glm-4-air' }));
  });

  it('第三方自定义模型（mc_<id>）应透传至网关路由', async () => {
    const sid = await aiAgentService.createSession('u1', 'openai' as any);
    await aiAgentService.sendMessage(sid, 'hi', undefined, { model: 'mc_abc123/glm-4' });
    expect(route).toHaveBeenCalledWith(expect.objectContaining({ model: 'mc_abc123/glm-4' }));
  });

  it('生产环境拒绝创建 Mock 会话', async () => {
    const oldNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      await expect(aiAgentService.createSession('u1', 'mock' as any))
        .rejects.toMatchObject({ code: 'AI_MOCK_DISABLED', statusCode: 400 });
    } finally {
      process.env.NODE_ENV = oldNodeEnv;
    }
  });
});
