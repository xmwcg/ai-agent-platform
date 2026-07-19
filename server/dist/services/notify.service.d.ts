export type NotifyChannel = 'disabled' | 'console' | 'wechat' | 'sms';
export interface NotifyMessage {
    /** 接收方：wechat 为 openid；sms 为手机号。 */
    to: string;
    title: string;
    content: string;
}
export interface NotifyResult {
    sent: boolean;
    channel: NotifyChannel;
    providerMessageId?: string;
    error?: string;
}
export declare function resolveChannel(env?: NodeJS.ProcessEnv): NotifyChannel;
/** 统一发送入口：失败不阻断普通业务，但必须返回真实失败状态并记录日志。 */
export declare function notify(msg: NotifyMessage): Promise<NotifyResult>;
/** 便捷：成本预警（给平台管理员或用户本人）。 */
export declare function notifyCostAlert(to: string, plan: string, usedFen: number, budgetFen: number): Promise<NotifyResult>;
//# sourceMappingURL=notify.service.d.ts.map