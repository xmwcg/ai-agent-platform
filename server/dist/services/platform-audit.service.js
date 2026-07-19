"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logPlatformAudit = logPlatformAudit;
const PlatformAuditLog_1 = require("../models/PlatformAuditLog");
/**
 * 异步写入平台级审计日志（不阻塞主流程）。
 * 用于留存管理员对用户的敏感操作（角色变更 / 封禁 / 解封），与团队审计日志（TeamAuditLog）互补。
 */
function logPlatformAudit(entry) {
    PlatformAuditLog_1.PlatformAuditLog.create({
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
        detail: entry.detail,
    }).catch(() => {
        /* 审计记录写入失败不影响主业务 */
    });
}
//# sourceMappingURL=platform-audit.service.js.map