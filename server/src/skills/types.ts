/**
 * 技能协议层（agency-agents 风格）
 * ----------------------------------------------------------------
 * 参考 msitarzewski/agency-agents 的设计哲学：
 *   每个能力 = 一个「具人格 / 清晰交付物 / 可衡量结果」的技能模块。
 * 但与其用纯 Markdown 文件不同，我们在后端落地为「可声明、可插拔、
 * 可上架开放 API 市场」的 TS 模块，便于与你已有的 RBAC、配额网关、
 * 媒体生成、客服 RAG 等服务打通。
 *
 * 一个 Skill 由两部分组成：
 *   1. manifest：声明式元数据（名称 / 描述 / 分类 / 所需权限 / 配额资源 / 入口）
 *   2. invoke：实际执行函数（调用对应 service）
 */

/** 技能分类（对应 agency-agents 的「部门 Division」概念） */
export type SkillDivision =
  | 'knowledge' // 知识中枢
  | 'ai' // 对话 / 生成
  | 'media' // 媒体生产
  | 'customer-service' // 客服
  | 'engineering' // 工程（代码解释等）
  | 'productivity'; // 生产力工具（翻译 / 转换 / 方案）

/** 技能执行所需的最小角色（与团队 RBAC 对齐） */
export type SkillMinRole = 'viewer' | 'member' | 'admin' | 'owner' | 'none';

/** 技能声明式元数据 */
export interface SkillManifest {
  /** 唯一标识，用作路由前缀与 marketplace 上架键 */
  id: string;
  /** 展示名 */
  name: string;
  /** 一句话描述（agency-agents 的 description） */
  description: string;
  /** 分类（部门） */
  division: SkillDivision;
  /** 主题色（agency-agents 的 color，前端标签用） */
  color: string;
  /** 核心使命（agency-agents 的 Core Mission，可多行） */
  coreMission: string;
  /** 关键规则（agency-agents 的 Critical Rules） */
  criticalRules: string[];
  /** 成功指标（可衡量结果） */
  successMetrics: string[];
  /** 调用该技能消耗的配额资源键（对应 config/billing.ts 的 QuotaResource） */
  quotaResource?: string;
  /** 所需最低团队角色；none 表示无需团队上下文 */
  minRole: SkillMinRole;
  /** 是否需要登录 */
  requireAuth: boolean;
  /** 是否可在开放 API 市场上架（按量计费） */
  marketable: boolean;
  /** 是否允许通过统一技能调用端点执行；false 表示仅提供独立业务路由。 */
  invokable?: boolean;
  /**
   * —— 以下为 superpowers 风格声明字段（可选，对齐 obra/superpowers 的 SKILL.md frontmatter）——
   * 把「价值锚点 / 完成定义 / 质量约束」前置声明，便于评审与自动生成。
   */
  /** 用户故事：谁 / 要什么 / 为什么 */
  userStory?: string;
  /** 验收标准（完成的定义，可勾选清单） */
  acceptanceCriteria?: string[];
  /** 质量约束（延迟 / 兜底 / 可观测等非功能项） */
  qualityCriteria?: string[];
  /** 相关文档或上游技能引用 */
  references?: string[];
}

/** 技能执行上下文 */
export interface SkillContext {
  userId?: string;
  teamId?: string;
  role?: SkillMinRole;
  /** 透传给具体 service 的参数 */
  input: Record<string, any>;
}

/** 技能执行结果 */
export interface SkillResult {
  ok: boolean;
  data?: any;
  error?: string;
  /** 失败时建议的 HTTP 状态码。 */
  status?: number;
  /** 稳定的机器可读错误码。 */
  code?: string;
}

/** 技能定义：manifest + invoke */
export interface Skill {
  manifest: SkillManifest;
  invoke(ctx: SkillContext): Promise<SkillResult>;
}
