import mongoose, { Schema, Document } from 'mongoose';

/** 用户课程进度 */
export interface IUserCourseProgress extends Document {
  userId: mongoose.Types.ObjectId;
  courseId: mongoose.Types.ObjectId;
  /** 已完成的章节索引列表 */
  completedChapters: number[];
  /** 各章节测验成绩: { chapterIdx: score } */
  quizScores: Record<number, number>;
  /** 学习总时长（秒） */
  totalStudySeconds: number;
  /** 最后学习时间 */
  lastStudyAt: Date;
  /** 是否完成全部课程 */
  isCompleted: boolean;
  /** 已报名 */
  enrolled: boolean;
  enrolledAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserCourseProgressSchema = new Schema<IUserCourseProgress>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    courseId: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    completedChapters: { type: [Number], default: [] },
    quizScores: { type: Schema.Types.Mixed, default: {} },
    totalStudySeconds: { type: Number, default: 0 },
    lastStudyAt: { type: Date, default: Date.now },
    isCompleted: { type: Boolean, default: false },
    enrolled: { type: Boolean, default: false },
    enrolledAt: { type: Date },
  },
  { timestamps: true }
);

// 联合唯一索引：一个用户一门课一条进度
UserCourseProgressSchema.index({ userId: 1, courseId: 1 }, { unique: true });
UserCourseProgressSchema.index({ userId: 1 });
UserCourseProgressSchema.index({ courseId: 1 });

export const UserCourseProgress = mongoose.model<IUserCourseProgress>(
  'UserCourseProgress',
  UserCourseProgressSchema
);
