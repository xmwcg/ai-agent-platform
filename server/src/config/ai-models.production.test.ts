import { AIModelManager } from './ai-models';

describe('旧 AI 模型管理器生产安全门禁', () => {
  const OLD_ENV = process.env;

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('生产即使误开 Mock，也不暴露、不设默认且不能创建 Mock 客户端', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      ENABLE_MOCK_MODE: 'true',
      DEFAULT_AI_PROVIDER: 'openai',
      OPENAI_API_KEY: 'real-openai-key',
    };

    const manager = new AIModelManager();
    expect(manager.getProvider('mock')).toBeUndefined();
    expect(manager.getEnabledProviders().some((provider) => provider.name === 'Mock AI')).toBe(false);
    expect(manager.getAvailableModels().some((provider) => provider.provider === 'Mock AI')).toBe(false);
    expect(manager.getDefaultProvider()?.name).toBe('OpenAI');
    expect(() => manager.createClient('mock')).toThrow(expect.objectContaining({ code: 'AI_MOCK_DISABLED' }));
    expect(() => manager.setDefaultProvider('mock')).toThrow(expect.objectContaining({ code: 'AI_MOCK_DISABLED' }));
    await expect(manager.testConnection('mock')).resolves.toBe(false);
  });

  it('Agnes 2.5 作为独立 provider 增量注册，不覆盖旧 Agnes', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      ENABLE_MOCK_MODE: 'false',
      DEFAULT_AI_PROVIDER: 'agnes',
      AGNES_API_KEY: 'legacy-agnes-key',
      AGNES_BASE_URL: 'https://apihub.agnes-ai.com/v1',
      AGNES25_API_KEY: 'agnes25-key',
      AGNES25_BASE_URL: 'https://api.agnes-ai.cn/v1',
    };

    const manager = new AIModelManager();
    expect(manager.getProvider('agnes')?.models).toEqual(
      expect.arrayContaining(['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-video-v2.0'])
    );
    expect(manager.getProvider('agnes25')).toMatchObject({
      baseURL: 'https://api.agnes-ai.cn/v1',
      models: ['agnes-2.5-flash'],
      defaultModel: 'agnes-2.5-flash',
    });
    expect(manager.getDefaultProvider()?.name).toBe('agnes25');
  });

  it('非生产环境仍可显式启用 Mock', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      ENABLE_MOCK_MODE: 'true',
      DEFAULT_AI_PROVIDER: 'mock',
    };

    const manager = new AIModelManager();
    expect(manager.getProvider('mock')?.enabled).toBe(true);
    expect(manager.getDefaultProvider()?.name).toBe('Mock AI');
  });
});
