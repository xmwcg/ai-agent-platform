import { PlatformAuditLog, PlatformAuditAction } from '../models/PlatformAuditLog';

interface LogEntry {
  actorId: string;
  action: PlatformAuditAction;
  targetId?: string;
  detail?: Record<string, unknown>;
}

/**
 * 异步写入平台级审计日志（不阻塞主流程）。
 * 用于留存管理员对用户的敏感操作（角色变更 / 封禁 / 解封），与团队审计日志（TeamAuditLog）互补。
 */
export function logPlatformAudit(entry: LogEntry): void {
  PlatformAuditLog.create({
    actorId: entry.actorId,
    action: entry.action,
    targetId: entry.targetId,
    detail: entry.detail,
  }).catch(() => {
    /* 审计记录写入失败不影响主业务 */
  });
}

export type { PlatformAuditAction };
