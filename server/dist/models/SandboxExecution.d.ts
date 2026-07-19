/**
 * 沙箱执行记录模型
 *
 * 记录每一次代码执行请求的完整生命周期：
 * - 执行 ID、用户、语言、代码哈希
 * - 运行状态、输出摘要、资源消耗
 * - 安全事件（逃逸尝试、危险模式命中）
 * - 用于查询、审计和对账
 */
import mongoose, { Document } from "mongoose";
export type SandboxExecStatus = "success" | "error" | "timeout" | "denied" | "resource_exhausted";
export type SandboxExecLanguage = "python" | "javascript" | "typescript" | "bash";
export type SandboxExecMode = "remote";
export interface ISandboxExecution extends Document {
    executionId: string;
    userId: mongoose.Types.ObjectId;
    language: SandboxExecLanguage;
    codeHash: string;
    codeLength: number;
    mode: SandboxExecMode;
    status: SandboxExecStatus;
    stdout?: string;
    stderr?: string;
    exitCode: number | null;
    /** 执行耗时（毫秒） */
    durationMs: number;
    /** 资源消耗快照 */
    resourceUsage?: {
        /** 峰值内存（字节） */
        maxMemoryBytes?: number;
        /** CPU 时间（毫秒） */
        cpuTimeMs?: number;
        /** 磁盘写入（字节） */
        diskWriteBytes?: number;
    };
    /** 命中的危险模式 */
    deniedPatterns?: string[];
    /** 安全事件记录 */
    securityEvents?: Array<{
        type: string;
        message: string;
        timestamp: Date;
    }>;
    /** 执行节点标识 */
    executorNode?: string;
    /** 关联资源 ID（团队/项目） */
    resourceId?: string;
    /** 失败熔断计数（24h 内累计失败次数） */
    failureCount?: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SandboxExecution: mongoose.Model<ISandboxExecution, {}, {}, {}, mongoose.Document<unknown, {}, ISandboxExecution, {}, {}> & ISandboxExecution & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SandboxExecution.d.ts.map