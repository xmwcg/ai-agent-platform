import { AuditAction } from '../models/TeamAuditLog';
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
export declare function logTeamAudit(entry: LogEntry): void;
export {};
//# sourceMappingURL=team-audit.service.d.ts.map