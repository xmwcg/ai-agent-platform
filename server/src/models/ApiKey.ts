import mongoose, { Schema, Document } from 'mongoose';

export interface IApiKey extends Document {
  ownerId: string;
  teamId?: string;
  name: string;
  keyHash: string;
  prefix: string;
  status: 'active' | 'revoked';
  /** 单日调用配额（按量计费闸门） */
  quotaDaily: number;
  usedToday: number;
  lastReset: Date;
  /** 授权范围，如 chat / media / translate */
  scopes: string[];
  /** 是否启用积分自动抵扣（配额耗尽后从用户积分扣减，每 10 积分 = 1 次额外调用） */
  creditsEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const ApiKeySchema = new Schema<IApiKey>(
  {
    ownerId: { type: String, required: true, index: true },
    teamId: { type: String },
    name: { type: String, required: true, trim: true },
    keyHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    status: { type: String, enum: ['active', 'revoked'], default: 'active' },
    quotaDaily: { type: Number, default: 1000 },
    usedToday: { type: Number, default: 0 },
    lastReset: { type: Date, default: Date.now },
    scopes: { type: [String], default: ['chat'] },
    creditsEnabled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const ApiKey = mongoose.model<IApiKey>('ApiKey', ApiKeySchema);
