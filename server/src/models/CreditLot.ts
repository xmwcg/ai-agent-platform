import mongoose, { Document, Schema } from 'mongoose';

export type CreditLotSourceType =
  | 'subscription_free'
  | 'promotion_free'
  | 'purchase'
  | 'refund'
  | 'adjustment'
  | 'legacy_protected';

export type CreditLotStatus = 'active' | 'depleted' | 'expired' | 'reversed';

export interface ICreditLot extends Document {
  userId: mongoose.Types.ObjectId;
  sourceType: CreditLotSourceType;
  originalAmount: number;
  remainingAmount: number;
  sourceOrderNo?: string;
  idempotencyKey: string;
  expiresAt?: Date;
  status: CreditLotStatus;
  migrationBatch?: string;
  auditReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const CreditLotSchema = new Schema<ICreditLot>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sourceType: {
    type: String,
    enum: ['subscription_free', 'promotion_free', 'purchase', 'refund', 'adjustment', 'legacy_protected'],
    required: true,
  },
  originalAmount: { type: Number, required: true, min: 0 },
  remainingAmount: { type: Number, required: true, min: 0 },
  sourceOrderNo: { type: String, index: true, sparse: true },
  idempotencyKey: { type: String, required: true },
  expiresAt: { type: Date },
  status: { type: String, enum: ['active', 'depleted', 'expired', 'reversed'], default: 'active', index: true },
  migrationBatch: { type: String },
  auditReason: { type: String, maxlength: 500 },
}, { timestamps: true });

CreditLotSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
CreditLotSchema.index({ userId: 1, status: 1, expiresAt: 1, createdAt: 1 });

export const CreditLot = mongoose.model<ICreditLot>('CreditLot', CreditLotSchema);
