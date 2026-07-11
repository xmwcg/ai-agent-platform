import mongoose, { Schema, Document } from 'mongoose';

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

const MediaUserKeySchema = new Schema<IMediaUserKey>(
  {
    userId: { type: String, required: true, index: true },
    provider: {
      type: String,
      required: true,
      enum: ['hunyuan', 'keling', 'jimeng'],
    },
    secretIdEnc: { type: String, default: null },
    secretKeyEnc: { type: String, required: true },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

/** 每个用户对每个媒体厂商仅保留一条 Key（upsert 语义） */
MediaUserKeySchema.index({ userId: 1, provider: 1 }, { unique: true });

export const MediaUserKey = mongoose.model<IMediaUserKey>('MediaUserKey', MediaUserKeySchema);
