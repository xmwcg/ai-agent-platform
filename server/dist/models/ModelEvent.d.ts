import mongoose, { Document } from 'mongoose';
export type ModelEventType = 'release' | 'update' | 'deprecation';
export interface IModelEvent extends Document {
    modelName: string;
    vendor: string;
    /** 发布/更新日期，格式 YYYY-MM-DD */
    releaseDate: string;
    type: ModelEventType;
    description?: string;
    highlights: string[];
    /** 数据来源：种子内置 / 用户提交 / AI 补全 */
    source: 'seed' | 'user' | 'ai';
    createdBy?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ModelEvent: mongoose.Model<IModelEvent, {}, {}, {}, mongoose.Document<unknown, {}, IModelEvent, {}, {}> & IModelEvent & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ModelEvent.d.ts.map