import mongoose, { Schema, Document } from 'mongoose';

/**
 * 每日签到记录（DailyCheckIn）
 *
 * 记录用户每日签到，支持连续签到奖励机制。
 * 每天最多签到一次，以自然日去重。
 */
export interface IDailyCheckIn extends Document {
  userId: mongoose.Types.ObjectId;
  date: string;            // YYYY-MM-DD 格式，用于去重
  pointsEarned: number;    // 本次签到获得积分
  streak: number;          // 连续签到天数
  createdAt: Date;
}

const DailyCheckInSchema = new Schema<IDailyCheckIn>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
    pointsEarned: { type: Number, required: true, default: 10 },
    streak: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 唯一索引：同一用户同一天只能签到一次
DailyCheckInSchema.index({ userId: 1, date: 1 }, { unique: true });
DailyCheckInSchema.index({ userId: 1, createdAt: -1 });

export const DailyCheckIn = mongoose.model<IDailyCheckIn>('DailyCheckIn', DailyCheckInSchema);
