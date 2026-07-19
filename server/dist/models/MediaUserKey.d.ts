import mongoose, { Document } from 'mongoose';
/** 支持 BYOK（用户自带 Key）的媒体厂商 */
export type MediaByokProvider = 'hunyuan' | 'keling' | 'jimeng';
export interface IMediaUserKey extends Document {
    /** 所属用户 */
    userId: string;
    /** 媒体厂商（每个用户每厂商一条） */
    provider: MediaByokProvider;
    /**
     * 加密后的厂商凭据。混元为 TC3 的 SecretId（可选，可灵/即梦无此字段）；
     * 统一用 crypto.ts 的 encryptSecret 加密后再落库，DB 泄露也无法还原明文。
     */
    secretIdEnc?: string;
    /** 加密后的 SecretKey（混元）/ API Token（可灵、即梦） */
    secretKeyEnc: string;
    /** 是否启用该 BYOK Key（关闭后回落平台垫付） */
    enabled: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const MediaUserKey: mongoose.Model<IMediaUserKey, {}, {}, {}, mongoose.Document<unknown, {}, IMediaUserKey, {}, {}> & IMediaUserKey & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=MediaUserKey.d.ts.map