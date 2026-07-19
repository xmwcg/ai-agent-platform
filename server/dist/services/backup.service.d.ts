export interface BackupInfo {
    name: string;
    path: string;
    type: "full" | "incremental";
    sizeBytes: number;
    sha256: string;
    createdAt: Date;
    expiresAt: Date;
    dbVersion?: string;
}
/** 执行全量备份 */
export declare function performFullBackup(): Promise<BackupInfo | null>;
/** 执行增量备份（每小时） */
export declare function performIncrementalBackup(): Promise<BackupInfo | null>;
/** 清理过期备份 */
export declare function cleanupOldBackups(): Promise<{
    deleted: number;
    errors: number;
}>;
/** 列出所有备份 */
export declare function listBackups(): Promise<BackupInfo[]>;
/** 从备份恢复数据库（需要手动确认） */
export declare function restoreFromBackup(backupName: string): Promise<{
    success: boolean;
    message: string;
}>;
export declare function startBackupScheduler(): void;
//# sourceMappingURL=backup.service.d.ts.map