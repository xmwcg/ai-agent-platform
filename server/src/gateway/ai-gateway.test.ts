// 模拟 OpenAI SDK，使自定义 provider 的 chat 调用可离线断言
jest.mock('openai', () => ({
  __esModule: true,
  default: class {
    chat = {
      completions: {
        create: async () => ({
          choices: [{ message: { content: 'CUSTOM_OK' } }],
          usage: { prompt_tokens: 1, completion_tokens: 1 },
        }),
      },
    };
    models = { list: async () => ({ data: [] }) };
  },
}));

import { signTencentTC3 } from '../lib/tc3';
import {
  route,
  listGatewayProviders,
  listGatewayModels,
  reloadGatewayProviders,
  reloadCustomProviders,
} from './ai-gateway.service';

describe('AI 网关 - 腾讯云 TC3 签名（混元 provider）', () => {
  const base = {
    secretId: 'AKIDtest',
    secretKey: 'secretkey',
    service: 'hunyuan',
    host: 'hunyuan.tencentcloudapi.com',
    action: 'ChatCompletions',
    version: '2023-09-01',
    region: 'ap-guangzhou',
    payload: '{"Model":"hunyuan-pro"}',
    timestamp: 1700000000,
  };

  it('签名幂等：相同输入得到相同 Authorization', () => {
    const a = signTencentTC3(base);
    const b = signTencentTC3(base);
    expect(a.authorization).toBe(b.authorization);
    expect(a.authorization.startsWith('TC3-HMAC-SHA256 Credential=AKIDtest/')).toBe(true);
    expect(a.authorization).toContain('SignedHeaders=content-type;host');
  });

  it('不同 payload 得到不同签名', () => {
    const a = signTencentTC3(base).authorization;
    const b = signTencentTC3({ ...base, payload: '{"Model":"hunyuan-lite"}' }).authorization;
    expect(a).not.toBe(b);
  });

  it('签名与 action 无关（腾讯云规范：action 是请求头，不在签名头内）', () => {
    const a = signTencentTC3({ ...base, action: 'ChatCompletions' }).authorization;
    const b = signTencentTC3({ ...base, action: 'AnotherAction' }).authorization;
    expect(a).toBe(b);
  });

  it('不同 secretKey 得到不同签名', () => {
    const a = signTencentTC3(base).authorization;
    const b = signTencentTC3({ ...base, secretKey: 'other' }).authorization;
    expect(a).not.toBe(b);
  });
});

describe('AI 网关 - 路由与 provider 注册表', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_MOCK_MODE: 'true' };
    reloadGatewayProviders();
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('Mock 模式下网关至少含 mock provider', () => {
    const ps = listGatewayProviders();
    expect(ps.some((p) => p.name === 'mock' && p.configured)).toBe(true);
  });

  it('Mock 模式 route 返回 Mock 回复，不抛错', async () => {
    const r = await route({
      model: 'openai/gpt-4o',
      messages: [{ role: 'user', content: '你好' }],
    });
    expect(r.reply).toContain('Mock');
    expect(r.provider).toBe('mock');
  });


  it('production 即使误开 ENABLE_MOCK_MODE 也不会注册 mock provider', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      ENABLE_MOCK_MODE: 'true',
      DEEPSEEK_API_KEY: 'real-provider-key',
    };
    reloadGatewayProviders();
    expect(listGatewayProviders().some((p) => p.name === 'mock')).toBe(false);
    expect(listGatewayProviders().some((p) => p.name === 'deepseek')).toBe(true);
  });

  it('production 显式 provider/model=mock 直接拒绝，不静默改走真实厂商', async () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      ENABLE_MOCK_MODE: 'false',
      DEEPSEEK_API_KEY: 'real-provider-key',
    };
    reloadGatewayProviders();

    await expect(route({
      provider: 'mock',
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_MOCK_DISABLED', statusCode: 400 });

    await expect(route({
      model: 'mock/mock-gpt-4',
      messages: [{ role: 'user', content: 'hi' }],
    })).rejects.toMatchObject({ code: 'AI_MOCK_DISABLED', statusCode: 400 });
  });
});

describe('AI 网关 - 国内主流模型注册（低成本闭环）', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      ENABLE_MOCK_MODE: 'false',
      ZHIPU_API_KEY: 'zhipu-key',
      QWEN_API_KEY: 'qwen-key',
      DOUBAO_API_KEY: 'doubao-key',
      DEEPSEEK_API_KEY: 'deepseek-key',
    };
    reloadGatewayProviders();
  });
  afterAll(() => {
    process.env = OLD_ENV;
    reloadGatewayProviders();
  });

  it('注册智谱 GLM / 通义千问 / 豆包并暴露在模型列表中', () => {
    const names = listGatewayProviders().map((p) => p.name);
    expect(names).toEqual(expect.arrayContaining(['zhipu', 'qwen', 'doubao', 'deepseek']));

    const models = listGatewayModels();
    const zhipu = models.find((m) => m.provider === 'zhipu');
    expect(zhipu?.models).toEqual(expect.arrayContaining(['glm-4-air']));
    const qwen = models.find((m) => m.provider === 'qwen');
    expect(qwen?.models).toEqual(expect.arrayContaining(['qwen-plus']));
    const doubao = models.find((m) => m.provider === 'doubao');
    expect(doubao?.models).toEqual(expect.arrayContaining(['doubao-pro-32k']));
  });
});

describe('AI 网关 - 第三方自定义模型路由（接入第三方模型 API 闭环）', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, ENABLE_MOCK_MODE: 'false' };
    reloadGatewayProviders();
  });
  afterEach(async () => {
    await reloadCustomProviders([]); // 清理，避免污染其他用例
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('用户 ModelConfig 被加载为独立 provider 并参与路由', async () => {
    await reloadCustomProviders([
      {
        _id: 'abc123',
        name: '我的 DeepSeek',
        provider: 'deepseek',
        baseURL: 'https://my-endpoint.example/v1',
        apiKey: 'sk-test',
        defaultModel: 'glm-x',
        models: ['glm-x'],
      },
    ]);

    const models = listGatewayModels();
    const custom = models.find((m) => m.provider === 'mc_abc123');
    expect(custom).toBeTruthy();
    expect(custom?.custom).toBe(true);
    expect(custom?.models).toEqual(['glm-x']);

    // 前缀寻址命中第三方模型
    const r = await route({
      model: 'mc_abc123/glm-x',
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.reply).toBe('CUSTOM_OK');
    expect(r.provider).toBe('mc_abc123');
  });

  it('显式 provider 命中第三方自定义模型', async () => {
    await reloadCustomProviders([
      { _id: 'xyz', name: '自建', provider: 'custom', baseURL: 'https://x', apiKey: 'k', defaultModel: 'm1', models: ['m1'] },
    ]);
    const r = await route({
      provider: 'mc_xyz' as any,
      messages: [{ role: 'user', content: 'hi' }],
    });
    expect(r.reply).toBe('CUSTOM_OK');
    expect(r.provider).toBe('mc_xyz');
  });
});
