import mongoose, { Document } from 'mongoose';
/**
 * 每日签到记录（DailyCheckIn）
 *
 * 记录用户每日签到，支持连续签到奖励机制。
 * 每天最多签到一次，以自然日去重。
 */
export interface IDailyCheckIn extends Document {
    userId: mongoose.Types.ObjectId;
    date: string;
    pointsEarned: number;
    streak: number;
    createdAt: Date;
}
export declare const DailyCheckIn: mongoose.Model<IDailyCheckIn, {}, {}, {}, mongoose.Document<unknown, {}, IDailyCheckIn, {}, {}> & IDailyCheckIn & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=DailyCheckIn.d.ts.map