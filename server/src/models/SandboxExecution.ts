/**
 * 沙箱执行记录模型
 *
 * 记录每一次代码执行请求的完整生命周期：
 * - 执行 ID、用户、语言、代码哈希
 * - 运行状态、输出摘要、资源消耗
 * - 安全事件（逃逸尝试、危险模式命中）
 * - 用于查询、审计和对账
 */
import mongoose, { Schema, Document } from "mongoose";

export type SandboxExecStatus = "success" | "error" | "timeout" | "denied" | "resource_exhausted";
export type SandboxExecLanguage = "python" | "javascript" | "typescript" | "bash";
export type SandboxExecMode = "remote";

export interface ISandboxExecution extends Document {
  executionId: string;
  userId: mongoose.Types.ObjectId;
  language: SandboxExecLanguage;
  codeHash: string; // SHA256 of code
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

const SecurityEventSchema = new Schema(
  {
    type: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const SandboxExecutionSchema = new Schema<ISandboxExecution>(
  {
    executionId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    language: {
      type: String,
      required: true,
      enum: ["python", "javascript", "typescript", "bash"],
    },
    codeHash: { type: String, required: true, index: true },
    codeLength: { type: Number, required: true },
    mode: { type: String, required: true, default: "remote" },
    status: {
      type: String,
      required: true,
      enum: ["success", "error", "timeout", "denied", "resource_exhausted"],
    },
    stdout: { type: String },
    stderr: { type: String },
    exitCode: { type: Number, default: null },
    durationMs: { type: Number, required: true, default: 0 },
    resourceUsage: {
      maxMemoryBytes: { type: Number },
      cpuTimeMs: { type: Number },
      diskWriteBytes: { type: Number },
    },
    deniedPatterns: [{ type: String }],
    securityEvents: [SecurityEventSchema],
    executorNode: { type: String },
    resourceId: { type: String, index: true },
    failureCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
  }
);

// 复合索引：用户按时间查询执行记录
SandboxExecutionSchema.index({ userId: 1, createdAt: -1 });
// 复合索引：24h 失败计数（熔断用）
SandboxExecutionSchema.index({ userId: 1, status: 1, createdAt: -1 });

// 7 天 TTL（生产执行记录不长期保留完整代码，只保留元数据摘要）
SandboxExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });

export const SandboxExecution = mongoose.model<ISandboxExecution>(
  "SandboxExecution",
  SandboxExecutionSchema
);