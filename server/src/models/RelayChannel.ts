import mongoose, { Schema, Document } from 'mongoose';

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

const RelayChannelSchema = new Schema<IRelayChannel>(
  {
    name: { type: String, required: true },
    provider: { type: String, required: true },
    baseURL: { type: String, required: true },
    apiKey: { type: String, required: true },
    models: { type: [String], default: [] },
    authMode: { type: String, default: 'bearer', enum: ['bearer', 'x-api-key'] },
    weight: { type: Number, default: 1 },
    enabled: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export const RelayChannel = mongoose.model<IRelayChannel>('RelayChannel', RelayChannelSchema);
