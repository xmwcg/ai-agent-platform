import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  PROJECT_GRADE_DIMENSIONS,
  PROJECT_GRADE_FINDING_FINGERPRINT_VERSION,
  PROJECT_GRADE_PROJECTION_VERSION,
  type FindingSeverity,
  type FindingStatus,
  type ProjectGradeDimensionKey,
  type ProjectGradeFindingWorkflowStatus,
} from '../project-grade/config';

export interface IProjectGradeFinding extends Document {
  findingId: string;
  fingerprint: string;
  fingerprintVersion: number;
  runId: string;
  projectId: string;
  targetId: string;
  ownerId: string;
  teamId?: string;
  rulePackKey: string;
  rulePackVersion: string;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  severity: FindingSeverity;
  snapshotStatus: FindingStatus;
  currentStatus: ProjectGradeFindingWorkflowStatus;
  title: string;
  description: string;
  recommendation: string;
  evidenceIds: string[];
  detectedAt: Date;
  workflowUpdatedBy?: string;
  workflowUpdatedAt?: Date;
  resolutionNote?: string;
  projectionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGradeFindingSchema = new Schema<IProjectGradeFinding>(
  {
    findingId: { type: String, required: true, unique: true, index: true, immutable: true },
    fingerprint: { type: String, required: true, index: true, immutable: true },
    fingerprintVersion: {
      type: Number,
      required: true,
      min: 1,
      default: PROJECT_GRADE_FINDING_FINGERPRINT_VERSION,
      immutable: true,
    },
    runId: { type: String, required: true, index: true, immutable: true },
    projectId: { type: String, required: true, index: true, immutable: true },
    targetId: { type: String, required: true, index: true, immutable: true },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    rulePackKey: { type: String, required: true, immutable: true },
    rulePackVersion: { type: String, required: true, immutable: true },
    ruleKey: { type: String, required: true, index: true, immutable: true },
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
      index: true,
      immutable: true,
    },
    severity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3'], index: true, immutable: true },
    snapshotStatus: {
      type: String,
      required: true,
      enum: ['open', 'accepted', 'resolved', 'false_positive'],
      immutable: true,
    },
    currentStatus: {
      type: String,
      required: true,
      enum: ['open', 'in_progress', 'ready_for_retest', 'verified', 'accepted_risk', 'false_positive'],
      default: 'open',
      index: true,
    },
    title: { type: String, required: true, immutable: true },
    description: { type: String, required: true, immutable: true },
    recommendation: { type: String, required: true, immutable: true },
    evidenceIds: { type: [String], required: true, default: [], immutable: true },
    detectedAt: { type: Date, required: true, index: true, immutable: true },
    workflowUpdatedBy: { type: String },
    workflowUpdatedAt: { type: Date },
    resolutionNote: { type: String, trim: true, maxlength: 2000 },
    projectionVersion: {
      type: Number,
      required: true,
      min: 1,
      default: PROJECT_GRADE_PROJECTION_VERSION,
      immutable: true,
    },
  },
  { timestamps: true }
);

ProjectGradeFindingSchema.index({ runId: 1, fingerprint: 1 }, { unique: true });
ProjectGradeFindingSchema.index({ projectId: 1, currentStatus: 1, severity: 1, detectedAt: -1 });
ProjectGradeFindingSchema.index({ projectId: 1, fingerprint: 1, detectedAt: -1 });
ProjectGradeFindingSchema.index({ teamId: 1, currentStatus: 1, detectedAt: -1 });

export const ProjectGradeFinding: Model<IProjectGradeFinding> =
  (mongoose.models.ProjectGradeFinding as Model<IProjectGradeFinding> | undefined) ||
  mongoose.model<IProjectGradeFinding>('ProjectGradeFinding', ProjectGradeFindingSchema);
