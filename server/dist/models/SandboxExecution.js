"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SandboxExecution = void 0;
/**
 * 沙箱执行记录模型
 *
 * 记录每一次代码执行请求的完整生命周期：
 * - 执行 ID、用户、语言、代码哈希
 * - 运行状态、输出摘要、资源消耗
 * - 安全事件（逃逸尝试、危险模式命中）
 * - 用于查询、审计和对账
 */
const mongoose_1 = __importStar(require("mongoose"));
const SecurityEventSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
}, { _id: false });
const SandboxExecutionSchema = new mongoose_1.Schema({
    executionId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
}, {
    timestamps: true,
});
// 复合索引：用户按时间查询执行记录
SandboxExecutionSchema.index({ userId: 1, createdAt: -1 });
// 复合索引：24h 失败计数（熔断用）
SandboxExecutionSchema.index({ userId: 1, status: 1, createdAt: -1 });
// 7 天 TTL（生产执行记录不长期保留完整代码，只保留元数据摘要）
SandboxExecutionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 86400 });
exports.SandboxExecution = mongoose_1.default.model("SandboxExecution", SandboxExecutionSchema);
//# sourceMappingURL=SandboxExecution.js.map