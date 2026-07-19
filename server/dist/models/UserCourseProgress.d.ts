import mongoose, { Document } from 'mongoose';
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
export declare const UserCourseProgress: mongoose.Model<IUserCourseProgress, {}, {}, {}, mongoose.Document<unknown, {}, IUserCourseProgress, {}, {}> & IUserCourseProgress & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=UserCourseProgress.d.ts.map