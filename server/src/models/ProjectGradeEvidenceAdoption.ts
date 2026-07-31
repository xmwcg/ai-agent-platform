import mongoose, { Document, Schema, type Model } from 'mongoose';

export const PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION = 1 as const;

export interface IProjectGradeEvidenceAdoption extends Document {
  adoptionId: string;
  projectId: string;
  targetId: string;
  ownerId: string;
  teamId?: string;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  projectionVersion: number;
  adoptionVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION;
  draftCount: number;
  evidenceIds: string[];
  createdBy: string;
  evidenceScope: 'authorized_local_source_snapshot';
  scoringDisposition: 'adopted_pending_evaluation';
  productionAcceptance: false;
  externalScanningEnabled: false;
  createdAt: Date;
}

const sha256Digest = /^sha256:[a-f0-9]{64}$/;
const sourceEvidenceId = /^source-evidence:v1:[a-f0-9]{64}$/;

const ProjectGradeEvidenceAdoptionSchema = new Schema<IProjectGradeEvidenceAdoption>(
  {
    adoptionId: { type: String, required: true, unique: true, index: true, immutable: true },
    projectId: { type: String, required: true, index: true, immutable: true },
    targetId: { type: String, required: true, index: true, immutable: true },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    sourceScanId: { type: String, required: true, index: true, immutable: true },
    sourceScanVersion: { type: String, required: true, immutable: true, maxlength: 120 },
    snapshotHash: {
      type: String,
      required: true,
      immutable: true,
      match: sha256Digest,
    },
    draftSetHash: {
      type: String,
      required: true,
      immutable: true,
      match: sha256Digest,
    },
    projectionVersion: { type: Number, required: true, min: 1, immutable: true },
    adoptionVersion: {
      type: Number,
      required: true,
      enum: [PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION],
      immutable: true,
    },
    draftCount: {
      type: Number,
      required: true,
      min: 1,
      immutable: true,
      validate: {
        validator: Number.isInteger,
        message: 'Evidence adoption draftCount must be an integer',
      },
    },
    evidenceIds: {
      type: [String],
      required: true,
      immutable: true,
      validate: [
        {
          validator: (values: string[]) =>
            values.length > 0 && values.every((value) => sourceEvidenceId.test(value)),
          message: 'Evidence adoption IDs must be versioned source evidence IDs',
        },
        {
          validator: (values: string[]) => new Set(values).size === values.length,
          message: 'Evidence adoption IDs must be unique',
        },
      ],
    },
    createdBy: { type: String, required: true, immutable: true },
    evidenceScope: {
      type: String,
      required: true,
      enum: ['authorized_local_source_snapshot'],
      default: 'authorized_local_source_snapshot',
      immutable: true,
    },
    scoringDisposition: {
      type: String,
      required: true,
      enum: ['adopted_pending_evaluation'],
      default: 'adopted_pending_evaluation',
      immutable: true,
    },
    productionAcceptance: {
      type: Boolean,
      required: true,
      default: false as const,
      immutable: true,
      validate: {
        validator: (value: boolean) => value === false,
        message: 'Evidence adoption cannot be used as production acceptance',
      },
    },
    externalScanningEnabled: {
      type: Boolean,
      required: true,
      default: false as const,
      immutable: true,
      validate: {
        validator: (value: boolean) => value === false,
        message: 'Source evidence adoption cannot enable external scanning',
      },
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    strict: 'throw',
  }
);

ProjectGradeEvidenceAdoptionSchema.index(
  { projectId: 1, targetId: 1, sourceScanId: 1, adoptionVersion: 1 },
  { unique: true }
);
ProjectGradeEvidenceAdoptionSchema.index({ projectId: 1, createdAt: -1 });
ProjectGradeEvidenceAdoptionSchema.index({ ownerId: 1, createdAt: -1 });
ProjectGradeEvidenceAdoptionSchema.index({ teamId: 1, createdAt: -1 });

export const ProjectGradeEvidenceAdoption: Model<IProjectGradeEvidenceAdoption> =
  (mongoose.models.ProjectGradeEvidenceAdoption as
    Model<IProjectGradeEvidenceAdoption> | undefined) ||
  mongoose.model<IProjectGradeEvidenceAdoption>(
    'ProjectGradeEvidenceAdoption',
    ProjectGradeEvidenceAdoptionSchema
  );
