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
import mongoose, { Document } from "mongoose";
export type AuditAction = "login_success" | "login_failed" | "login_blocked" | "logout" | "logout_all" | "password_change" | "password_reset" | "email_verify" | "mfa_enroll" | "mfa_verify" | "mfa_remove" | "role_change" | "permission_change" | "session_revoke" | "refund_approve" | "refund_reject" | "ledger_adjust" | "ledger_freeze" | "ledger_unfreeze" | "key_view" | "key_rotate" | "secret_access" | "sandbox_security_event" | "sandbox_admin_access" | "api_key_create" | "api_key_delete" | "api_key_view" | "account_export" | "account_delete" | "data_export" | "admin_action" | "account_action";
export interface ISecurityAuditLog extends Document {
    userId?: mongoose.Types.ObjectId;
    adminId?: mongoose.Types.ObjectId;
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    details: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
    outcome: "success" | "failure" | "blocked";
    failureReason?: string;
    severity: "low" | "medium" | "high" | "critical";
    createdAt: Date;
}
export declare const SecurityAuditLog: mongoose.Model<ISecurityAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, ISecurityAuditLog, {}, {}> & ISecurityAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=SecurityAuditLog.d.ts.map