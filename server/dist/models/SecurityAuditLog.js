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
exports.SecurityAuditLog = void 0;
/**
 * 安全审计日志模型
 *
 * 覆盖所有敏感操作的可审计日志：
 * - 登录成功/失败、权限变更、密码修改
 * - 退款审批、账本调整、密钥操作
 * - Sandbox 安全事件
 * - 关键审计写入失败时敏感操作失败
 *
 * 保留策略：财务/安全审计相关日志长期保存，不设 TTL
 */
const mongoose_1 = __importStar(require("mongoose"));
const securityAuditLogSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", index: true },
    adminId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    action: { type: String, required: true, index: true },
    resourceType: { type: String, index: true },
    resourceId: { type: String, index: true },
    details: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    ipAddress: String,
    userAgent: String,
    sessionId: String,
    outcome: { type: String, enum: ["success", "failure", "blocked"], required: true, index: true },
    failureReason: String,
    severity: { type: String, enum: ["low", "medium", "high", "critical"], default: "low", index: true },
}, { timestamps: { createdAt: true, updatedAt: false } });
securityAuditLogSchema.index({ userId: 1, action: 1, createdAt: -1 });
securityAuditLogSchema.index({ createdAt: -1 });
securityAuditLogSchema.index({ severity: 1, createdAt: -1 });
exports.SecurityAuditLog = mongoose_1.default.model("SecurityAuditLog", securityAuditLogSchema);
//# sourceMappingURL=SecurityAuditLog.js.map