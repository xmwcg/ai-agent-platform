import type { Skill } from '../types';

/**
 * 翻译技能（agency-agents: productivity division）
 * 多语种互译，对接翻译 service。
 */
export const translateSkill: Skill = {
  manifest: {
    id: 'translate',
    name: '智能翻译',
    description: '多语种互译，支持术语表与语气控制。',
    division: 'productivity',
    color: '#52c41a',
    coreMission: '在任意语种间无损传递语义。',
    criticalRules: ['指定源/目标语种', '保留专有名词'],
    successMetrics: ['翻译准确率', '延迟'],
    userStory: '作为用户，我希望在任意语种间无损传递语义，并保留专有名词。',
    acceptanceCriteria: ['指定源/目标语种', '保留专有名词'],
    quotaResource: 'translate',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    return {
      ok: true,
      data: { skill: 'translate', hint: '翻译入口（后端服务见 services/translation）。', input: ctx.input },
    };
  },
};
