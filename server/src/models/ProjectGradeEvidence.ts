import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  EVIDENCE_FACTORS,
  PROJECT_GRADE_DIMENSIONS,
  PROJECT_GRADE_PROJECTION_VERSION,
  type EvidenceLevel,
  type ProjectGradeDimensionKey,
} from '../project-grade/config';

export interface IProjectGradeEvidence extends Document {
  evidenceId: string;
  runId: string;
  projectId: string;
  targetId: string;
  ownerId: string;
  teamId?: string;
  rulePackKey: string;
  rulePackVersion: string;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  level: EvidenceLevel;
  factor: number;
  sourceType: 'production_probe' | 'test_command' | 'source_file' | 'document' | 'manual';
  source: string;
  collectedAt: Date;
  verifiedAt?: Date;
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  projectionVersion: number;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGradeEvidenceSchema = new Schema<IProjectGradeEvidence>(
  {
    evidenceId: { type: String, required: true, immutable: true },
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
    level: { type: String, required: true, enum: Object.keys(EVIDENCE_FACTORS), index: true, immutable: true },
    factor: { type: Number, required: true, min: 0, max: 1, immutable: true },
    sourceType: {
      type: String,
      required: true,
      enum: ['production_probe', 'test_command', 'source_file', 'document', 'manual'],
      index: true,
      immutable: true,
    },
    source: { type: String, required: true, immutable: true },
    collectedAt: { type: Date, required: true, index: true, immutable: true },
    verifiedAt: { type: Date, immutable: true },
    title: { type: String, required: true, immutable: true },
    description: { type: String, required: true, immutable: true },
    metadata: { type: Schema.Types.Mixed, immutable: true },
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

ProjectGradeEvidenceSchema.index({ runId: 1, evidenceId: 1 }, { unique: true });
ProjectGradeEvidenceSchema.index({ projectId: 1, collectedAt: -1 });
ProjectGradeEvidenceSchema.index({ projectId: 1, dimensionKey: 1, collectedAt: -1 });
ProjectGradeEvidenceSchema.index({ teamId: 1, collectedAt: -1 });

export const ProjectGradeEvidence: Model<IProjectGradeEvidence> =
  (mongoose.models.ProjectGradeEvidence as Model<IProjectGradeEvidence> | undefined) ||
  mongoose.model<IProjectGradeEvidence>('ProjectGradeEvidence', ProjectGradeEvidenceSchema);
