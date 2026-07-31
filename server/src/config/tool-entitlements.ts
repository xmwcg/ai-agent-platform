import { PlanId } from './billing';

export interface ToolEntitlement {
  id: string;
  category: string;
  label: string;
  requiredPlan: PlanId;
  /** 免费用户可按次使用的积分成本；会员用户不额外扣积分。 */
  creditCost: number;
  resource: 'ai_chat';
}

const FREE_TOOL_IDS = [
  'copywriting', 'ppt', 'script', 'story', 'swot',
  'code-explain', 'sql-gen', 'api-doc', 'regex',
  'email', 'meeting', 'weekly', 'translate', 'plan', 'convert',
];

const PRO_TOOL_IDS = [
  'invest', 'data', 'competitor',
  'ecommerce', 'douyin', 'wechat', 'seo',
  'resume', 'contract', 'law', 'bizplan', 'media',
];

const LABELS: Record<string, string> = {
  copywriting: '文案生成', ppt: 'PPT大纲', script: '视频脚本', story: '小说创作',
  invest: '投资分析', data: '数据分析', swot: 'SWOT分析', competitor: '竞品分析',
  'code-explain': '代码解释', 'sql-gen': 'SQL生成', 'api-doc': 'API文档', regex: '正则表达式',
  ecommerce: '电商文案', douyin: '抖音脚本', wechat: '微信推文', seo: 'SEO优化',
  resume: '简历优化', contract: '合同审查', law: '法律咨询', bizplan: '商业计划书',
  email: '邮件撰写', meeting: '会议纪要', weekly: '周报生成',
  translate: '翻译', plan: '方案生成', convert: '文件转换', media: '内容生产',
};

const CATEGORY_BY_ID: Record<string, string> = {
  copywriting: 'creative', ppt: 'creative', script: 'creative', story: 'creative',
  invest: 'analysis', data: 'analysis', swot: 'analysis', competitor: 'analysis',
  'code-explain': 'dev', 'sql-gen': 'dev', 'api-doc': 'dev', regex: 'dev',
  ecommerce: 'marketing', douyin: 'marketing', wechat: 'marketing', seo: 'marketing',
  resume: 'business', contract: 'business', law: 'business', bizplan: 'business',
  email: 'office', meeting: 'office', weekly: 'office',
  translate: 'legacy', plan: 'legacy', convert: 'legacy', media: 'legacy',
};

export const TOOL_ENTITLEMENTS: Record<string, ToolEntitlement> = Object.fromEntries(
  [...FREE_TOOL_IDS, ...PRO_TOOL_IDS].map((id) => {
    const requiredPlan: PlanId = FREE_TOOL_IDS.includes(id) ? 'free' : 'pro';
    return [id, {
      id,
      category: CATEGORY_BY_ID[id] || 'legacy',
      label: LABELS[id] || id,
      requiredPlan,
      creditCost: requiredPlan === 'free' ? 0 : 10,
      resource: 'ai_chat',
    } satisfies ToolEntitlement];
  })
);

export function getToolEntitlement(toolId?: string): ToolEntitlement | undefined {
  if (!toolId) return undefined;
  return TOOL_ENTITLEMENTS[toolId];
}
