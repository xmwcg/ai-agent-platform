import { randomUUID } from 'crypto';
import mongoose, { Schema, Document, type Model } from 'mongoose';

export type ProjectGradeScanTargetKind = 'internal_repository' | 'url' | 'repository';
export type ProjectGradeScanTargetStatus = 'active' | 'disabled';

export interface IProjectGradeScanTarget extends Document {
  targetId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  kind: ProjectGradeScanTargetKind;
  label: string;
  scopeKey: string;
  url?: string;
  repositoryProvider?: 'cnb' | 'github' | 'git' | 'internal';
  repositoryRef?: string;
  status: ProjectGradeScanTargetStatus;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGradeScanTargetSchema = new Schema<IProjectGradeScanTarget>(
  {
    targetId: { type: String, required: true, unique: true, index: true, default: randomUUID },
    projectId: { type: String, required: true, index: true, immutable: true },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    kind: {
      type: String,
      required: true,
      enum: ['internal_repository', 'url', 'repository'],
      index: true,
      immutable: true,
    },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    scopeKey: { type: String, required: true, trim: true, maxlength: 120, immutable: true },
    url: { type: String, trim: true },
    repositoryProvider: { type: String, enum: ['cnb', 'github', 'git', 'internal'] },
    repositoryRef: { type: String, trim: true, maxlength: 500 },
    status: { type: String, required: true, enum: ['active', 'disabled'], default: 'active', index: true },
    createdBy: { type: String, required: true, immutable: true },
  },
  { timestamps: true }
);

ProjectGradeScanTargetSchema.index({ projectId: 1, status: 1, createdAt: 1 });
ProjectGradeScanTargetSchema.index(
  { projectId: 1, scopeKey: 1 },
  { unique: true }
);

export const ProjectGradeScanTarget: Model<IProjectGradeScanTarget> =
  (mongoose.models.ProjectGradeScanTarget as Model<IProjectGradeScanTarget> | undefined) ||
  mongoose.model<IProjectGradeScanTarget>('ProjectGradeScanTarget', ProjectGradeScanTargetSchema);
