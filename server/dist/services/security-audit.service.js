"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.writeAuditLog = writeAuditLog;
exports.writeAuditLogAsync = writeAuditLogAsync;
exports.queryAuditLogs = queryAuditLogs;
/**
 * 安全审计服务
 *
 * 集中化管理所有安全敏感操作的审计日志写入。
 * - 关键审计写入失败时，敏感操作应失败
 * - 低优先级审计写入失败可容忍（fire-and-forget）
 * - 支持上下文自动补充（IP、UserAgent、SessionId）
 */
const SecurityAuditLog_1 = require("../models/SecurityAuditLog");
const logger_1 = require("../lib/logger");
/**
 * 写入审计日志
 * @param critical 若为 true，写入失败时将抛出异常阻止操作继续
 */
async function writeAuditLog(entry, critical = false) {
    try {
        await SecurityAuditLog_1.SecurityAuditLog.create({
            userId: entry.ctx?.userId || undefined,
            adminId: entry.ctx?.adminId || undefined,
            action: entry.action,
            resourceType: entry.resourceType,
            resourceId: entry.resourceId,
            details: entry.details || {},
            ipAddress: entry.ctx?.ipAddress,
            userAgent: entry.ctx?.userAgent,
            sessionId: entry.ctx?.sessionId,
            outcome: entry.outcome || "success",
            failureReason: entry.failureReason,
            severity: entry.severity || classifySeverity(entry.action),
        });
    }
    catch (err) {
        const msg = `security audit write failed: ${err?.message}`;
        logger_1.logger.error("security-audit", msg);
        if (critical) {
            throw new Error(`AUDIT_WRITE_FAILED: ${msg}`);
        }
    }
}
/** 批量 fire-and-forget 审计（低优先级） */
function writeAuditLogAsync(entry) {
    writeAuditLog(entry, false).catch((err) => {
        logger_1.logger.error("security-audit", `async audit write failed: ${err?.message}`);
    });
}
/** 根据操作类型自动分类严重级别 */
function classifySeverity(action) {
    const criticals = ["key_rotate", "key_view", "secret_access", "sandbox_security_event"];
    const highs = ["role_change", "permission_change", "refund_approve", "ledger_adjust", "account_delete", "admin_action"];
    const mediums = ["login_failed", "login_blocked", "password_change", "mfa_remove", "session_revoke", "api_key_delete"];
    if (criticals.includes(action))
        return "critical";
    if (highs.includes(action))
        return "high";
    if (mediums.includes(action))
        return "medium";
    return "low";
}
/** 审计查询（管理员接口） */
async function queryAuditLogs(params) {
    const filter = {};
    if (params.userId)
        filter.userId = params.userId;
    if (params.action)
        filter.action = params.action;
    if (params.severity)
        filter.severity = params.severity;
    if (params.outcome)
        filter.outcome = params.outcome;
    if (params.startDate || params.endDate) {
        filter.createdAt = {};
        if (params.startDate)
            filter.createdAt.$gte = new Date(params.startDate);
        if (params.endDate)
            filter.createdAt.$lte = new Date(params.endDate);
    }
    const page = params.page || 1;
    const limit = Math.min(100, params.limit || 20);
    const [records, total] = await Promise.all([
        SecurityAuditLog_1.SecurityAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
        SecurityAuditLog_1.SecurityAuditLog.countDocuments(filter),
    ]);
    return { list: records, total, page, limit, totalPages: Math.ceil(total / limit) };
}
//# sourceMappingURL=security-audit.service.js.map