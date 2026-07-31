import type { GatewayProviderName } from '../../gateway/ai-gateway.service';
import { aiAgentService } from '../../services/ai-agent';
import type { Skill } from '../types';

/**
 * AI 对话技能（agency-agents: ai division）
 * 通过统一 AI 网关路由到已配置的真实 Provider。
 * Mock 仅允许开发/测试环境在显式开启时使用，生产环境缺少可用 Provider 会明确失败。
 */
export const chatSkill: Skill = {
  manifest: {
    id: 'ai-chat',
    name: 'AI 对话',
    description: '多 Provider 多会话对话，经统一网关路由，支持 RAG 增强与工具调用。',
    division: 'ai',
    color: '#722ed1',
    coreMission: '用最优成本与质量的真实模型回应用户，统一屏蔽底层厂商差异。',
    criticalRules: [
      '走 ai-gateway 统一路由，不直接散落厂商调用',
      '生产环境只允许已配置的真实 Provider，禁止 Mock',
      '会话持久化到 Redis',
    ],
    successMetrics: ['首字延迟可控', '真实厂商故障可切换到已配置的备用厂商'],
    userStory: '作为终端用户，我希望用最优成本与质量的模型对话，而不关心底层厂商差异。',
    acceptanceCriteria: [
      '调用经 ai-gateway 统一路由，不直接散落厂商 SDK',
      '生产缺少真实 Provider 时明确失败',
      '会话持久化到 Redis',
    ],
    quotaResource: 'ai_chat',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    const { message, sessionId, systemPrompt, provider, model } = ctx.input || {};
    if (typeof message !== 'string' || !message.trim()) {
      return { ok: false, status: 400, code: 'AI_CHAT_MESSAGE_REQUIRED', error: 'AI 对话需要非空 message' };
    }

    const providerOverride = typeof provider === 'string' ? provider as GatewayProviderName : undefined;
    const modelOverride = typeof model === 'string' && model.trim() ? model.trim() : undefined;
    const config = { systemPrompt: typeof systemPrompt === 'string' ? systemPrompt : undefined };

    try {
      const sid = typeof sessionId === 'string' && sessionId.trim()
        ? sessionId.trim()
        : await aiAgentService.createSession(ctx.userId || 'anon', providerOverride as any);
      const result = await aiAgentService.sendMessage(
        sid,
        message.trim(),
        config,
        { ...(providerOverride ? { provider: providerOverride } : {}), ...(modelOverride ? { model: modelOverride } : {}) }
      );
      return { ok: true, data: { sessionId: sid, ...result } };
    } catch (error: any) {
      return {
        ok: false,
        status: error?.statusCode || error?.status || 503,
        code: error?.code || 'AI_PROVIDER_UNAVAILABLE',
        error: error?.message || 'AI Provider 暂时不可用',
      };
    }
  },
};
