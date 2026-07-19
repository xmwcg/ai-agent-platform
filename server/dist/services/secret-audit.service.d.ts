import { SecretAuditAction } from '../models/SecretAuditLog';
export interface SecretAuditEntry {
    ownerId: string;
    actorId: string;
    targetId: string;
    action: SecretAuditAction;
    secretType?: string;
    ip?: string;
    userAgent?: string;
    result?: 'success' | 'failure';
    alert?: boolean;
    detail?: Record<string, unknown>;
}
/**
 * 写入敏感密钥操作审计日志。
 * 设计为异步、失败不阻塞主业务（与 team-audit 一致）。
 */
export declare function logSecretAudit(entry: SecretAuditEntry): Promise<void>;
/**
 * 检查某操作者是否在短时间内高频调用「测试连接」（疑似探测/滥用 apiKey）。
 * 命中返回 true，并打印告警日志（由调用方决定是否记入审计的 alert 字段）。
 */
export declare function checkTestAbuse(actorId: string, ip: string): boolean;
//# sourceMappingURL=secret-audit.service.d.ts.map