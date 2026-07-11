import { TeamAuditLog, AuditAction } from '../models/TeamAuditLog';

interface LogEntry {
  teamId: string;
  actorId: string;
  action: AuditAction;
  targetId?: string;
  detail?: Record<string, unknown>;
}

/**
 * 异步写入团队审计日志（不阻塞主流程）
 */
export function logTeamAudit(entry: LogEntry): void {
  TeamAuditLog.create({
    teamId: entry.teamId,
    actorId: entry.actorId,
    action: entry.action,
    targetId: entry.targetId,
    detail: entry.detail,
  }).catch(() => {
    /* 审计记录写入失败不影响主业务 */
  });
}
