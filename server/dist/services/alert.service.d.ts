export type AlertSeverity = 'critical' | 'high' | 'medium' | 'low';
export type AlertCategory = 'service_down' | 'api_error_rate' | 'payment_failure' | 'backup_failure' | 'sandbox_unavailable' | 'credit_overdraft' | 'reconciliation_diff' | 'db_connection_failure' | 'redis_connection_failure' | 'slow_request_rate' | 'disk_space' | 'memory_high' | 'recovery_test';
export interface AlertPayload {
    severity: AlertSeverity;
    category: AlertCategory;
    title: string;
    message: string;
    details?: Record<string, any>;
    dedupKey?: string;
}
export interface AlertResult {
    sent: boolean;
    channels: string[];
    errors?: string[];
}
export declare function sendAlert(payload: AlertPayload): Promise<AlertResult>;
export declare function alertServiceDown(service: string, error: string): Promise<void>;
export declare function alertBackupFailure(error: string): Promise<void>;
export declare function alertRecoveryResult(success: boolean, details: Record<string, any>): Promise<void>;
//# sourceMappingURL=alert.service.d.ts.map