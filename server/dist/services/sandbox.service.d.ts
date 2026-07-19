export type SandboxLanguage = 'python' | 'javascript' | 'typescript' | 'bash';
export type SandboxMode = 'mock' | 'local' | 'remote';
export type SandboxStatus = 'success' | 'error' | 'timeout' | 'denied';
export interface SandboxRequest {
    language: SandboxLanguage;
    code: string;
    /** 显式指定运行模式，否则按环境变量自动选择 */
    mode?: SandboxMode;
    /** 可选：资源 / 团队归属（仅用于审计），由路由层传入 */
    resourceId?: string;
}
export interface SandboxResult {
    executionId: string;
    language: SandboxLanguage;
    status: SandboxStatus;
    stdout: string;
    stderr: string;
    exitCode: number | null;
    durationMs: number;
    mode: SandboxMode;
    /** 命中的危险模式（status==='denied' 时有值） */
    deniedPatterns?: string[];
    note?: string;
}
export declare const SUPPORTED_LANGUAGES: SandboxLanguage[];
export declare function normalizeLanguage(input: unknown): SandboxLanguage | null;
/**
 * 危险写法 deny-list（纯函数，便于单测）。
 * 仅作为静态兜底；真正的隔离依赖 local 的进程隔离 / remote 的容器隔离。
 */
export declare const DANGEROUS_PATTERNS: Array<{
    label: string;
    re: RegExp;
}>;
/** 纯函数：返回代码中命中的危险模式标签列表（空数组表示安全） */
export declare function detectDangerousPatterns(code: string): string[];
/** 纯函数：按最大字节数截断输出，保留末尾并加省略提示 */
export declare function sanitizeOutput(output: string, maxBytes?: number): string;
export interface SandboxEnvConfig {
    mode?: string;
    remoteUrl?: string;
    remoteToken?: string;
    timeoutMs?: number | string;
    pythonBin?: string;
    nodeBin?: string;
    maxOutput?: number | string;
    nodeEnv?: string;
    localEnabled?: string;
    [key: string]: unknown;
}
export interface NormalizedSandboxConfig {
    mode: string;
    remoteUrl: string;
    remoteToken: string;
    timeoutMs: number;
    pythonBin: string;
    nodeBin: string;
    maxOutput: number;
    nodeEnv: string;
    localEnabled: string;
}
/** 兼容归一化配置和真实 process.env 的 SANDBOX_* 命名。 */
export declare function readSandboxConfig(env?: SandboxEnvConfig): NormalizedSandboxConfig;
/** 生产固定 remote；非生产才允许显式 mock/local。 */
export declare function selectSandboxMode(explicit: SandboxMode | undefined, config?: SandboxEnvConfig): SandboxMode;
/** 纯函数：为本机执行构建命令与参数（local 模式使用），含 Python 隔离模式 -I */
export declare function buildLocalCommand(language: SandboxLanguage, filePath: string, bins?: {
    pythonBin: string;
    nodeBin: string;
}): {
    cmd: string;
    args: string[];
};
export interface SandboxProvider {
    name: SandboxMode;
    isConfigured(): boolean;
    run(req: SandboxRequest, ctx: SandboxEnvConfig): Promise<SandboxResult>;
}
export declare const sandboxService: {
    /** 当前生效的默认模式（用于状态查询） */
    defaultMode(explicit?: SandboxMode, ctx?: SandboxEnvConfig): SandboxMode;
    providers(ctx?: SandboxEnvConfig): Array<{
        mode: SandboxMode;
        configured: boolean;
    }>;
    run(req: SandboxRequest): Promise<SandboxResult>;
    /**
     * 用户级限流检查（Redis 优先，降级为内存宽松）
     */
    checkRateLimit(userId: string): Promise<{
        allowed: boolean;
        reason?: string;
        retryAfterMs?: number;
    }>;
    releaseConcurrentSlot(userId: string): Promise<void>;
    recordFailure(userId: string): Promise<void>;
    persistExecution(userId: string, result: SandboxResult, code: string): Promise<void>;
};
export default sandboxService;
//# sourceMappingURL=sandbox.service.d.ts.map