/**
 * 声明式技能包协议（安全：只跑 AI 网关 / 引用已接入的 MCP 或工作流，不执行任意代码）
 * 用于「用户上传本地技能/安装包」「导入导出」「外部市场一键安装」。
 */
export type SkillPackageKind = 'prompt' | 'mcp' | 'workflow';
export interface SkillPackagePrompt {
    /** 系统提示词 */
    system: string;
    /** 用户消息模板，支持 {{var}} 占位符，从调用入参中取对应字段填充 */
    userTemplate?: string;
    maxTokens?: number;
    temperature?: number;
}
export interface SkillPackageMcp {
    /** 已接入的 MCP 服务器 id */
    serverId: string;
    /** 要调用的工具名 */
    tool: string;
    /** 工具入参模板，字符串值中的 {{var}} 会被调用入参替换 */
    argsTemplate?: Record<string, any>;
}
export interface SkillPackageWorkflow {
    /** 已存在的工作流 id */
    workflowId: string;
}
export interface SkillPackageManifest {
    id: string;
    name: string;
    description?: string;
    division?: string;
    color?: string;
    coreMission?: string;
    criticalRules?: string[];
    successMetrics?: string[];
    minRole?: string;
    requireAuth?: boolean;
    marketable?: boolean;
    tags?: string[];
    isPublic?: boolean;
}
export interface SkillPackage {
    /** 协议标识，便于版本演进 */
    schema: 'reasonix.skill/1.0';
    manifest: SkillPackageManifest;
    kind?: SkillPackageKind;
    prompt?: SkillPackagePrompt;
    mcp?: SkillPackageMcp;
    workflow?: SkillPackageWorkflow;
}
/** 把任意来源的 id 清洗为安全、唯一的技能 id（用户技能统一加 u- 前缀，避免覆盖内置技能） */
export declare function sanitizeSkillId(raw: string): string;
//# sourceMappingURL=package-types.d.ts.map