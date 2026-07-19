import mongoose, { Document } from 'mongoose';
/** 中转站配置（key-value），目前用于存放独立管理员密码哈希 */
export interface IRelayConfig extends Document {
    key: string;
    value: string;
}
export declare const RelayConfig: mongoose.Model<IRelayConfig, {}, {}, {}, mongoose.Document<unknown, {}, IRelayConfig, {}, {}> & IRelayConfig & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=RelayConfig.d.ts.map