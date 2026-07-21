import express from 'express';
import request from 'supertest';

jest.mock('../gateway/ai-gateway.service', () => ({ route: jest.fn() }));
jest.mock('../services/media-gen.service', () => ({
  mediaGenService: { generate: jest.fn() },
  ensureAgnesLoaded: jest.fn().mockResolvedValue(false),
}));
jest.mock('../services/ai-text.service', () => ({ generateText: jest.fn() }));
jest.mock('../services/translation.service', () => ({ translationService: { translate: jest.fn() } }));

import { route } from '../gateway/ai-gateway.service';
import { mediaGenService } from '../services/media-gen.service';
import { generateText } from '../services/ai-text.service';
import { translationService } from '../services/translation.service';
import skillsRouter from '../routes/skills';
import { registerSkill } from './registry';
import { videoPipelineSkill } from './defs/video-pipeline.skill';
import { codeExplainSkill } from './defs/code-explain.skill';
import { translateSkill } from './defs/translate.skill';
import { customerServiceSkill } from './defs/customer-service.skill';
import { knowledgeSkill } from './defs/knowledge.skill';

const mockedRoute = route as jest.MockedFunction<typeof route>;
const mockedGenerate = mediaGenService.generate as jest.MockedFunction<typeof mediaGenService.generate>;
const mockedGenerateText = generateText as jest.MockedFunction<typeof generateText>;
const mockedTranslate = translationService.translate as jest.MockedFunction<typeof translationService.translate>;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/skills', skillsRouter);
  return app;
}

describe('技能生产真实性门禁', () => {
  beforeEach(() => jest.clearAllMocks());

  it('视频调研失败时终止流水线并返回失败', async () => {
    mockedRoute.mockRejectedValueOnce(new Error('research provider unavailable'));
    const result = await videoPipelineSkill.invoke({ input: { topic: '真实商业发布' } });
    expect(result).toMatchObject({ ok: false, code: 'VIDEO_PIPELINE_UNAVAILABLE', error: 'research provider unavailable' });
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('视频脚本失败时不进入合成阶段', async () => {
    mockedRoute
      .mockResolvedValueOnce({ reply: '真实调研结果', provider: 'deepseek', model: 'deepseek-v4-flash' } as any)
      .mockRejectedValueOnce(new Error('script provider unavailable'));
    const result = await videoPipelineSkill.invoke({ input: { topic: '真实商业发布' } });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('script provider unavailable');
    expect(mockedGenerate).not.toHaveBeenCalled();
  });

  it('视频合成失败时不把错误包装成成功结果', async () => {
    mockedRoute
      .mockResolvedValueOnce({ reply: '真实调研结果', provider: 'deepseek', model: 'deepseek-v4-flash' } as any)
      .mockResolvedValueOnce({ reply: '真实视频脚本', provider: 'openai', model: 'gpt-4o' } as any)
      .mockResolvedValueOnce({ reply: 'A concise visual prompt', provider: 'openai', model: 'gpt-4.1' } as any);
    mockedGenerate.mockRejectedValueOnce(new Error('compose provider unavailable'));
    const result = await videoPipelineSkill.invoke({ input: { topic: '真实商业发布' } });
    expect(result.ok).toBe(false);
    expect(result.error).toBe('compose provider unavailable');
  });

  it('视频流水线成功时返回真实阶段元数据与可追踪任务', async () => {
    mockedRoute
      .mockResolvedValueOnce({ reply: '真实调研结果', provider: 'deepseek', model: 'deepseek-v4-flash' } as any)
      .mockResolvedValueOnce({ reply: '真实视频脚本', provider: 'openai', model: 'gpt-4o' } as any)
      .mockResolvedValueOnce({ reply: 'A concise visual prompt', provider: 'openai', model: 'gpt-4.1' } as any);
    mockedGenerate.mockResolvedValueOnce({ taskId: 'video-task-001', status: 'processing', provider: 'moneyprinterturbo' } as any);
    const result = await videoPipelineSkill.invoke({ input: { topic: '真实商业发布', duration: 30, style: '专业' } });
    expect(result.ok).toBe(true);
    expect(result.data.stages).toEqual({
      research: { content: '真实调研结果', provider: 'deepseek', model: 'deepseek-v4-flash' },
      script: { content: '真实视频脚本', provider: 'openai', model: 'gpt-4o' },
      visualPrompt: 'A concise visual prompt',
      compose: expect.objectContaining({ taskId: 'video-task-001', provider: 'moneyprinterturbo' }),
    });
    expect(mockedGenerate).toHaveBeenCalledWith(expect.objectContaining({
      type: 'text2video', prompt: '真实视频脚本', provider: 'moneyprinterturbo',
    }));
  });

  it('代码解释调用真实生成服务而不是回显输入冒充结果', async () => {
    mockedGenerateText.mockResolvedValueOnce({ text: '该函数把两个数字相加并返回结果。', provider: 'deepseek', model: 'deepseek-v4-flash' });
    const result = await codeExplainSkill.invoke({ input: { code: 'const add = (a, b) => a + b;', language: 'typescript', level: 'brief' } });
    expect(result).toMatchObject({ ok: true, data: { explanation: '该函数把两个数字相加并返回结果。', provider: 'deepseek', model: 'deepseek-v4-flash' } });
    expect(result.data).not.toHaveProperty('input');
    expect(mockedGenerateText).toHaveBeenCalledTimes(1);
  });

  it('翻译技能调用真实翻译服务并返回 Provider 元数据', async () => {
    mockedTranslate.mockResolvedValueOnce({
      sourceText: '你好', translatedText: 'Hello', sourceLang: '中文', targetLang: '英语', provider: 'deepseek', model: 'deepseek-v4-flash',
    });
    const result = await translateSkill.invoke({ input: { text: '你好', sourceLang: 'zh', targetLang: 'en' } });
    expect(result.ok).toBe(true);
    expect(result.data).toMatchObject({ translatedText: 'Hello', provider: 'deepseek', model: 'deepseek-v4-flash' });
    expect(mockedTranslate).toHaveBeenCalledWith('你好', 'en', 'zh', undefined, undefined);
  });

  it('未接入通用协议的客服与知识技能明确标记为不可调用', () => {
    expect(customerServiceSkill.manifest.invokable).toBe(false);
    expect(customerServiceSkill.manifest.marketable).toBe(false);
    expect(knowledgeSkill.manifest.invokable).toBe(false);
    expect(knowledgeSkill.manifest.marketable).toBe(false);
  });
});

describe('技能调用路由失败语义', () => {
  const app = createApp();

  it('invokable=false 返回 501，不进入技能实现', async () => {
    const invoke = jest.fn();
    registerSkill({
      manifest: {
        id: 'production-route-only-test', name: '专用路由测试技能', description: '仅用于验证门禁', division: 'engineering',
        color: '#000000', coreMission: '验证不可调用门禁', criticalRules: [], successMetrics: [], minRole: 'none',
        requireAuth: false, marketable: false, invokable: false,
      },
      invoke,
    });
    const response = await request(app).post('/api/skills/production-route-only-test/invoke').send({});
    expect(response.status).toBe(501);
    expect(response.body).toMatchObject({ ok: false, code: 'SKILL_NOT_INVOKABLE' });
    expect(invoke).not.toHaveBeenCalled();
  });

  it('技能返回 ok=false 时路由返回非 2xx 与机器错误码', async () => {
    registerSkill({
      manifest: {
        id: 'production-failure-test', name: '失败语义测试技能', description: '仅用于验证失败语义', division: 'engineering',
        color: '#000000', coreMission: '验证失败不会包装成成功', criticalRules: [], successMetrics: [], minRole: 'none',
        requireAuth: false, marketable: false,
      },
      async invoke() {
        return { ok: false, status: 503, code: 'REAL_PROVIDER_UNAVAILABLE', error: '真实 Provider 不可用' };
      },
    });
    const response = await request(app).post('/api/skills/production-failure-test/invoke').send({});
    expect(response.status).toBe(503);
    expect(response.body).toEqual({ ok: false, code: 'REAL_PROVIDER_UNAVAILABLE', error: '真实 Provider 不可用' });
  });
});
