import mongoose, { Document, Schema } from 'mongoose';

export type AIUsageStatus = 'success' | 'error' | 'fallback';

export interface IAIUsageLog extends Document {
  userId?: mongoose.Types.ObjectId;
  sessionId?: string;
  requestId?: string;
  resource: string;
  toolId?: string;
  provider?: string;
  modelId?: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  creditsDeducted: number;
  costFen: number;
  status: AIUsageStatus;
  fallback: boolean;
  createdAt: Date;
}

const AIUsageLogSchema = new Schema<IAIUsageLog>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', index: true, sparse: true },
  sessionId: { type: String, index: true },
  requestId: { type: String, index: true, sparse: true },
  resource: { type: String, required: true, default: 'ai_chat', index: true },
  toolId: { type: String, index: true },
  provider: { type: String, index: true },
  modelId: { type: String, index: true },
  promptTokens: { type: Number, default: 0, min: 0 },
  completionTokens: { type: Number, default: 0, min: 0 },
  totalTokens: { type: Number, default: 0, min: 0 },
  creditsDeducted: { type: Number, default: 0, min: 0 },
  costFen: { type: Number, default: 0, min: 0 },
  status: { type: String, enum: ['success', 'error', 'fallback'], default: 'success' },
  fallback: { type: Boolean, default: false },
}, { timestamps: { createdAt: true, updatedAt: false } });

AIUsageLogSchema.index({ createdAt: -1 });
AIUsageLogSchema.index({ provider: 1, modelId: 1, createdAt: -1 });
AIUsageLogSchema.index({ toolId: 1, createdAt: -1 });

export const AIUsageLog = mongoose.model<IAIUsageLog>('AIUsageLog', AIUsageLogSchema);
