export interface SiteFeature {
  id: string;
  title: string;
  description: string;
  path: string;
  group: string;
  keywords: string[];
  aliases: string[];
  authRequired: boolean;
  roles?: string[];
  icon: string;
}

export interface NavigationGroup {
  key: string;
  label: string;
  defaultOpen?: boolean;
  featureIds: string[];
}

export const SITE_FEATURES: SiteFeature[] = [
  { id: 'home', title: '首页', description: 'AIbak 全站功能与服务总览', path: '/', group: '核心功能', keywords: ['导航', '开始', '平台'], aliases: ['home'], authRequired: false, icon: 'home' },
  { id: 'quickstart', title: '快速启动', description: '快速了解并开始使用 AIbak', path: '/quickstart', group: '核心功能', keywords: ['入门', '新手', '教程'], aliases: ['quick start'], authRequired: false, icon: 'rocket' },
  { id: 'ai-chat', title: 'AI 对话', description: '使用已配置模型进行智能对话', path: '/ai-chat', group: '核心功能', keywords: ['聊天', '大模型', '问答', 'Claude', 'Gemini', 'DeepSeek'], aliases: ['chat', '聊天'], authRequired: false, icon: 'robot' },
  { id: 'knowledge', title: '通用知识库', description: '检索、阅读和管理授权知识内容', path: '/knowledge', group: '核心功能', keywords: ['文档', '知识', 'RAG', '资料'], aliases: ['knowledge', '知识库'], authRequired: false, icon: 'book' },
  { id: 'sandbox', title: '实践沙盒', description: '在隔离环境执行代码和实践任务', path: '/sandbox', group: '核心功能', keywords: ['运行代码', 'Python', 'JavaScript', 'Java', 'Go'], aliases: ['sandbox', '代码沙盒'], authRequired: true, icon: 'code' },
  { id: 'courses', title: '学习中心', description: '课程与体系化学习内容', path: '/courses', group: '创作与学习', keywords: ['课程', '学习', '教程'], aliases: ['course'], authRequired: false, icon: 'experiment' },
  { id: 'learning-path', title: '学习路径', description: '按目标规划学习路线', path: '/learning-path', group: '创作与学习', keywords: ['路线', '进阶', '成长'], aliases: ['path'], authRequired: false, icon: 'compass' },
  { id: 'creative', title: '创作工坊', description: 'AI 内容创作工作台', path: '/creative', group: '创作与学习', keywords: ['写作', '创作', '内容生成'], aliases: ['creative'], authRequired: false, icon: 'bulb' },
  { id: 'code', title: '代码解释', description: '分析和解释代码', path: '/code', group: '创作与学习', keywords: ['编程', '解释代码', '开发'], aliases: ['code explanation'], authRequired: false, icon: 'code' },
  { id: 'tools', title: '智能工具箱', description: '常用 AI 工具集合', path: '/tools', group: '工具与分析', keywords: ['工具', '效率', '应用'], aliases: ['toolbox'], authRequired: false, icon: 'tool' },
  { id: 'compare', title: '对比分析', description: '模型与方案对比分析', path: '/compare', group: '工具与分析', keywords: ['比较', '评测', '模型对比'], aliases: ['compare'], authRequired: false, icon: 'chart' },
  { id: 'calendar', title: '模型日历', description: '查看模型事件与更新', path: '/calendar', group: '工具与分析', keywords: ['模型更新', '发布', '日历'], aliases: ['calendar'], authRequired: false, icon: 'calendar' },
  { id: 'workflows', title: '工作流编辑器', description: '创建和运行 AI 工作流', path: '/workflows', group: '工具与分析', keywords: ['流程', '自动化', '编排'], aliases: ['workflow'], authRequired: true, icon: 'workflow' },
  { id: 'query-center', title: '本站查询', description: '查询官方 API 接入、厂商文档、额度、用量与订单', path: '/query-center', group: '平台与生态', keywords: ['API Key', 'Base URL', '协议', '地区', '模型列表', '免费额度', '付费额度', '积分', '订阅', '订单', '价格', '退款', '用量统计'], aliases: ['查询中心', 'query center', '官方API接入查询'], authRequired: false, icon: 'search' },
  { id: 'model-config', title: '模型配置', description: '配置模型厂商、API Key 和默认模型', path: '/model-config', group: '平台与生态', keywords: ['API Key', 'Base URL', 'OpenAI', 'Claude', 'Gemini', 'DeepSeek', '通义千问', 'Kimi'], aliases: ['模型接入', 'provider'], authRequired: true, icon: 'api' },
  { id: 'marketplace', title: 'API 市场', description: '发现和使用平台 API', path: '/marketplace', group: '平台与生态', keywords: ['接口', '市场', 'API'], aliases: ['marketplace'], authRequired: false, icon: 'shop' },
  { id: 'skills', title: '技能市场', description: '发现和管理 AI 技能', path: '/skills', group: '平台与生态', keywords: ['技能', '插件', '能力'], aliases: ['skills'], authRequired: false, icon: 'apps' },
  { id: 'plugins', title: '插件管理', description: '管理平台扩展插件', path: '/plugins', group: '平台与生态', keywords: ['插件', '扩展'], aliases: ['plugins'], authRequired: true, icon: 'setting' },
  { id: 'customer-service', title: '智能客服', description: '创建和管理智能客服', path: '/customer-service', group: '平台与生态', keywords: ['客服', '机器人', '客户服务'], aliases: ['customer service'], authRequired: true, icon: 'service' },
  { id: 'team', title: '团队权限', description: '团队成员与授权管理', path: '/team', group: '管理与账户', keywords: ['团队', '成员', '权限'], aliases: ['team'], authRequired: true, icon: 'team' },
  { id: 'diagnostics', title: '部署自检', description: '查看系统运行与部署诊断', path: '/diagnostics', group: '管理与账户', keywords: ['健康检查', '状态', '部署'], aliases: ['diagnostics'], authRequired: true, icon: 'dashboard' },
  { id: 'ops-dashboard', title: '运营看板', description: '查看平台运营指标', path: '/ops-dashboard', group: '管理与账户', keywords: ['运营', '统计', '指标'], aliases: ['dashboard'], authRequired: true, roles: ['admin'], icon: 'chart' },
  { id: 'admin-users', title: '用户管理', description: '管理平台用户', path: '/admin/users', group: '管理与账户', keywords: ['用户', '管理员'], aliases: ['users'], authRequired: true, roles: ['admin'], icon: 'security' },
  { id: 'pricing', title: '会员升级', description: '查看会员套餐和价格', path: '/pricing', group: '管理与账户', keywords: ['价格', '会员', '订阅', '付费'], aliases: ['pricing'], authRequired: false, icon: 'crown' },
  { id: 'points-center', title: '积分中心', description: '查看积分余额与流水', path: '/points-center', group: '管理与账户', keywords: ['积分', '免费额度', '付费额度', '余额'], aliases: ['credits', 'points'], authRequired: true, icon: 'gift' },
  { id: 'distribution', title: '分销中心', description: '查看推荐与分销数据', path: '/distribution', group: '管理与账户', keywords: ['推荐', '佣金', '推广'], aliases: ['referral'], authRequired: true, icon: 'share' },
  { id: 'profile', title: '个人中心', description: '管理个人资料和账户', path: '/profile', group: '管理与账户', keywords: ['账户', '个人资料', '安全'], aliases: ['profile'], authRequired: true, icon: 'profile' },
  { id: 'relay-admin', title: '中转站', description: '金网通AI大模型聚合中转管理', path: '/relay-admin', group: '平台与生态', keywords: ['中转站', '大模型', '聚合', '金网通', 'Relay', 'API中转'], aliases: ['relay', '中转站管理'], authRequired: true, roles: ['admin'], icon: 'api' },
  { id: 'jinwangtong', title: '金网通', description: '企业局域网互联互通授权购买与管理', path: '/jinwangtong', group: '平台与生态', keywords: ['金网通', '企业', '局域网', '授权', '购买', 'License'], aliases: ['jwt', '金网通购买'], authRequired: false, icon: 'shop' },
];

export const NAVIGATION_GROUPS: NavigationGroup[] = [
  { key: 'core', label: '核心功能', defaultOpen: true, featureIds: ['home', 'quickstart', 'ai-chat', 'knowledge', 'sandbox'] },
  { key: 'create', label: '创作与学习', featureIds: ['courses', 'learning-path', 'creative', 'code'] },
  { key: 'tools', label: '工具与分析', featureIds: ['tools', 'compare', 'calendar', 'workflows'] },
  { key: 'platform', label: '平台与生态', featureIds: ['query-center', 'model-config', 'marketplace', 'skills', 'plugins', 'customer-service', 'relay-admin', 'jinwangtong'] },
  { key: 'manage', label: '管理与账户', featureIds: ['team', 'diagnostics', 'ops-dashboard', 'admin-users', 'pricing', 'points-center', 'distribution', 'profile'] },
];

export const POPULAR_QUERIES = [
  'API Key', 'Base URL', '模型配置', '获取模型列表', 'DeepSeek', 'Claude',
  '通义千问', 'Kimi', '知识库', '实践沙盒', '免费额度', '付费额度', '订单', '价格',
];

export function visibleSiteFeatures(role?: string): SiteFeature[] {
  return SITE_FEATURES.filter((feature) => !feature.roles || (role ? feature.roles.includes(role) : false));
}

export function featureByPath(pathname: string): SiteFeature | undefined {
  return [...SITE_FEATURES]
    .sort((a, b) => b.path.length - a.path.length)
    .find((feature) => feature.path === '/' ? pathname === '/' : pathname.startsWith(feature.path));
}


