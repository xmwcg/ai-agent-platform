/**
 * 安全审计服务
 *
 * 集中化管理所有安全敏感操作的审计日志写入。
 * - 关键审计写入失败时，敏感操作应失败
 * - 低优先级审计写入失败可容忍（fire-and-forget）
 * - 支持上下文自动补充（IP、UserAgent、SessionId）
 */
import { AuditAction, ISecurityAuditLog } from "../models/SecurityAuditLog";
export interface AuditContext {
    userId?: string;
    adminId?: string;
    ipAddress?: string;
    userAgent?: string;
    sessionId?: string;
}
export interface AuditEntry {
    action: AuditAction;
    resourceType?: string;
    resourceId?: string;
    details?: Record<string, any>;
    outcome?: "success" | "failure" | "blocked";
    failureReason?: string;
    severity?: "low" | "medium" | "high" | "critical";
    ctx?: AuditContext;
}
/**
 * 写入审计日志
 * @param critical 若为 true，写入失败时将抛出异常阻止操作继续
 */
export declare function writeAuditLog(entry: AuditEntry, critical?: boolean): Promise<void>;
/** 批量 fire-and-forget 审计（低优先级） */
export declare function writeAuditLogAsync(entry: AuditEntry): void;
/** 审计查询（管理员接口） */
export declare function queryAuditLogs(params: {
    userId?: string;
    action?: AuditAction;
    severity?: string;
    outcome?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
}): Promise<{
    list: (import("mongoose").FlattenMaps<ISecurityAuditLog> & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}>;
//# sourceMappingURL=security-audit.service.d.ts.map