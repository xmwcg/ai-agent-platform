import mongoose, { Schema, Document } from 'mongoose';
import type { MediaTaskType, MediaProviderName } from '../services/media-gen.service';

export interface IMediaTask extends Document {
  taskId: string;
  type: MediaTaskType;
  status: 'completed' | 'processing';
  prompt: string;
  outputUrl: string;
  thumbnailUrl?: string;
  /** 多图结果（如一次生成多张），outputUrl 为主图 */
  images?: string[];
  duration?: number;
  provider: string;
  note: string;
  /** 所属用户（可选，用于按用户隔离历史；匿名任务为空） */
  userId?: string;
  /**
   * BYOK 凭据密文（AES-256-GCM，来自 crypto.ts）。仅当用户使用自带 Key 生成时存在，
   * 供异步轮询 queryTask 时解密并注入厂商请求；明文不落库，DB 泄露也无法还原。
   * 内容为加密后的 JSON：{ secretId?, secretKey }
   */
  byokEnc?: string;
  createdAt: Date;
  /** TTL 索引：24 小时后自动删除旧任务 */
  expiresAt: Date;
}

const MediaTaskSchema = new Schema<IMediaTask>(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ['text2img', 'image2image', 'text2video', 'image2video'] },
    status: { type: String, required: true, enum: ['completed', 'processing'], default: 'processing' },
    prompt: { type: String, required: true },
    outputUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    images: { type: [String], default: undefined },
    duration: { type: Number, default: null },
    provider: { type: String, required: true },
    note: { type: String, default: '' },
    userId: { type: String, index: true, sparse: true, default: null },
    byokEnc: { type: String, default: null },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** TTL 索引：MongoDB 自动清理过期任务 */
MediaTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MediaTask = mongoose.model<IMediaTask>('MediaTask', MediaTaskSchema);
