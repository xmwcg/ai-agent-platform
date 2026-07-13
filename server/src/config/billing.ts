/**
 * 套餐（Plan）定义 —— 商业变现核心配置
 *
 * 金额单位统一为「分（cent）」，避免浮点误差。
 * limits 中的数值为「单日」配额上限，-1 表示无限制。
 *
 * ─── 2026-07 定价重塑：1/10 破局策略 ───
 * 对标竞品（Coze ¥99/月、Gamma $8–20/月），全系定价压到约 1/10：
 *   免费版 ¥0 ｜ 专业版 ¥9.9/月 ｜ 旗舰版 ¥19.9/月 ｜ 团队版 ¥99/月
 * 底气：自带 Key 成本转嫁（毛利→90%+）+ 网关路由最便宜模型 + 轻量架构。
 */

export type PlanId = 'free' | 'pro' | 'max' | 'team';

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
  /** 团队席位（仅团队版 > 1） */
  seats?: number;
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
    tagline: '高频创作者性价比之选（竞品 1/10 定价）',
    priceMonthly: 990, // ¥9.9/月（Coze ¥99 的 1/10）
    priceYearly: 9900,
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
    tagline: '个人无限生产力（竞品 1/5 定价）',
    priceMonthly: 1990, // ¥19.9/月（Gamma $8–20 的 1/10≈¥）
    priceYearly: 19900,
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
  team: {
    id: 'team',
    name: '团队版',
    tagline: '多人协作 · 企业级赋能（约竞品团队版 1/10）',
    priceMonthly: 9900, // ¥99/月（含旗舰权益 + 20 席位）
    priceYearly: 99000,
    credits: 5000,
    seats: 20,
    features: [
      '包含旗舰版全部权益',
      '最多 20 名团队成员',
      '团队共享知识库与配额池',
      '团队管理后台与权限分级',
      '统一账单与成本中心',
      '优先工单 + 专属客户成功',
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
      model_config: 50,
    },
  },
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'max', 'team'];

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

/* ============================================================
 * 按次积分成本（成本转嫁层，避免垫付被击穿）
 * ------------------------------------------------------------
 * 聊天/RAG 等低成本资源包在订阅里（方案A 垫付，靠日配额锁成本）；
 * 文生图/视频/开放API 等"重成本资源"必须按次从积分扣（用户实付成本+加价），
 * 绝不能包在订阅里白送，否则媒体生成会击穿毛利。
 * 价格为「分」，按预估厂商成本 + 毛利加价设定。
 * ============================================================ */
export type PayPerUseResource = 'media_image' | 'media_video' | 'media_image2video' | 'api_chat';

export const PER_USE_COST: Record<PayPerUseResource, number> = {
  media_image: 20,        // 文生图：约 ¥0.2/次（成本+加价）
  media_video: 200,       // 文生视频：约 ¥2/次
  media_image2video: 200, // 图生视频：约 ¥2/次
  api_chat: 10,           // 开放API聊天：约 ¥0.1/次
};

/** 方案B（BYOK）强制场景：这些资源在旗舰/企业版下优先走用户自带 key，平台零边际成本 */
export const BYOK_PREFERRED_RESOURCES: PayPerUseResource[] = ['media_video', 'media_image2video', 'api_chat'];

/* ============================================================
 * 单用户「日 AI 成本预算」（fen）——低成本变现的成本阀门
 * ------------------------------------------------------------
 * 是垫付模式（方案A）的第二道闸门（第一道是日配额上限）。
 * 估算逻辑：聊天约 ¥1.5/百万 token 混合成本，单条对话≈1500 token≈0.00225 元≈0.225 分。
 * 预算按"典型重度使用"而非"用满配额"设定，逼近即告警、超限即限流。
 * ============================================================ */
export const PLAN_AI_BUDGET_FEN: Record<PlanId, number> = {
  free: 50,    // 约 220 条对话/日的成本上限
  pro: 500,    // 约 2200 条/日
  max: -1,     // 旗舰无限（但仍受日配额闸门约束）
  team: -1,    // 团队无限（团队成本由席位管理费覆盖）
};

/** 成本预警阈值：当日成本达到预算的该比例时触发通知告警 */
export const COST_WARN_RATIO = 0.7;
