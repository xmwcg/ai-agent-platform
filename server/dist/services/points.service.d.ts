import mongoose from 'mongoose';
/** 每日签到：业务事实、额度批次、余额缓存和流水在同一事务内提交。 */
export declare function dailyCheckIn(userId: string): Promise<{
    success: boolean;
    message: string;
    points: number;
    streak: number;
}>;
/** 获取签到状态（今天是否已签到 + 连续天数）。 */
export declare function getCheckInStatus(userId: string): Promise<{
    checkedInToday: boolean;
    todayPoints: number;
    streak: number;
    totalCheckIns: number;
    nextStreakBonus: number;
    weeklyBonusInDays: number;
}>;
/** 获取签到历史。 */
export declare function getCheckInHistory(userId: string, page?: number, pageSize?: number): Promise<{
    items: (mongoose.Document<unknown, {}, import("../models/DailyCheckIn").IDailyCheckIn, {}, {}> & import("../models/DailyCheckIn").IDailyCheckIn & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
/**
 * 仅供已验证的内部业务事件调用。调用方必须提供不可伪造且唯一的业务事实 ID。
 * 不再暴露任何允许客户端直接领取任务积分的路由。
 */
export declare function awardVerifiedTaskPoints(userId: string, amount: number, taskType: keyof typeof TASK_POINTS, businessId: string): Promise<void>;
export declare const TASK_POINTS: {
    readonly ai_chat: 5;
    readonly knowledge_upload: 30;
    readonly course_complete: 20;
    readonly tool_use: 3;
    readonly daily_login: 2;
    readonly profile_complete: 50;
    readonly share_content: 5;
};
//# sourceMappingURL=points.service.d.ts.map