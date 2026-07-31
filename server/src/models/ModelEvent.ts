import mongoose, { Schema, Document } from 'mongoose';

export type ModelEventType = 'release' | 'update' | 'deprecation';

export interface IModelEvent extends Document {
  modelName: string;
  vendor: string;
  /** 发布/更新日期，格式 YYYY-MM-DD */
  releaseDate: string;
  type: ModelEventType;
  description?: string;
  highlights: string[];
  /** 数据来源：种子内置 / 用户提交 / AI 补全 */
  source: 'seed' | 'user' | 'ai';
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ModelEventSchema = new Schema<IModelEvent>(
  {
    modelName: { type: String, required: true, trim: true },
    vendor: { type: String, required: true, trim: true },
    releaseDate: { type: String, required: true },
    type: {
      type: String,
      enum: ['release', 'update', 'deprecation'],
      default: 'release',
    },
    description: { type: String },
    highlights: { type: [String], default: [] },
    source: {
      type: String,
      enum: ['seed', 'user', 'ai'],
      default: 'seed',
    },
    createdBy: { type: String },
  },
  { timestamps: true }
);

ModelEventSchema.index({ releaseDate: 1 });
ModelEventSchema.index({ vendor: 1 });
ModelEventSchema.index({ type: 1 });

export const ModelEvent = mongoose.model<IModelEvent>('ModelEvent', ModelEventSchema);
