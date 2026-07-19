"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logTeamAudit = logTeamAudit;
const TeamAuditLog_1 = require("../models/TeamAuditLog");
/**
 * 异步写入团队审计日志（不阻塞主流程）
 */
function logTeamAudit(entry) {
    TeamAuditLog_1.TeamAuditLog.create({
        teamId: entry.teamId,
        actorId: entry.actorId,
        action: entry.action,
        targetId: entry.targetId,
        detail: entry.detail,
    }).catch(() => {
        /* 审计记录写入失败不影响主业务 */
    });
}
//# sourceMappingURL=team-audit.service.js.map