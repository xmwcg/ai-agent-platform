import mongoose, { Schema, Document } from 'mongoose';

/** 中转站配置（key-value），目前用于存放独立管理员密码哈希 */
export interface IRelayConfig extends Document {
  key: string;
  value: string;
}

const RelayConfigSchema = new Schema<IRelayConfig>({
  key: { type: String, required: true, unique: true, index: true },
  value: { type: String, required: true },
});

export const RelayConfig = mongoose.model<IRelayConfig>('RelayConfig', RelayConfigSchema);
