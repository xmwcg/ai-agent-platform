import mongoose, { Document } from 'mongoose';
/** 大模型配置（借鉴 Dify 模型管理，支持动态增删与运行时切换） */
export interface IModelConfig extends Document {
    name: string;
    provider: string;
    baseURL: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
    enabled: boolean;
    isDefault: boolean;
    pinned: boolean;
    description?: string;
    createdBy: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const ModelConfig: mongoose.Model<IModelConfig, {}, {}, {}, mongoose.Document<unknown, {}, IModelConfig, {}, {}> & IModelConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=ModelConfig.d.ts.map