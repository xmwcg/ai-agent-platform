import { PlatformAuditAction } from '../models/PlatformAuditLog';
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
export declare function logPlatformAudit(entry: LogEntry): void;
export type { PlatformAuditAction };
//# sourceMappingURL=platform-audit.service.d.ts.map