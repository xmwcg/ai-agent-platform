import mongoose, { Document } from 'mongoose';
/** 中转站上游渠道：平台侧统一接各家大模型（密钥加密落库，仅平台持有） */
export interface IRelayChannel extends Document {
    name: string;
    provider: string;
    baseURL: string;
    apiKey: string;
    models: string[];
    authMode: 'bearer' | 'x-api-key';
    weight: number;
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const RelayChannel: mongoose.Model<IRelayChannel, {}, {}, {}, mongoose.Document<unknown, {}, IRelayChannel, {}, {}> & IRelayChannel & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=RelayChannel.d.ts.map