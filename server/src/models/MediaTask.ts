import mongoose, { Schema, Document } from 'mongoose';
import type { MediaTaskType, MediaProviderName } from '../services/media-gen.service';

export interface IMediaTask extends Document {
  taskId: string;
  type: MediaTaskType;
  status: 'completed' | 'processing';
  prompt: string;
  outputUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  provider: string;
  note: string;
  createdAt: Date;
  /** TTL 索引：24 小时后自动删除旧任务 */
  expiresAt: Date;
}

const MediaTaskSchema = new Schema<IMediaTask>(
  {
    taskId: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true, enum: ['image2image', 'text2video', 'image2video'] },
    status: { type: String, required: true, enum: ['completed', 'processing'], default: 'processing' },
    prompt: { type: String, required: true },
    outputUrl: { type: String, required: true },
    thumbnailUrl: { type: String, default: null },
    duration: { type: Number, default: null },
    provider: { type: String, required: true },
    note: { type: String, default: '' },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 24 * 60 * 60 * 1000) },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** TTL 索引：MongoDB 自动清理过期任务 */
MediaTaskSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const MediaTask = mongoose.model<IMediaTask>('MediaTask', MediaTaskSchema);
