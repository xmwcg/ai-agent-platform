/**
 * 套餐（Plan）定义 —— 商业变现核心配置
 *
 * 金额单位统一为「分（cent）」，避免浮点误差。
 * limits 中的数值为「单日」配额上限，-1 表示无限制。
 */

export type PlanId = 'free' | 'pro' | 'max';

export type QuotaResource =
  | 'ai_chat' // AI 对话消息数
  | 'rag_query' // RAG 检索次数
  | 'rag_upload' // RAG 文档上传/导入次数
  | 'knowledge_create' // 知识文档创建数
  | 'mcp_create' // MCP 服务器创建数
  | 'mcp_call' // MCP 工具调用次数
  | 'learning_path' // 学习路径 AI 生成次数
  | 'code_explain' // 代码解释次数
  | 'translate' // 翻译次数
  | 'file_convert' // 文件转换次数
  | 'plan_generate' // 方案生成次数
  | 'media_gen' // 媒体生成（图生图/文生视频/图生视频）次数
  | 'cs_query' // 智能客服问答次数
  | 'model_config'; // 自定义模型配置数

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** 月付价格（分） */
  priceMonthly: number;
  /** 年付价格（分），约等于月付 × 10 */
  priceYearly: number;
  /** 计费周期内赠送的「AI 积分」，用于抵扣按量资源 */
  credits: number;
  features: string[];
  limits: Record<QuotaResource, number>;
  highlighted?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: 'free',
    name: '免费版',
    tagline: '体验全部核心功能',
    priceMonthly: 0,
    priceYearly: 0,
    credits: 0,
    features: [
      '每日 20 条 AI 对话',
      '基础 RAG 知识检索',
      '最多 20 篇知识文档',
      '社区支持',
    ],
    limits: {
      ai_chat: 20,
      rag_query: 30,
      rag_upload: 3,
      knowledge_create: 20,
      mcp_create: 1,
      mcp_call: 20,
      learning_path: 3,
      code_explain: 10,
      translate: 10,
      file_convert: 5,
      plan_generate: 3,
      media_gen: 2,
      cs_query: 20,
      model_config: 1,
    },
  },
  pro: {
    id: 'pro',
    name: '专业版',
    tagline: '高频创作者与团队首选',
    priceMonthly: 3900,
    priceYearly: 39000,
    credits: 500,
    features: [
      '每日 500 条 AI 对话',
      '无限 RAG 检索',
      '最多 500 篇知识文档',
      '接入 5 个 MCP 工具服务器',
      '代码解释 / 对比分析 / 文生图',
      '优先邮件支持',
    ],
    limits: {
      ai_chat: 500,
      rag_query: -1,
      rag_upload: 20,
      knowledge_create: 500,
      mcp_create: 5,
      mcp_call: 200,
      learning_path: 50,
      code_explain: 200,
      translate: 200,
      file_convert: 50,
      plan_generate: 30,
      media_gen: 20,
      cs_query: 500,
      model_config: 3,
    },
    highlighted: true,
  },
  max: {
    id: 'max',
    name: '旗舰版',
    tagline: '企业级无限生产力',
    priceMonthly: 9900,
    priceYearly: 99000,
    credits: 2000,
    features: [
      '无限 AI 对话',
      '无限 RAG 检索',
      '无限知识文档',
      '接入 20 个 MCP 工具服务器',
      '专属模型微调通道',
      '7×24 专属客服',
    ],
    limits: {
      ai_chat: -1,
      rag_query: -1,
      rag_upload: -1,
      knowledge_create: -1,
      mcp_create: 20,
      mcp_call: -1,
      learning_path: -1,
      code_explain: -1,
      translate: -1,
      file_convert: -1,
      plan_generate: -1,
      media_gen: -1,
      cs_query: -1,
      model_config: 20,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'max'];

/** 套餐等级，用于权限比较 */
export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

/** 判断 from 套餐是否 >= target 套餐 */
export function planSatisfies(from: PlanId, target: PlanId): boolean {
  return planRank(from) >= planRank(target);
}

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

export const DEFAULT_PLAN: PlanId = 'free';
