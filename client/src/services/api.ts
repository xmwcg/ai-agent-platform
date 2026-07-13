import axios, { AxiosInstance, AxiosError } from 'axios';

// 创建 axios 实例
const apiClient: AxiosInstance = axios.create({
  baseURL: '/api',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

/**
 * 统一从 axios 错误中提取可展示给用户的提示文案。
 * 优先取后端统一错误体 { error } / { message }，其次网络层兜底。
 */
export function extractApiError(err: unknown, fallback = '操作失败，请稍后重试'): string {
  if (axios.isAxiosError(err)) {
    const e = err as AxiosError<{ error?: string; message?: string }>;
    const data = e.response?.data;
    if (data?.error) return data.error;
    if (data?.message) return data.message;
    if (e.message) return e.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}

// 请求拦截器
apiClient.interceptors.request.use(
  (config) => {
    // 可以在这里添加 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器：统一错误日志，错误体交由各页面通过 extractApiError 收敛展示
apiClient.interceptors.response.use(
  (response) => response.data,
  (error) => {
    console.error('❌ API Error:', extractApiError(error));
    return Promise.reject(error);
  }
);

// 知识文档 API
export const knowledgeAPI = {
  // 创建文档
  create: (data: {
    title: string;
    content: string;
    tags?: string[];
    categories?: string[];
    isPublic?: boolean;
  }) => apiClient.post('/knowledge', data),

  // 获取文档列表
  list: (params?: {
    page?: number;
    limit?: number;
    search?: string;
    tags?: string;
    categories?: string;
    sortBy?: string;
    order?: 'asc' | 'desc';
  }) => apiClient.get('/knowledge', { params }),

  // 获取文档详情
  getById: (id: string) => apiClient.get(`/knowledge/${id}`),

  // 更新文档
  update: (id: string, data: any) => apiClient.put(`/knowledge/${id}`, data),

  // 删除文档
  delete: (id: string) => apiClient.delete(`/knowledge/${id}`),

  // 获取标签和分类
  getMeta: () => apiClient.get('/knowledge/meta/tags-and-categories'),
  // 业务分类树（知识库 v2 固定分类）
  getCategoryTree: () => apiClient.get('/knowledge/meta/category-tree'),
};

// 知识图谱 API
export const knowledgeGraphAPI = {
  get: (params?: {
    teamId?: string;
    includeTags?: boolean;
    includeCategories?: boolean;
    minSharedTags?: number;
    limit?: number;
  }) => apiClient.get('/knowledge-graph', { params })
};

// 实践沙盒 API
export const sandboxAPI = {
  run: (data: { language: string; code: string; mode?: string }) =>
    apiClient.post('/sandbox/run', data),
  status: () => apiClient.get('/sandbox/status')
};

// AI 聊天 API
export const aiAPI = {
  // 发送聊天消息
  chat: (data: {
    message: string;
    history?: any[];
    sessionId?: string;
    provider?: string;
    model?: string;
  }) => apiClient.post('/ai/chat', data),

  // 获取可用模型（旧：仅 provider 维度，保留兼容）
  getModels: () => apiClient.get('/ai/models'),

  // 测试 Provider 连接
  testProvider: (provider: string) => apiClient.get(`/ai/test/${provider}`)
};

// AI 网关 API（统一模型选择器数据源：内置 + 第三方自定义模型）
export const gatewayAPI = {
  // 列出全部可选模型（内置厂商 + 用户自定义 mc_<id>）
  getModels: () => apiClient.get('/gateway/models'),
};

export default apiClient;

// 计费 / 订阅 API
export const billingAPI = {
  getPlans: () => apiClient.get('/billing/plans'),
  getSubscription: () => apiClient.get('/billing/subscription'),
  getCreditsPackages: () => apiClient.get('/billing/credits-packages'),
  createOrder: (data: { plan: 'free' | 'pro' | 'max' | 'team'; period: 'monthly' | 'yearly'; provider?: string }) =>
    apiClient.post('/billing/orders', data),
  createCreditsOrder: (data: { packageId: string; provider?: string }) =>
    apiClient.post('/billing/credits-packages/order', data),
  mockPay: (orderNo: string) => apiClient.get(`/billing/orders/${orderNo}/pay`),
  // 查询订单支付状态（前端扫码后轮询；真实网关会主动查单兜底激活）
  getOrderStatus: (orderNo: string) => apiClient.get(`/billing/orders/${orderNo}/status`),
  cancelSubscription: () => apiClient.post('/billing/subscription/cancel'),
  getOrders: () => apiClient.get('/billing/orders/history'),
  getOrderDetail: (orderNo: string) => apiClient.get(`/billing/orders/${orderNo}/detail`),
  getPaymentStatus: () => apiClient.get('/billing/payment-status'),
  // 已启用的支付方式（前端据此动态展示入口，缺密钥的渠道自动隐藏）
  getPaymentMethods: () => apiClient.get('/billing/payment-methods'),
  getWebhookEvents: (params?: { page?: number; limit?: number; status?: string }) =>
    apiClient.get('/billing/webhook-events', { params }),
};

// 模型发布日历 API
export const modelCalendarAPI = {
  list: (params?: { vendor?: string; type?: string; from?: string; to?: string }) =>
    apiClient.get('/model-calendar', { params }),
  getById: (id: string) => apiClient.get(`/model-calendar/${id}`),
  create: (data: {
    modelName: string;
    vendor: string;
    releaseDate: string;
    type?: 'release' | 'update' | 'deprecation';
    description?: string;
    highlights?: string[];
  }) => apiClient.post('/model-calendar', data),
};

// 学习路径 API
export const learningPathAPI = {
  templates: (level: 'beginner' | 'intermediate' | 'advanced') =>
    apiClient.get('/learning-path/templates', { params: { level } }),
  generate: (data: {
    level?: 'beginner' | 'intermediate' | 'advanced';
    goal?: string;
    interests?: string;
  }) => apiClient.post('/learning-path/generate', data),
};

// 代码解释 API
export const codeAPI = {
  explain: (data: {
    code: string;
    language: string;
    level?: 'brief' | 'detailed' | 'teaching';
    context?: string;
  }) => apiClient.post('/code/explain', data),
  example: (data: { concept: string; language: string }) =>
    apiClient.post('/code/example', data),
  languages: () => apiClient.get('/code/languages'),
};

// 个人中心 API
export const profileAPI = {
  get: () => apiClient.get('/auth/profile'),
  update: (data: { name?: string; avatar?: string }) =>
    apiClient.put('/auth/profile', data),
};

// 大模型配置中心 API
export const modelConfigAPI = {
  list: () => apiClient.get('/model-config'),
  available: () => apiClient.get('/model-config/available'),
  create: (data: {
    name: string; provider: string; baseURL: string; apiKey: string;
    models?: string[]; defaultModel: string; description?: string;
  }) => apiClient.post('/model-config', data),
  update: (id: string, data: any) => apiClient.put(`/model-config/${id}`, data),
  remove: (id: string) => apiClient.delete(`/model-config/${id}`),
  setDefault: (id: string) => apiClient.post(`/model-config/${id}/set-default`, {}),
  test: (id: string, model?: string) => apiClient.post(`/model-config/${id}/test`, model ? { model } : {}),
  builtinProviders: () => apiClient.get('/model-config/providers/builtin'),
  // 自动获取厂商模型清单（15s 超时 + 服务端缓存，修复慢/网络错误）
  fetchModels: (data: { baseURL: string; apiKey: string }) =>
    apiClient.post('/model-config/providers/fetch-models', data),
  // 平台免费额度（云函数 4 个免费模型）元信息
  aibakFree: () => apiClient.get('/model-config/providers/aibak-free'),
};

// 智能客服 API
export const customerServiceAPI = {
  list: () => apiClient.get('/customer-service'),
  create: (data: any) => apiClient.post('/customer-service', data),
  update: (id: string, data: any) => apiClient.put(`/customer-service/${id}`, data),
  remove: (id: string) => apiClient.delete(`/customer-service/${id}`),
  embedScript: (id: string) => apiClient.get(`/customer-service/${id}/embed-script`),
  sessions: (id: string) => apiClient.get(`/customer-service/${id}/sessions`),
  // 合规审计日志（可信客服差异化能力）
  auditLogs: (id: string, params?: { from?: string; to?: string; escalatedOnly?: boolean; minSatisfaction?: number; page?: number; pageSize?: number }) =>
    apiClient.get(`/customer-service/${id}/audit-logs`, { params }),
  auditExport: (id: string, format: 'json' | 'csv' = 'csv') =>
    apiClient.get(`/customer-service/${id}/audit-logs/export?format=${format}`, { responseType: 'blob' }),
  auditStats: (id: string) => apiClient.get(`/customer-service/${id}/audit-stats`),
  // 公开对话（嵌入脚本调用）
  chatPublic: (embedCode: string, data: { message: string; visitorId?: string; sessionId?: string }) =>
    apiClient.post(`/cs/chat/${embedCode}`, data),
};

// 工具箱 API（翻译/方案/转换/媒体生成）
export const toolsAPI = {
  languages: () => apiClient.get('/tools/translate/languages'),
  translate: (data: { text: string; targetLang: string; sourceLang?: string }) =>
    apiClient.post('/tools/translate', data),
  generatePlan: (data: {
    topic: string; type?: string; audience?: string;
    length?: string; requirements?: string;
  }) => apiClient.post('/tools/plan', data),
  convertFormats: () => apiClient.get('/tools/convert/formats'),
  convert: (data: { fileName: string; sourceFormat: string; targetFormat: string; content?: string }) =>
    apiClient.post('/tools/convert', data),
  mediaTypes: () => apiClient.get('/tools/media/types'),
  mediaGenerate: (data: {
    type: 'image2image' | 'text2video' | 'image2video';
    prompt: string; imageBase64?: string; negativePrompt?: string;
    duration?: number; size?: string; style?: string;
  }) => apiClient.post('/tools/media', data),
  mediaProviders: () => apiClient.get('/tools/media/providers'),
  mediaTask: (provider: string, taskId: string) =>
    apiClient.get(`/tools/media/task/${provider}/${taskId}`),
};

// 团队 RBAC API
export const teamAPI = {
  create: (data: { name: string; plan?: string }) => apiClient.post('/team', data),
  mine: () => apiClient.get('/team/mine'),
  get: (id: string) => apiClient.get(`/team/${id}`),
  invite: (id: string, data: { userId: string; role?: string }) =>
    apiClient.post(`/team/${id}/members`, data),
  updateRole: (id: string, userId: string, data: { role: string }) =>
    apiClient.put(`/team/${id}/members/${userId}`, data),
  remove: (id: string, userId: string) =>
    apiClient.delete(`/team/${id}/members/${userId}`),
  removeTeam: (id: string) => apiClient.delete(`/team/${id}`),
  generateInvite: (id: string) => apiClient.post(`/team/${id}/invite`),
  revokeInvite: (id: string) => apiClient.delete(`/team/${id}/invite`),
  joinViaInvite: (code: string) => apiClient.post(`/team/join/${code}`),
  getAudit: (id: string, params?: { page?: number; pageSize?: number; action?: string }) =>
    apiClient.get(`/team/${id}/audit`, { params }),
};

// 开放 API 市场（按量计费） API
export const marketplaceAPI = {
  createKey: (data: { name: string; quotaDaily?: number; scopes?: string[]; creditsEnabled?: boolean }) =>
    apiClient.post('/marketplace/api-keys', data),
  listKeys: () => apiClient.get('/marketplace/api-keys'),
  revokeKey: (id: string) => apiClient.delete(`/marketplace/api-keys/${id}`),
  usage: () => apiClient.get('/marketplace/usage'),
  /** 用量报表（按密钥每日聚合） */
  usageReport: (from: string, to: string) =>
    apiClient.get('/marketplace/usage/report', { params: { from, to } }),
  /** 用量导出下载（CSV） */
  exportUsage: (from: string, to: string) =>
    apiClient.get('/marketplace/usage/export', { params: { from, to, format: 'csv' }, responseType: 'blob' }),
  /** 切换积分抵扣开关 */
  toggleCredits: (id: string) => apiClient.patch(`/marketplace/api-keys/${id}/toggle-credits`),
};

// 媒体生成 BYOK（用户自带 Key 管理）API
export type MediaByokProvider = 'hunyuan' | 'keling' | 'jimeng';
export interface MediaByokKey {
  _id?: string;
  provider: MediaByokProvider;
  label: string;
  secretIdMask?: string;
  secretKeyMask: string;
  enabled: boolean;
  createdAt?: string;
}
export const byokAPI = {
  list: () => apiClient.get('/media-keys'),
  upsert: (data: { provider: string; secretId?: string; secretKey: string; enabled?: boolean }) =>
    apiClient.post('/media-keys', data),
  remove: (provider: string) => apiClient.delete(`/media-keys/${provider}`),
};

// 部署自检 / 健康看板 API
export const diagnosticsAPI = {
  check: () => apiClient.get('/diagnostics'),
};

// 技能市场 API（agency-agents 风格名册 + 调用 + 导入导出 + 外部市场）
export const skillsAPI = {
  list: () => apiClient.get('/skills'),
  market: () => apiClient.get('/skills/market'),
  detail: (id: string) => apiClient.get(`/skills/${id}`),
  invoke: (id: string, input: Record<string, any>) =>
    apiClient.post(`/skills/${id}/invoke`, input),
  // 当前用户上传/安装的技能
  mine: () => apiClient.get('/skills/mine'),
  // 外部技能市场精选目录（公开）
  catalog: () => apiClient.get('/skills/catalog'),
  // 导入声明式技能包（单个对象 / 数组 / {skills:[...]}）
  importPackage: (pkg: any) => apiClient.post('/skills/import', pkg),
  // 导出技能为 JSON 包（download=true 触发文件下载）
  exportPackage: (id: string, download = false) =>
    apiClient.get(`/skills/export/${id}${download ? '?download=1' : ''}`, {
      responseType: download ? 'blob' : 'json',
    }),
  // 一键安装外部目录条目
  installCatalog: (id: string) => apiClient.post(`/skills/catalog/${id}/install`, {}),
  // 删除自己的用户技能
  remove: (id: string) => apiClient.delete(`/skills/${id}`),
};

// 快速启动模板 API
export const quickstartAPI = {
  templates: () => apiClient.get('/quickstart/templates'),
  apply: (templateId: string) => apiClient.post('/quickstart/apply', { templateId }),
};

// 小红书爆款文案生成器 API（整合 ADP 应用包「小红书爆款文案生成器」）
export const xhsAPI = {
  // 获取可用专家角色（文案生成专家/系统架构师/前端开发助手/部署运维助手）
  agents: () => apiClient.get('/xhs/agents'),
  // 调用指定角色生成内容
  generate: (data: {
    role: 'copywriter' | 'architect' | 'frontend' | 'devops';
    product: string;
    audience?: string;
    style?: string;
    keywords?: string;
    count?: number;
  }) => apiClient.post('/xhs/generate', data),
};

// MCP 插件管理 API（统一封装，避免页面散落裸调；后端 S2 已加 auth+quota 守卫）
export const mcpAPI = {
  // 服务器列表
  list: () => apiClient.get('/mcp/servers'),
  // 单个服务器详情
  getById: (id: string) => apiClient.get(`/mcp/servers/${id}`),
  // 注册服务器配置
  create: (data: { id: string; name: string; transport: string; [k: string]: any }) =>
    apiClient.post('/mcp/servers', data),
  // 更新服务器配置
  update: (id: string, data: any) => apiClient.put(`/mcp/servers/${id}`, data),
  // 启停
  setEnabled: (id: string, enabled: boolean) =>
    apiClient.patch(`/mcp/servers/${id}/enabled`, { enabled }),
  // 删除
  remove: (id: string) => apiClient.delete(`/mcp/servers/${id}`),
  // 连接
  connect: (id: string) => apiClient.post(`/mcp/servers/${id}/connect`),
  // 断开
  disconnect: (id: string) => apiClient.post(`/mcp/servers/${id}/disconnect`),
  // 调用工具
  callTool: (id: string, tool: string, args?: Record<string, any>) =>
    apiClient.post(`/mcp/servers/${id}/call`, { tool, args }),
  // 可用工具清单（供 Agent 使用）
  tools: () => apiClient.get('/mcp/tools'),
  // 批量导入 MCP 服务器配置包
  importServers: (pkg: any) => apiClient.post('/mcp/servers/import', pkg),
  // 导出全部 MCP 服务器配置包
  exportServers: (download = false) =>
    apiClient.get(`/mcp/servers/export${download ? '?download=1' : ''}`, {
      responseType: download ? 'blob' : 'json',
    }),
};

// 🔥 API 市场收益 / 提现
export const revenueAPI = {
  stats: () => apiClient.get('/marketplace/revenue/stats'),
  list: (params?: { status?: string; page?: number; pageSize?: number }) =>
    apiClient.get('/marketplace/revenue/list', { params }),
  byResource: () => apiClient.get('/marketplace/revenue/by-resource'),
  withdraw: (data: { amount: number; method: 'wechat' | 'alipay'; account: string }) =>
    apiClient.post('/marketplace/revenue/withdraw', data),
  withdraws: (params?: { page?: number; pageSize?: number }) =>
    apiClient.get('/marketplace/revenue/withdraws', { params }),
};

// 推荐/分销 API
export const referralAPI = {
  stats: () => apiClient.get('/referral/stats'),
  list: (params?: { page?: number; pageSize?: number }) => apiClient.get('/referral/list', { params }),
  commissions: (params?: { page?: number; pageSize?: number }) => apiClient.get('/referral/commissions', { params }),
  code: () => apiClient.get('/referral/code'),
  withdraw: (data: { amount: number; method: 'wechat' | 'alipay'; account?: string }) =>
    apiClient.post('/referral/withdraw', data),
  withdrawals: (params?: { page?: number; pageSize?: number }) => apiClient.get('/referral/withdrawals', { params }),
};

// 积分/签到 API
export const pointsAPI = {
  checkin: () => apiClient.post('/points/checkin'),
  checkinStatus: () => apiClient.get('/points/checkin/status'),
  checkinHistory: (params?: { page?: number; pageSize?: number }) => apiClient.get('/points/checkin/history', { params }),
  tasks: () => apiClient.get('/points/tasks'),
  awardTask: (taskType: string) => apiClient.post('/points/task', { taskType }),
};

// CloudBase AI 免费用量对话 / 图像生成（小程序成长计划免费额度）
// ⚠️ 关键：全局 apiClient 超时为 10s，但后端 /aibak/chat 上限 60s、/aibak/image 上限 170s，
// 若不单独放大超时，所有 AI 请求都会在前端 10s 被中断，表现为「请求频繁 / 超时 / 网络失败」。
// 因此 chat / image 单独覆盖 timeout。
export const aibakAPI = {
  chat: (data: {
    message?: string;
    messages?: Array<{ role: string; content: string }>;
    history?: Array<{ role: string; content: string }>;
    model?: 'hy3' | 'hy3-preview';
    stream?: boolean;
  }) => apiClient.post('/aibak/chat', data, { timeout: 90000 }),
  // 图像生成（文生图 / 图生图），model 为 HY-Image-* 系列
  image: (data: {
    model: string;
    prompt: string;
    size?: string;
    imageBase64?: string;
    imageUrl?: string;
  }) => apiClient.post('/aibak/image', data, { timeout: 190000 }),
  status: () => apiClient.get('/aibak/status', { timeout: 15000 }),
};

// 工作流（Agent 工具流）导入导出 API
export const workflowAPI = {
  importPackage: (pkg: any) => apiClient.post('/wf/import', pkg),
  exportPackage: (id: string, download = false) =>
    apiClient.get(`/wf/${id}/export${download ? '?download=1' : ''}`, {
      responseType: download ? 'blob' : 'json',
    }),
};

