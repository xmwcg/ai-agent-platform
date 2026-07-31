/**
 * 三产品独立套餐定价配置
 *
 * 定价策略：竞品 1/10 ~ 1/5
 * - 金网通：永久买断制（竞品 ¥3,000-50,000，我方 ¥299/¥599/¥999）
 * - 智评通：按月/按年订阅（竞品 ¥99-990/月，我方 ¥9.9/¥19.9/¥99）
 * - TranSync：按月/按年订阅（竞品 ¥49-299/月，我方 免费/¥19.9/¥99）
 */

export type ProductTab = 'all' | 'jinwangtong' | 'zhipingtong' | 'transync' | 'guard';

/** 从 URL product 参数映射到 product tab */
export const PRODUCT_PARAM_MAP: Record<string, ProductTab> = {
  jinwangtong: 'jinwangtong',
  'project-grade': 'zhipingtong',
  projectgrade: 'zhipingtong',
  transync: 'transync',
  guard: 'guard',
};

// ============================================================
// 金网通 — 永久买断制
// ============================================================

export interface JinWangTongPlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  competitorPrice: number;
  terminals: number;
  updateYears: string;
  features: string[];
  highlighted?: boolean;
}

export const JINWANGTONG_PLANS: JinWangTongPlan[] = [
  {
    id: 'jwt_basic',
    name: '基础版',
    tagline: '小微企业入门首选',
    price: 29900,
    competitorPrice: 300000,
    terminals: 50,
    updateYears: '1年免费更新',
    features: [
      '局域网设备发现与拓扑',
      'IT资产自动扫描入库',
      '资产标签（二维码/条形码）',
      '基础资产报表',
      'Windows Agent 部署',
      '社区支持',
    ],
  },
  {
    id: 'jwt_pro',
    name: '专业版',
    tagline: '成长型企业全能管',
    price: 59900,
    competitorPrice: 1500000,
    terminals: 200,
    updateYears: '终身免费更新',
    features: [
      '包含基础版全部功能',
      '打印机跨平台共享管理',
      '远程桌面管控（批量操作）',
      '软件资产管理与许可证',
      '资产全生命周期管理',
      '采购与供应商管理',
      '邮件工单支持',
    ],
    highlighted: true,
  },
  {
    id: 'jwt_enterprise',
    name: '企业版',
    tagline: '中大型企业私有部署',
    price: 99900,
    competitorPrice: 5000000,
    terminals: 500,
    updateYears: '终身免费更新',
    features: [
      '包含专业版全部功能',
      'Linux/macOS Agent 全覆盖',
      '开放 API 与系统集成',
      '私有化部署支持',
      '上网行为管理模块',
      '7×24 专属技术支持',
    ],
  },
];

// ============================================================
// 智评通 — 按月/按年订阅
// ============================================================

export interface ZhiPingTongPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  competitorMonthly: number;
  projects: number;
  reportDays: number;
  features: string[];
  highlighted?: boolean;
}

export const ZHIPINGTONG_PLANS: ZhiPingTongPlan[] = [
  {
    id: 'zpt_basic',
    name: '基础版',
    tagline: '个人开发者 · 项目体检入门',
    priceMonthly: 990,
    priceYearly: 9900,
    competitorMonthly: 9900,
    projects: 5,
    reportDays: 30,
    features: [
      '5 个活动项目',
      '网址/源码双维度扫描',
      '每日 3 次网址体检',
      '基础评分报告',
      '30 天报告有效期',
      '社区支持',
    ],
  },
  {
    id: 'zpt_pro',
    name: '专业版',
    tagline: '专业团队 · 深度评估',
    priceMonthly: 1990,
    priceYearly: 19900,
    competitorMonthly: 19900,
    projects: 20,
    reportDays: 180,
    features: [
      '20 个活动项目',
      '源码扫描（每次 25 次）',
      '完整六维评分雷达图',
      '证据链展示',
      '180 天报告有效期',
      '报告下载（PDF/JSON）',
      '邮件工单支持',
    ],
    highlighted: true,
  },
  {
    id: 'zpt_enterprise',
    name: '企业版',
    tagline: '大型团队 · 全面治理',
    priceMonthly: 9900,
    priceYearly: 99000,
    competitorMonthly: 99000,
    projects: 100,
    reportDays: 365,
    features: [
      '100 个活动项目',
      '无限源码扫描',
      'CI/CD 流水线集成',
      '自定义评估维度',
      '去 AIBAK 品牌白标',
      '365 天企业报告',
      'Open API 接入',
      '7×24 专属客户成功',
    ],
  },
];

// ============================================================
// TranSync — 按月/按年订阅
// ============================================================

export interface TranSyncPlan {
  id: string;
  name: string;
  tagline: string;
  priceMonthly: number;
  priceYearly: number;
  competitorMonthly: number;
  charsPerMonth: string;
  languages: string;
  features: string[];
  highlighted?: boolean;
}

export const TRANSYNC_PLANS: TranSyncPlan[] = [
  {
    id: 'ts_free',
    name: '免费版',
    tagline: '零门槛体验实时翻译',
    priceMonthly: 0,
    priceYearly: 0,
    competitorMonthly: 0,
    charsPerMonth: '5,000 字符/月',
    languages: '2 语种',
    features: [
      '每月 5,000 字符翻译',
      '支持 2 个语种',
      '浏览器插件翻译',
      '基础翻译历史',
      '社区支持',
    ],
  },
  {
    id: 'ts_pro',
    name: '专业版',
    tagline: '跨境业务必备',
    priceMonthly: 1990,
    priceYearly: 19900,
    competitorMonthly: 4900,
    charsPerMonth: '50 万字符/月',
    languages: '5 语种同时',
    features: [
      '每月 50 万字符翻译',
      '同时使用 5 个语种',
      '网页/文档/字幕全场景',
      '翻译记忆与术语库',
      'API 接入（10万字符/月）',
      '邮件工单支持',
    ],
    highlighted: true,
  },
  {
    id: 'ts_team',
    name: '团队版',
    tagline: '翻译团队协作平台',
    priceMonthly: 9900,
    priceYearly: 99000,
    competitorMonthly: 29900,
    charsPerMonth: '200 万字符/月',
    languages: '无限语种',
    features: [
      '每月 200 万字符翻译',
      '无限语种支持',
      '团队协作审校',
      '共享术语库与翻译记忆',
      'API 接入（50万字符/月）',
      'SSO 单点登录',
      '优先技术支持',
    ],
  },
];


// ============================================================
// NexMind Guard — 自托管监控，按年订阅
// ============================================================

export interface GuardPlan {
  id: string;
  name: string;
  tagline: string;
  price: number;
  competitorPrice: number;
  monitors: string;
  retention: string;
  features: string[];
  highlighted?: boolean;
}

export const GUARD_PLANS: GuardPlan[] = [
  {
    id: 'guard_free',
    name: 'Free',
    tagline: '个人项目免费监控',
    price: 0,
    competitorPrice: 0,
    monitors: '10 项',
    retention: '24h',
    features: [
      'HTTP/HTTPS/TCP 探测',
      '实时仪表盘',
      '公共状态页（Guard 品牌）',
      '事件记录与时间线',
      'Docker 一键部署',
      '本地 Agent 部署可核验',
    ],
  },
  {
    id: 'guard_pro',
    name: 'Pro',
    tagline: '开发者必备 · ROI 35倍',
    price: 9900,
    competitorPrice: 350000,
    monitors: '50 项',
    retention: '30 天',
    features: [
      '包含 Free 全部功能',
      'SSL/域名到期预警',
      '邮件 + Webhook 告警',
      '自动修复/重启服务',
      '品牌定制（Logo+色系）',
      '夜间静音模式',
      '维护窗口日历',
      '宕机赔偿计算器',
    ],
    highlighted: true,
  },
  {
    id: 'guard_max',
    name: 'Max',
    tagline: '高可用全栈监控',
    price: 19900,
    competitorPrice: 172800,
    monitors: '无限',
    retention: '90 天',
    features: [
      '包含 Pro 全部功能',
      'Cron 心跳监控',
      '多地点探测 ×3',
      'Cloudflare DNS 自动切换',
      '企业微信/钉钉/飞书通知',
      '多项目管理',
      'API Token 集成',
      'SLA 周报 PDF',
      '依赖链可视化',
      'Git 提交关联追溯',
    ],
  },
];
// ============================================================
// 产品元信息
// ============================================================

export interface ProductMeta {
  key: ProductTab;
  label: string;
  icon: string;
  description: string;
  color: string;
}

export const PRODUCT_META: Record<string, ProductMeta> = {
  all: {
    key: 'all',
    label: '全部',
    icon: '📋',
    description: '浏览所有产品套餐',
    color: '#6366f1',
  },
  jinwangtong: {
    key: 'jinwangtong',
    label: '金网通',
    icon: '🌐',
    description: '企业内网管理 · 永久买断',
    color: '#10b981',
  },
  zhipingtong: {
    key: 'zhipingtong',
    label: '智评通',
    icon: '📊',
    description: 'AI 项目质量评估 · 按月订阅',
    color: '#f59e0b',
  },
  guard: {
    key: 'guard',
    label: 'NexMind Guard',
    icon: '🛡️',
    description: '自托管监控 · 按年订阅',
    color: '#6366f1',
  },
  transync: {
    key: 'transync',
    label: 'TranSync',
    icon: '🌍',
    description: '多语言实时翻译 · 按月订阅',
    color: '#3b82f6',
  },
};
