/**
 * 小红书爆款文案生成器（整合自 ADP 应用包「小红书爆款文案生成器」）
 * ----------------------------------------------------------------
 * 应用包原本是 4 个聊天 Agent（系统架构师 / 前端开发助手 / 文案生成专家 / 部署运维助手），
 * 这里把它们的 Instructions 提取为 4 个可复用的「专家角色」，统一走平台 AI 网关 route()，
 * 复用现有的 Provider 选择与故障转移机制；生产环境只允许真实 Provider，不再依赖 ADP 平台本身。
 *
 * 说明：应用包自带的 <handoff_rules>（transfer_to_* 工具）在单轮调用场景下无意义，
 * 已在此处剔除，仅保留角色设定、核心能力、输出规范，避免模型误以为要「转交」其他智能体。
 */
export type XhsRole = 'copywriter' | 'architect' | 'frontend' | 'devops';
export interface XhsAgent {
    id: XhsRole;
    name: string;
    description: string;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
}
export interface XhsGenerateInput {
    role: XhsRole;
    /** 产品卖点 / 主题 */
    product: string;
    /** 目标受众 */
    audience?: string;
    /** 风格 / 语气（如：种草、专业测评、搞笑、职场） */
    style?: string;
    /** 关键词 / 卖点补充 */
    keywords?: string;
    /** 生成条数（仅 copywriter 角色生效，默认 1） */
    count?: number;
    /** 指定模型（前缀寻址，如 "openai/gpt-4o"），缺省走网关默认 provider */
    model?: string;
}
export interface XhsStructured {
    title?: string;
    body?: string;
    hashtags?: string[];
    imageSuggestions?: string[];
}
export interface XhsGenerateResult {
    role: XhsRole;
    agentName: string;
    reply: string;
    structured?: XhsStructured;
}
export declare const XHS_AGENTS: XhsAgent[];
/** 列出可用专家角色（供前端选择器使用，不含系统 prompt 以免泄露过长上下文） */
export declare function listXhsAgents(): {
    id: XhsRole;
    name: string;
    description: string;
}[];
/**
 * 调用对应专家角色生成内容。直接复用统一 AI 网关（route），
 * 不指定 model/provider 时由网关按默认策略与 fallback 选择可用厂商。
 */
export declare function generateXhsCopy(input: XhsGenerateInput): Promise<XhsGenerateResult>;
//# sourceMappingURL=xhs-copy.service.d.ts.map