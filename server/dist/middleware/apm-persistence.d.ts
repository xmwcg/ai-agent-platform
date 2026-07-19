/** 保存当前快照到 MongoDB */
export declare function saveSnapshot(data: any): Promise<void>;
/** 保存小时级快照（用于历史趋势） */
export declare function saveHourlySnapshot(data: any): Promise<void>;
/** 从 MongoDB 恢复上次快照（用于重启后显示历史数据） */
export declare function loadLastSnapshot(): Promise<{
    data: any;
    createdAt: Date;
} | null>;
/** 获取指定时间范围内的历史快照 */
export declare function getHistoricalSnapshots(hours: number): Promise<any[]>;
export declare function startPersistence(getData: () => any): void;
export declare function stopPersistence(): void;
//# sourceMappingURL=apm-persistence.d.ts.map