import type { Skill } from '../types';
import { aiAgentService } from '../../services/ai-agent';

/**
 * AI 对话技能（agency-agents: ai division）
 * 通过统一 AI 网关路由到具体 provider（见 gateway/ai-gateway.service.ts），
 * 支持 Mock / DeepSeek / 混元 / OpenAI / Anthropic。
 */
export const chatSkill: Skill = {
  manifest: {
    id: 'ai-chat',
    name: 'AI 对话',
    description: '多 Provider 多会话对话，经统一网关路由，支持 RAG 增强与工具调用。',
    division: 'ai',
    color: '#722ed1',
    coreMission: '用最优成本与质量的模型回应用户，统一屏蔽底层厂商差异。',
    criticalRules: ['走 ai-gateway 统一路由，不直接散落 axios 调用', '无 Key 时自动降级 Mock', '会话持久化到 Redis'],
    successMetrics: ['首字延迟可控', '厂商故障自动 fallback'],
    userStory: '作为终端用户，我希望用最优成本与质量的模型对话，而不关心底层厂商差异。',
    acceptanceCriteria: [
      '调用经 ai-gateway 统一路由，不直接散落厂商 SDK',
      '无 Key 时自动降级 Mock',
      '会话持久化到 Redis',
    ],
    quotaResource: 'ai_chat',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    const { message, sessionId, systemPrompt, provider, model } = ctx.input || {};
    if (!sessionId) {
      // 自动建会话
      const sid = await aiAgentService.createSession(ctx.userId || 'anon');
      const res = await aiAgentService.sendMessage(sid, message || '', {
        systemPrompt,
        ...(provider ? { provider } : {}),
      } as any);
      return { ok: true, data: { sessionId: sid, ...res } };
    }
    const res = await aiAgentService.sendMessage(sessionId, message || '', { systemPrompt } as any);
    return { ok: true, data: res };
  },
};
