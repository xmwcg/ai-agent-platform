import type { Skill } from '../types';

/**
 * 智能客服技能（agency-agents: customer-service division）
 * 基于知识库 RAG 的问答机器人，可绑定知识文档、返回来源引用、转人工。
 */
export const customerServiceSkill: Skill = {
  manifest: {
    id: 'customer-service',
    name: '智能客服',
    description: '基于 RAG 的客服问答，可绑定知识文档、返回来源引用、触发转人工与满意度评分。',
    division: 'customer-service',
    color: '#13c2c2',
    coreMission: '让客服回答可信、可追责，并能在需要时平滑转人工。',
    criticalRules: ['答案必须带来源引用（docId/标题/置信度）', '命中触发词转人工', '归属团队会话受 member+ 守卫'],
    successMetrics: ['用户满意度评分采集率', '转人工准确率'],
    userStory: '作为企业用户，我希望客服回答可信可追责，并在需要时平滑转人工。',
    acceptanceCriteria: [
      '答案带来源引用（docId/标题/置信度）',
      '命中触发词转人工',
      '归属团队会话受 member+ 守卫',
    ],
    quotaResource: 'cs_query',
    minRole: 'none',
    requireAuth: false,
    marketable: false,
    invokable: false,
  },
  async invoke() {
    return {
      ok: false,
      status: 501,
      code: 'SKILL_ROUTE_ONLY',
      error: '智能客服需通过 /api/customer-service/chat/:embedCode 调用，通用技能入口未开放',
    };
  },
};
