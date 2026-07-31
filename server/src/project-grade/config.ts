export const EVIDENCE_FACTORS = {
  production_automatic: 1,
  ci_integration: 0.9,
  source_static: 0.75,
  documentation: 0.4,
  none: 0,
} as const;

export type EvidenceLevel = keyof typeof EVIDENCE_FACTORS;
export type FindingSeverity = 'P0' | 'P1' | 'P2' | 'P3';
export type FindingStatus = 'open' | 'accepted' | 'resolved' | 'false_positive';
export type ProjectGradeFindingWorkflowStatus =
  'open' | 'in_progress' | 'ready_for_retest' | 'verified' | 'accepted_risk' | 'false_positive';
export type ProjectGradeRemediationStatus =
  'open' | 'in_progress' | 'blocked' | 'ready_for_retest' | 'verified' | 'cancelled';
export type ProjectGradeProjectionStatus = 'pending' | 'projecting' | 'ready' | 'failed';
export const PROJECT_GRADE_FINDING_FINGERPRINT_VERSION = 1 as const;
export const PROJECT_GRADE_PROJECTION_VERSION = 1 as const;
export type CompletionRatio = 0 | 0.25 | 0.5 | 0.75 | 1;
export type ProjectGradeProjectType =
  | 'website'
  | 'saas'
  | 'ai_application'
  | 'api_service'
  | 'mobile_application'
  | 'desktop_software'
  | 'enterprise_intranet'
  | 'open_source';

export const INITIAL_PROJECT_TYPES: ProjectGradeProjectType[] = [
  'website',
  'saas',
  'ai_application',
];

export const PROJECT_GRADE_DIMENSIONS = [
  { key: 'product_strategy', label: '开发计划与产品战略', weight: 60 },
  { key: 'requirements_completeness', label: '需求与产品完整性', weight: 80 },
  { key: 'architecture_engineering', label: '架构与工程设计', weight: 90 },
  { key: 'code_maintainability', label: '代码质量与可维护性', weight: 90 },
  { key: 'functional_reality', label: '功能闭环与真实可用性', weight: 110 },
  { key: 'ai_quality', label: 'AI 能力质量', weight: 90 },
  { key: 'ux_accessibility', label: 'UI/UX 与无障碍', weight: 70 },
  { key: 'security_compliance', label: '安全、隐私与合规', weight: 100 },
  { key: 'commercial_delivery', label: '收费、交付与商业闭环', weight: 100 },
  { key: 'devops_reliability', label: '生产、DevOps 与可靠性', weight: 80 },
  { key: 'performance_cost', label: '性能、容量与成本', weight: 60 },
  { key: 'operations_improvement', label: '运营、服务与持续改进', weight: 70 },
] as const;

export type ProjectGradeDimensionKey = (typeof PROJECT_GRADE_DIMENSIONS)[number]['key'];

export interface ProjectGradeRuleDefinition {
  key: string;
  rulePackKey: string;
  rulePackVersion: string;
  dimensionKey: ProjectGradeDimensionKey;
  dimensionLabel: string;
  title: string;
  description: string;
  weight: number;
  defaultSeverity: FindingSeverity;
  projectTypes: ProjectGradeProjectType[];
  evidenceGuidance: string[];
  remediationGuidance: string[];
  enabled: boolean;
}

const allInitialProjectTypes = [...INITIAL_PROJECT_TYPES];

export const DEFAULT_PROJECT_GRADE_RULES: ProjectGradeRuleDefinition[] =
  PROJECT_GRADE_DIMENSIONS.map((dimension) => {
    const details: Record<
      ProjectGradeDimensionKey,
      Pick<
        ProjectGradeRuleDefinition,
        'title' | 'description' | 'defaultSeverity' | 'evidenceGuidance' | 'remediationGuidance'
      >
    > = {
      product_strategy: {
        title: '产品战略与交付计划可执行',
        description: '确认目标用户、价值主张、商业模式、阶段计划和验收标准已形成可执行闭环。',
        defaultSeverity: 'P3',
        evidenceGuidance: ['产品方案、路线图和验收标准', '经过评审的阶段计划或发布决策记录'],
        remediationGuidance: ['补齐目标用户、价值主张、范围边界、商业假设和分阶段验收标准'],
      },
      requirements_completeness: {
        title: '核心需求和产品路径完整',
        description: '确认主要用户路径、异常路径、权限路径和售后路径均有明确需求与实现映射。',
        defaultSeverity: 'P2',
        evidenceGuidance: ['需求清单和路由/API 映射', '关键用户旅程的自动化或集成测试'],
        remediationGuidance: ['建立需求到页面、接口、测试和生产探针的可追踪矩阵'],
      },
      architecture_engineering: {
        title: '架构边界清晰且可演进',
        description: '确认前后端、数据、队列、AI 网关、沙箱和外部服务边界清晰并具备故障隔离。',
        defaultSeverity: 'P2',
        evidenceGuidance: ['架构决策记录和部署拓扑', '源码模块边界、依赖方向和隔离测试'],
        remediationGuidance: ['补齐架构图、关键 ADR、故障边界和可回滚方案'],
      },
      code_maintainability: {
        title: '代码质量和维护成本受控',
        description: '确认类型、测试、复杂度、依赖、重复代码和技术债处于可持续维护水平。',
        defaultSeverity: 'P3',
        evidenceGuidance: ['类型检查、Lint、单元测试和覆盖率', '依赖审计与技术债清单'],
        remediationGuidance: ['开启更严格类型检查，补关键测试并拆分高复杂度模块'],
      },
      functional_reality: {
        title: '核心功能在真实链路可用',
        description: '确认登录、AI、表单、保存、分享、下载和异常恢复不是空按钮、Mock 或演示桩。',
        defaultSeverity: 'P1',
        evidenceGuidance: ['生产浏览器自动验证', 'CI 集成测试及截图、日志、请求证据'],
        remediationGuidance: ['为核心用户旅程建立生产探针和失败回滚，清理生产 Mock 与空入口'],
      },
      ai_quality: {
        title: 'AI 输出质量、安全、延迟和成本可验证',
        description:
          '确认模型调用真实、测试集可复现，并覆盖幻觉、引用、Prompt 注入、工具权限、延迟和成本。',
        defaultSeverity: 'P1',
        evidenceGuidance: ['版本化 AI 测试集和多模型结果', '生产调用追踪、延迟、成本与安全评测'],
        remediationGuidance: ['建立版本化测试集、质量阈值、引用校验和模型回退策略'],
      },
      ux_accessibility: {
        title: '关键体验在多端和无障碍场景可用',
        description: '确认桌面、平板、手机、键盘操作和基础无障碍体验满足正式产品要求。',
        defaultSeverity: 'P2',
        evidenceGuidance: ['响应式截图和浏览器测试', 'Lighthouse、axe 或同类无障碍证据'],
        remediationGuidance: ['补齐移动端、键盘焦点、语义标签、对比度和错误提示验证'],
      },
      security_compliance: {
        title: '安全、隐私和合规红线受控',
        description: '确认不存在越权、密钥泄露、严重 RCE、SSRF、支付篡改和生产 Mock 冒充等红线。',
        defaultSeverity: 'P0',
        evidenceGuidance: ['安全扫描、渗透或针对性自动测试', '隐私、授权、审计与数据删除证据'],
        remediationGuidance: ['优先修复红线风险，补访问控制、密钥治理、审计和数据生命周期控制'],
      },
      commercial_delivery: {
        title: '收费、权益和交付闭环真实可用',
        description: '确认定价、下单、支付、回调、权益、退款、发票、下载、License 和客服形成闭环。',
        defaultSeverity: 'P1',
        evidenceGuidance: ['支付沙箱或生产链路自动验证', '订单、权益、退款、交付和对账记录'],
        remediationGuidance: ['完成服务端定价、验签、幂等发权、退款和自动交付链路'],
      },
      devops_reliability: {
        title: '正式发布链路和可靠性门禁有效',
        description: '确认 CI/CD、镜像、健康检查、监控、备份、恢复和回滚均有可复验的证据。',
        defaultSeverity: 'P1',
        evidenceGuidance: ['CI/CD 成功记录和镜像 revision', '生产健康、备份恢复和回滚演练'],
        remediationGuidance: ['打通唯一发布链路并建立版本一致性、健康检查和回滚证据'],
      },
      performance_cost: {
        title: '性能、容量和成本边界已验证',
        description: '确认核心接口、页面、AI 任务和队列在目标负载下满足延迟、容量和成本预算。',
        defaultSeverity: 'P3',
        evidenceGuidance: ['性能与并发测试结果', '容量模型、AI 成本和预算告警'],
        remediationGuidance: ['定义 SLO、执行负载测试并建立容量与成本告警'],
      },
      operations_improvement: {
        title: '运营、客服和持续改进机制可执行',
        description: '确认监控、反馈、客服、事故复盘、规则版本和复测形成持续改进闭环。',
        defaultSeverity: 'P3',
        evidenceGuidance: ['客服与工单记录', '事故复盘、规则版本和复测趋势'],
        remediationGuidance: ['建立问题分级、负责人、SLA、复测和版本化规则治理'],
      },
    };

    const detail = details[dimension.key];
    return {
      key: `${dimension.key}.baseline`,
      rulePackKey: 'aibak-projectgrade-core',
      rulePackVersion: '0.1.0',
      dimensionKey: dimension.key,
      dimensionLabel: dimension.label,
      title: detail.title,
      description: detail.description,
      weight: dimension.weight,
      defaultSeverity: detail.defaultSeverity,
      projectTypes: allInitialProjectTypes,
      evidenceGuidance: detail.evidenceGuidance,
      remediationGuidance: detail.remediationGuidance,
      enabled: true,
    };
  });

export const PROJECT_GRADE_MAX_SCORE = PROJECT_GRADE_DIMENSIONS.reduce(
  (sum, dimension) => sum + dimension.weight,
  0
);

if (PROJECT_GRADE_MAX_SCORE !== 1000) {
  throw new Error(
    `ProjectGrade dimension weights must total 1000, received ${PROJECT_GRADE_MAX_SCORE}`
  );
}
