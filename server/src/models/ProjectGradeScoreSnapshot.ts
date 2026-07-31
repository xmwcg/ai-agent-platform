import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  PROJECT_GRADE_DIMENSIONS,
  PROJECT_GRADE_PROJECTION_VERSION,
  type ProjectGradeDimensionKey,
} from '../project-grade/config';
import type { RuleScoreSnapshot } from '../project-grade/engine';

export interface IProjectGradeScoreSnapshot extends Document {
  snapshotId: string;
  runId: string;
  projectId: string;
  targetId: string;
  ownerId: string;
  teamId?: string;
  rulePackKey: string;
  rulePackVersion: string;
  dimensionKey: ProjectGradeDimensionKey;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  rules: RuleScoreSnapshot[];
  assessedAt: Date;
  projectionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const RuleSnapshotSchema = new Schema(
  {
    ruleKey: { type: String, required: true },
    title: { type: String, required: true },
    weight: { type: Number, required: true, min: 0 },
    completion: { type: Number, required: true, enum: [0, 0.25, 0.5, 0.75, 1] },
    evidenceLevel: {
      type: String,
      required: true,
      enum: ['production_automatic', 'ci_integration', 'source_static', 'documentation', 'none'],
    },
    evidenceFactor: { type: Number, required: true, min: 0, max: 1 },
    awardedScore: { type: Number, required: true, min: 0 },
    notes: { type: String, required: true, default: '' },
    evidenceIds: { type: [String], required: true, default: [] },
  },
  { _id: false }
);

const ProjectGradeScoreSnapshotSchema = new Schema<IProjectGradeScoreSnapshot>(
  {
    snapshotId: { type: String, required: true, unique: true, index: true, immutable: true },
    runId: { type: String, required: true, index: true, immutable: true },
    projectId: { type: String, required: true, index: true, immutable: true },
    targetId: { type: String, required: true, index: true, immutable: true },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    rulePackKey: { type: String, required: true, immutable: true },
    rulePackVersion: { type: String, required: true, immutable: true },
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
      immutable: true,
    },
    label: { type: String, required: true, immutable: true },
    weight: { type: Number, required: true, min: 0, immutable: true },
    rawScore: { type: Number, required: true, min: 0, immutable: true },
    normalizedScore: { type: Number, required: true, min: 0, max: 100, immutable: true },
    rules: { type: [RuleSnapshotSchema], required: true, default: [], immutable: true },
    assessedAt: { type: Date, required: true, index: true, immutable: true },
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

ProjectGradeScoreSnapshotSchema.index({ runId: 1, dimensionKey: 1 }, { unique: true });
ProjectGradeScoreSnapshotSchema.index({ projectId: 1, assessedAt: -1, dimensionKey: 1 });
ProjectGradeScoreSnapshotSchema.index({ teamId: 1, assessedAt: -1 });

export const ProjectGradeScoreSnapshot: Model<IProjectGradeScoreSnapshot> =
  (mongoose.models.ProjectGradeScoreSnapshot as Model<IProjectGradeScoreSnapshot> | undefined) ||
  mongoose.model<IProjectGradeScoreSnapshot>('ProjectGradeScoreSnapshot', ProjectGradeScoreSnapshotSchema);
