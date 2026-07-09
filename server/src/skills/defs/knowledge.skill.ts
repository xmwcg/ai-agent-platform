import type { Skill } from '../types';

/**
 * 知识中枢技能（agency-agents: knowledge division）
 * 封装知识文档的检索与写入，对接 KnowledgeDocument 模型与团队资源级隔离。
 */
export const knowledgeSkill: Skill = {
  manifest: {
    id: 'knowledge',
    name: '知识中枢',
    description: 'Markdown 知识文档的检索、写入与全文搜索，支持团队归属与角色隔离。',
    division: 'knowledge',
    color: '#1677ff',
    coreMission: '把分散的知识沉淀为可检索、可共享、可隔离的团队资产。',
    criticalRules: [
      '私有文档仅对作者本人与归属团队成员可见（viewer+）',
      '编辑 / 删除需团队成员角色 member+',
      '写入时自动带上 author 与 teamId',
    ],
    successMetrics: ['文档可被团队内成员检索', '越权访问被拒绝'],
    userStory: '作为团队成员，我希望安全地检索与沉淀知识文档，从而让团队资产可共享且隔离。',
    acceptanceCriteria: [
      '私有文档仅作者与归属团队成员可见（viewer+）',
      '编辑/删除需 member+ 角色',
      '写入自动带上 author 与 teamId',
    ],
    quotaResource: 'knowledge_create',
    minRole: 'viewer',
    requireAuth: true,
    marketable: false,
  },
  async invoke(ctx) {
    // 实际写入 / 检索逻辑在 routes/knowledge.ts 内落实团队隔离，
    // 此处作为技能入口统一返回元数据驱动的调用骨架。
    return {
      ok: true,
      data: {
        skill: 'knowledge',
        hint: '检索/写入知识文档；团队隔离由路由层 canAccessResource 守卫。',
        input: ctx.input,
      },
    };
  },
};
