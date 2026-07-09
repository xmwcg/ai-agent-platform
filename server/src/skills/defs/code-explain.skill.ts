import type { Skill } from '../types';

/**
 * 代码解释技能（agency-agents: engineering division）
 * 11 语言 × 3 粒度的代码解释与示例生成。
 */
export const codeExplainSkill: Skill = {
  manifest: {
    id: 'code-explain',
    name: '代码解释',
    description: '支持 11 种编程语言、3 档粒度的代码解释与示例生成。',
    division: 'engineering',
    color: '#fa8c16',
    coreMission: '把任意代码段翻译成人话，并给出可运行的示例。',
    criticalRules: ['指定语言与粒度', '输出结构化解释 + 示例'],
    successMetrics: ['解释覆盖率', '示例可运行率'],
    userStory: '作为开发者，我希望把任意代码段翻译成人话并给出可运行示例。',
    acceptanceCriteria: ['指定语言与粒度', '输出结构化解释 + 示例'],
    quotaResource: 'code_explain',
    minRole: 'none',
    requireAuth: false,
    marketable: true,
  },
  async invoke(ctx) {
    return {
      ok: true,
      data: { skill: 'code-explain', hint: '代码解释入口（后端服务见 services/code）。', input: ctx.input },
    };
  },
};
