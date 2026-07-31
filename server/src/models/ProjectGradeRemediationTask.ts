import { randomUUID } from 'crypto';
import mongoose, { Schema, Document, type Model } from 'mongoose';
import type { FindingSeverity, ProjectGradeRemediationStatus } from '../project-grade/config';

export interface IProjectGradeRemediationTask extends Document {
  taskId: string;
  projectId: string;
  sourceRunId: string;
  findingId: string;
  findingFingerprint: string;
  ownerId: string;
  teamId?: string;
  assigneeId?: string;
  severity: FindingSeverity;
  title: string;
  description: string;
  recommendation: string;
  status: ProjectGradeRemediationStatus;
  dueAt?: Date;
  slaHours?: number;
  retestRunId?: string;
  completionNote?: string;
  createdBy: string;
  updatedBy: string;
  verifiedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGradeRemediationTaskSchema = new Schema<IProjectGradeRemediationTask>(
  {
    taskId: { type: String, required: true, unique: true, index: true, default: randomUUID, immutable: true },
    projectId: { type: String, required: true, index: true, immutable: true },
    sourceRunId: { type: String, required: true, index: true, immutable: true },
    findingId: { type: String, required: true, index: true, immutable: true },
    findingFingerprint: { type: String, required: true, index: true, immutable: true },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    assigneeId: { type: String, index: true },
    severity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3'], index: true, immutable: true },
    title: { type: String, required: true, trim: true, maxlength: 200, immutable: true },
    description: { type: String, required: true, maxlength: 4000, immutable: true },
    recommendation: { type: String, required: true, maxlength: 4000, immutable: true },
    status: {
      type: String,
      required: true,
      enum: ['open', 'in_progress', 'blocked', 'ready_for_retest', 'verified', 'cancelled'],
      default: 'open',
      index: true,
    },
    dueAt: { type: Date, index: true },
    slaHours: { type: Number, min: 1, max: 8760 },
    retestRunId: { type: String, index: true },
    completionNote: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: String, required: true, immutable: true },
    updatedBy: { type: String, required: true },
    verifiedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectGradeRemediationTaskSchema.index({ projectId: 1, findingId: 1 }, { unique: true });
ProjectGradeRemediationTaskSchema.index({ projectId: 1, status: 1, severity: 1, dueAt: 1 });
ProjectGradeRemediationTaskSchema.index({ teamId: 1, status: 1, updatedAt: -1 });
ProjectGradeRemediationTaskSchema.index({ assigneeId: 1, status: 1, dueAt: 1 });
ProjectGradeRemediationTaskSchema.index({ projectId: 1, findingFingerprint: 1, createdAt: -1 });

export const ProjectGradeRemediationTask: Model<IProjectGradeRemediationTask> =
  (mongoose.models.ProjectGradeRemediationTask as Model<IProjectGradeRemediationTask> | undefined) ||
  mongoose.model<IProjectGradeRemediationTask>('ProjectGradeRemediationTask', ProjectGradeRemediationTaskSchema);
