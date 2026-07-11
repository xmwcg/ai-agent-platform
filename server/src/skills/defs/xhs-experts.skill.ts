import type { Skill, SkillDivision } from '../types';
import { XHS_AGENTS, generateXhsCopy, type XhsRole } from '../../services/xhs-copy.service';

/**
 * 小红书专家技能组（把 xhs-copy.service 的 4 个专家角色注册为可上架/调用的内置技能）
 * ----------------------------------------------------------------
 * 复用 generateXhsCopy()（内部走统一 AI 网关 route，含 provider 选择 / fallback / mock 兜底）。
 * 注册后：
 *   - GET /api/skills            会列出这 4 个技能
 *   - GET /api/skills/market     会列出（均 marketable=true）
 *   - POST /api/skills/:id/invoke 可直接调用（消耗 ai_chat 配额）
 *
 * 调用入参（body）：
 *   { product: string(必填), audience?, style?, keywords?, count?(仅 copywriter) }
 */

/** 每个角色的技能上架元数据（分类 / 主题色 / 使命等） */
const ROLE_META: Record<
  XhsRole,
  { division: SkillDivision; color: string; coreMission: string; tags: string[] }
> = {
  copywriter: {
    division: 'media',
    color: '#ec4899',
    coreMission: '基于产品卖点产出高点击、高互动的小红书结构化爆款文案。',
    tags: ['小红书', '文案', '创作', '种草'],
  },
  architect: {
    division: 'engineering',
    color: '#6366f1',
    coreMission: '把业务需求转化为可落地的 RESTful API 架构与认证/限流/权限设计。',
    tags: ['架构', 'API', '系统设计'],
  },
  frontend: {
    division: 'engineering',
    color: '#0ea5e9',
    coreMission: '按 API 规范产出可嵌入 Web 站的 HTML/CSS/JS 组件方案。',
    tags: ['前端', '组件', 'Web'],
  },
  devops: {
    division: 'productivity',
    color: '#22c55e',
    coreMission: '规划生产环境部署、环境变量与监控配置，输出可执行的部署检查清单。',
    tags: ['运维', '部署', 'DevOps'],
  },
};

/** 根据单个专家 Agent 生成一个可注册的 Skill */
function buildXhsSkill(agent: (typeof XHS_AGENTS)[number]): Skill {
  const meta = ROLE_META[agent.id];
  return {
    manifest: {
      id: `xhs-${agent.id}`,
      name: `小红书·${agent.name}`,
      description: agent.description,
      division: meta.division,
      color: meta.color,
      coreMission: meta.coreMission,
      criticalRules: [
        '必须走统一 AI 网关（route），不直接调用厂商 SDK',
        'product（产品卖点/主题）为必填入参，缺失时直接报错',
        '无可用 provider 时回退 Mock 并给出提示',
        ...(agent.id === 'copywriter' ? ['文案角色需尝试结构化解包（title/body/hashtags/imageSuggestions）'] : []),
      ],
      successMetrics: agent.id === 'copywriter' ? ['标题有钩子', '话题标签合规', '结构可解析'] : ['方案可落地', '结构清晰'],
      quotaResource: 'ai_chat',
      minRole: 'none',
      requireAuth: false,
      marketable: true,
      userStory: `作为用户，我希望调用「${agent.name}」快速获得高质量产出，从而降低创作/设计成本。`,
      acceptanceCriteria: [
        '传入 product 后返回 reply（文案角色附带 structured）',
        '支持 audience/style/keywords 可选参数',
        'Mock 模式下零依赖可跑通',
      ],
      qualityCriteria: ['输出忠实于输入卖点', '不夸大/不虚假宣传'],
      references: ['xhs-copy.service', 'ai-gateway route()'],
    },
    async invoke(ctx) {
      const input = ctx.input || {};
      const product = input.product ?? input.text ?? input.input ?? input.query;
      if (!product || typeof product !== 'string' || !product.trim()) {
        return { ok: false, error: `xhs-${agent.id} 需要 product（产品卖点/主题）` };
      }
      try {
        const result = await generateXhsCopy({
          role: agent.id,
          product: String(product).trim(),
          audience: typeof input.audience === 'string' ? input.audience.trim() : undefined,
          style: typeof input.style === 'string' ? input.style.trim() : undefined,
          keywords: typeof input.keywords === 'string' ? input.keywords.trim() : undefined,
          count: typeof input.count === 'number' ? input.count : undefined,
          model: typeof input.model === 'string' ? input.model.trim() : undefined,
        });
        return { ok: true, data: result };
      } catch (e: any) {
        return { ok: false, error: `生成失败：${e.message}（请确认已配置厂商 Key 或启用 ENABLE_MOCK_MODE）` };
      }
    },
  };
}

/** 4 个小红书专家技能（供 registry 注册） */
export const xhsExpertSkills: Skill[] = XHS_AGENTS.map(buildXhsSkill);
