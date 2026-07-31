import mongoose, { Schema, Document } from 'mongoose';

export type StudioJobStatus = 'queued' | 'running' | 'success' | 'failed' | 'partial';

export interface IStudioStep {
  key: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error' | 'skipped';
  progress: number; // 0-100
  message?: string;
  output?: any;
}

export interface IStudioJob extends Document {
  userId: string;
  sceneId: string;
  templateId?: string;
  status: StudioJobStatus;
  inputs: any;
  steps: IStudioStep[];
  outputs: any;
  creditsCost: number;
  creditsDeducted: boolean;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  /** 任务产物 TTL：30 天后自动清理（与对象存储生命周期配合压成本） */
  expiresAt: Date;
}

const StudioStepSchema = new Schema(
  {
    key: String,
    label: String,
    status: { type: String, enum: ['pending', 'running', 'done', 'error', 'skipped'], default: 'pending' },
    progress: { type: Number, default: 0 },
    message: String,
    output: Schema.Types.Mixed,
  },
  { _id: false }
);

const StudioJobSchema = new Schema<IStudioJob>(
  {
    userId: { type: String, required: true, index: true },
    sceneId: { type: String, required: true },
    templateId: { type: String, default: null },
    status: {
      type: String,
      enum: ['queued', 'running', 'success', 'failed', 'partial'],
      default: 'queued',
      index: true,
    },
    inputs: { type: Schema.Types.Mixed, default: {} },
    steps: { type: [StudioStepSchema], default: [] },
    outputs: { type: Schema.Types.Mixed, default: {} },
    creditsCost: { type: Number, default: 0 },
    creditsDeducted: { type: Boolean, default: false },
    error: { type: String },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 30 * 24 * 3600 * 1000) },
  },
  { timestamps: true }
);

StudioJobSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const StudioJob = mongoose.model<IStudioJob>('StudioJob', StudioJobSchema);
