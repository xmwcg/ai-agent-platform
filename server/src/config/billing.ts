/**
 * 套餐（Plan）定义 —— 商业变现核心配置
 *
 * 金额单位统一为「分（cent）」，避免浮点误差。
 * limits 中的数值为「单日」配额上限，-1 表示无限制。
 *
 * ─── 2026-07 定价重塑 v2：阶梯折扣策略 ───
 * 对标竞品（Coze ¥99/月、Gamma $8–20/月），全系定价压到竞品 1/5~1/10。
 * 每档设置竞品参考原价（显示删除线），现价为原价的 6-8 折：
 *   免费版  ¥0 ｜ 专业版 ¥9.9/月 (竞品¥99, 1折) ｜ 旗舰版 ¥19.9/月 (竞品¥199, 1折)
 *   月付 = 基准价，年付 = 月付×10（相当于买10送2，约83折）
 * 底气：自带 Key 成本转嫁（毛利→90%+）+ 网关路由最便宜模型 + 轻量架构。
 */

export type PlanId = 'free' | 'pro' | 'max' | 'team' | 'enterprise';

export type QuotaResource =
  | 'ai_chat'
  | 'rag_query'
  | 'rag_upload'
  | 'knowledge_create'
  | 'mcp_create'
  | 'mcp_call'
  | 'learning_path'
  | 'code_explain'
  | 'translate'
  | 'flow_sync'
  | 'file_convert'
  | 'plan_generate'
  | 'media_gen'
  | 'cs_query'
  | 'model_config'
  | 'project_grade_url_scan'
  | 'project_grade_source_scan'
  | 'project_grade_evaluation'
  | 'project_grade_report_publish'
  | 'project_grade_report_download';

export interface ProjectGradePlanEntitlements {
  activeProjects: number;
  reportPublishEnabled: boolean;
  reportDownloadEnabled: boolean;
  reportValidityDays: number;
  removeAibakBranding: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** 月付价格（分） */
  priceMonthly: number;
  /** 年付价格（分），= 月付 × 10 */
  priceYearly: number;
  /** 竞品参考月价（分），前端展示删除线原价，null=不展示 */
  competitorMonthly: number | null;
  /** 折扣标签文本，null=不展示折扣角标 */
  discountLabel: string | null;
  /** 计费周期内赠送的「AI 积分」 */
  credits: number;
  features: string[];
  limits: Record<QuotaResource, number>;
  projectGrade: ProjectGradePlanEntitlements;
  highlighted?: boolean;
  seats?: number;
}

export const PLANS = {
  free: {
    id: 'free',
    name: '免费版',
    tagline: '零门槛体验全部核心功能',
    priceMonthly: 0,
    priceYearly: 0,
    competitorMonthly: null,
    discountLabel: null,
    credits: 0,
    features: [
      '每日 20 条 AI 对话',
      '基础 RAG 知识检索',
      '最多 20 篇知识文档',
      '智评通 1 个活动项目 · 每日 3 次网址体检',
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
      flow_sync: 5,
      file_convert: 5,
      plan_generate: 3,
      media_gen: 2,
      cs_query: 20,
      model_config: 1,
      project_grade_url_scan: 3,
      project_grade_source_scan: 0,
      project_grade_evaluation: 1,
      project_grade_report_publish: 0,
      project_grade_report_download: 0,
    },
    projectGrade: {
      activeProjects: 1,
      reportPublishEnabled: false,
      reportDownloadEnabled: false,
      reportValidityDays: 0,
      removeAibakBranding: false,
    },
  },
  pro: {
    id: 'pro',
    name: '专业版',
    tagline: '创作者性价比之王 · 竞品 1 折',
    priceMonthly: 990,     // ¥9.9/月（竞品 Coze ¥99/月 的 1/10）
    priceYearly: 9900,     // 年付 ¥99（月付×10，省¥19.8）
    competitorMonthly: 9900, // 竞品参考 ¥99/月（展示删除线）
    discountLabel: '1折',
    credits: 500,
    features: [
      '每日 500 条 AI 对话',
      '无限 RAG 检索',
      '最多 500 篇知识文档',
      '接入 5 个 MCP 工具服务器',
      '完整媒体生成（文生图/视频）',
      '智评通 5 个项目 · 30 天报告',
      '邮件工单支持',
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
      flow_sync: 200,
      file_convert: 50,
      plan_generate: 30,
      media_gen: 20,
      cs_query: 500,
      model_config: 3,
      project_grade_url_scan: 20,
      project_grade_source_scan: 5,
      project_grade_evaluation: 10,
      project_grade_report_publish: 3,
      project_grade_report_download: 10,
    },
    projectGrade: {
      activeProjects: 5,
      reportPublishEnabled: true,
      reportDownloadEnabled: true,
      reportValidityDays: 30,
      removeAibakBranding: false,
    },
    highlighted: true,
  },
  max: {
    id: 'max',
    name: '旗舰版',
    tagline: '个人无限生产力 · 竞品 1 折',
    priceMonthly: 1990,     // ¥19.9/月（竞品 Gamma $20≈¥145/月 的 1/7）
    priceYearly: 19900,     // 年付 ¥199（月付×10，省¥39.8）
    competitorMonthly: 14500, // 竞品参考 ¥145/月（展示删除线）
    discountLabel: '1折',
    credits: 2000,
    features: [
      '无限 AI 对话',
      '无限 RAG 检索',
      '无限知识文档',
      '接入 20 个 MCP 工具服务器',
      '专属模型微调通道',
      '智评通 20 个活动项目 · 180 天报告 · 去品牌',
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
      flow_sync: -1,
      file_convert: -1,
      plan_generate: -1,
      media_gen: -1,
      cs_query: -1,
      model_config: 20,
      project_grade_url_scan: 100,
      project_grade_source_scan: 25,
      project_grade_evaluation: 50,
      project_grade_report_publish: 20,
      project_grade_report_download: 100,
    },
    projectGrade: {
      activeProjects: 20,
      reportPublishEnabled: true,
      reportDownloadEnabled: true,
      reportValidityDays: 180,
      removeAibakBranding: true,
    },
  },
  team: {
    id: 'team',
    name: '团队版',
    tagline: '企业级赋能 · 竞品 1 折',
    priceMonthly: 9900,     // ¥99/月（竞品 ¥990/月 的 1/10）
    priceYearly: 99000,     // 年付 ¥990（月付×10，省¥198）
    competitorMonthly: 99000, // 竞品参考 ¥990/月（展示删除线）
    discountLabel: '1折',
    credits: 5000,
    seats: 20,
    features: [
      '包含旗舰版全部权益',
      '最多 20 名团队成员',
      '团队共享知识库与配额池',
      '团队管理后台与权限分级',
      '统一账单与成本中心',
      '智评通 100 个活动项目 · 365 天企业报告',
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
      flow_sync: -1,
      file_convert: -1,
      plan_generate: -1,
      media_gen: -1,
      cs_query: -1,
      model_config: 50,
      project_grade_url_scan: 500,
      project_grade_source_scan: 100,
      project_grade_evaluation: 250,
      project_grade_report_publish: 100,
      project_grade_report_download: -1,
    },
    projectGrade: {
      activeProjects: 100,
      reportPublishEnabled: true,
      reportDownloadEnabled: true,
      reportValidityDays: 365,
      removeAibakBranding: true,
    },
  },
  enterprise: {
    id: 'enterprise',
    name: '企业版',
    tagline: '企业级全套解决方案 · 竞品 5 折',
    priceMonthly: 49900,
    priceYearly: 499000,
    competitorMonthly: 99900,
    discountLabel: '5折',
    credits: 99999,
    seats: 50,
    features: [
      '包含团队版全部权益',
      '最多 50 名团队成员',
      '企业白标（自有品牌）',
      '定制化培训与导入',
      '私有化部署支持',
      '智评通不限项目 · 永久报告',
      '专属技术客户经理',
    ],
    limits: {
      ai_chat: -1, rag_query: -1, rag_upload: -1, knowledge_create: -1,
      mcp_create: -1, mcp_call: -1, learning_path: -1, code_explain: -1,
      translate: -1, flow_sync: -1, file_convert: -1, plan_generate: -1,
      media_gen: -1, cs_query: -1, model_config: -1,
      project_grade_url_scan: -1, project_grade_source_scan: -1,
      project_grade_evaluation: -1, project_grade_report_publish: -1,
      project_grade_report_download: -1,
    },
    projectGrade: {
      activeProjects: -1,
      reportPublishEnabled: true,
      reportDownloadEnabled: true,
      reportValidityDays: 365,
      removeAibakBranding: true,
    },
  },
};

export const QUOTA_RESOURCE_LABELS: Record<QuotaResource, string> = {
  ai_chat: 'AI 对话',
  rag_query: 'RAG 检索',
  rag_upload: 'RAG 文档上传',
  knowledge_create: '知识文档创建',
  mcp_create: 'MCP 服务器创建',
  mcp_call: 'MCP 工具调用',
  learning_path: '学习路径生成',
  code_explain: '代码解释',
  translate: '翻译',
  flow_sync: '知识库同步',
  file_convert: '文件转换',
  plan_generate: '方案生成',
  media_gen: '媒体生成',
  cs_query: '智能客服问答',
  model_config: '自定义模型配置',
  project_grade_url_scan: '智评通网址扫描',
  project_grade_source_scan: '智评通源码扫描',
  project_grade_evaluation: '智评通正式评估',
  project_grade_report_publish: '智评通报告发布',
  project_grade_report_download: '智评通报告下载',
};

export const PLAN_ORDER: PlanId[] = ['free', 'pro', 'max', 'team', 'enterprise'];

export function planRank(plan: PlanId): number {
  return PLAN_ORDER.indexOf(plan);
}

export function planSatisfies(from: PlanId, target: PlanId): boolean {
  return planRank(from) >= planRank(target);
}

export function getPlan(id: PlanId): Plan {
  return PLANS[id] as Plan;
}

export const DEFAULT_PLAN: PlanId = 'free';

/* ============================================================
 * 按次积分成本
 * ============================================================ */
export type PayPerUseResource = 'media_image' | 'media_video' | 'media_image2video' | 'api_chat';

export const PER_USE_COST: Record<PayPerUseResource, number> = {
  media_image: 20,
  media_video: 200,
  media_image2video: 200,
  api_chat: 10,
};

export const BYOK_PREFERRED_RESOURCES: PayPerUseResource[] = ['media_video', 'media_image2video', 'api_chat'];

/* ============================================================
 * 单用户「日 AI 成本预算」（fen）
 * ============================================================ */
export const PLAN_AI_BUDGET_FEN: Record<string, number> = {
  free: 50,
  pro: 500,
  max: -1,
  team: -1,
  enterprise: -1,
};

export const COST_WARN_RATIO = 0.7;

/* ============================================================
 * 年付折扣率（月付×10 = 约 83 折，买 10 送 2）
 * ============================================================ */
export const YEARLY_DISCOUNT_PCT = 17; // 年付省 17%

