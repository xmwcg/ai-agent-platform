import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  PROJECT_GRADE_DIMENSIONS,
  type ProjectGradeProjectionStatus,
} from '../project-grade/config';
import type { ProjectGradeEvaluationResult } from '../project-grade/engine';

export type ProjectGradeEvaluationInputKind = 'baseline' | 'source_evidence_adoption';

const SOURCE_EVIDENCE_PROVENANCE_FIELDS = [
  'adoptionId',
  'sourceScanId',
  'sourceScanVersion',
  'snapshotHash',
  'draftSetHash',
  'sourceEvidenceProjectionVersion',
  'sourceEvidenceAdoptionVersion',
  'sourceEvidenceScoringPolicyVersion',
] as const;

function hasEvaluationInputValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== '';
}

function validatesEvaluationInputContract(
  this: IEvaluationRun,
  inputKind: ProjectGradeEvaluationInputKind
): boolean {
  const document = this as unknown as Record<string, unknown>;
  const provenanceComplete = SOURCE_EVIDENCE_PROVENANCE_FIELDS.every((field) =>
    hasEvaluationInputValue(document[field])
  );
  const provenanceAbsent = SOURCE_EVIDENCE_PROVENANCE_FIELDS.every(
    (field) => !hasEvaluationInputValue(document[field])
  );

  if (inputKind === 'source_evidence_adoption') {
    return provenanceComplete && this.productionVerified === false;
  }
  return provenanceAbsent;
}

export interface IEvaluationRun extends Document, Omit<ProjectGradeEvaluationResult, 'assessedAt'> {
  projectId?: string;
  targetId?: string;
  ownerId?: string;
  teamId?: string;
  createdBy?: string;
  persistenceVersion?: number;
  evaluationInputKind: ProjectGradeEvaluationInputKind;
  adoptionId?: string;
  sourceScanId?: string;
  sourceScanVersion?: string;
  snapshotHash?: string;
  draftSetHash?: string;
  sourceEvidenceProjectionVersion?: number;
  sourceEvidenceAdoptionVersion?: number;
  sourceEvidenceScoringPolicyVersion?: number;
  projectionStatus: ProjectGradeProjectionStatus;
  projectionAttemptId?: string;
  projectionStartedAt?: Date;
  projectionLeaseExpiresAt?: Date;
  projectedAt?: Date;
  projectionError?: string;
  assessedAt: Date;
}

const EvidenceSchema = new Schema(
  {
    id: { type: String, required: true },
    fingerprint: { type: String, required: true, index: true },
    fingerprintVersion: { type: Number, required: true, min: 1 },
    ruleKey: { type: String, required: true, index: true },
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
    },
    level: {
      type: String,
      required: true,
      enum: ['production_automatic', 'ci_integration', 'source_static', 'documentation', 'none'],
    },
    factor: { type: Number, required: true, min: 0, max: 1 },
    title: { type: String, required: true },
    description: { type: String, required: true },
    sourceType: {
      type: String,
      required: true,
      enum: ['production_probe', 'test_command', 'source_file', 'document', 'manual'],
    },
    source: { type: String, required: true },
    collectedAt: { type: Date, required: true },
    verifiedAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const FindingSchema = new Schema(
  {
    id: { type: String, required: true },
    fingerprint: { type: String, required: true, index: true },
    fingerprintVersion: { type: Number, required: true, min: 1 },
    ruleKey: { type: String, required: true, index: true },
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
    },
    severity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3'], index: true },
    status: {
      type: String,
      required: true,
      enum: ['open', 'accepted', 'resolved', 'false_positive'],
    },
    title: { type: String, required: true },
    description: { type: String, required: true },
    recommendation: { type: String, required: true },
    evidenceIds: { type: [String], required: true, default: [] },
    createdAt: { type: Date, required: true },
  },
  { _id: false }
);

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

const DimensionSnapshotSchema = new Schema(
  {
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
    },
    label: { type: String, required: true },
    weight: { type: Number, required: true, min: 0 },
    rawScore: { type: Number, required: true, min: 0 },
    normalizedScore: { type: Number, required: true, min: 0, max: 100 },
    rules: { type: [RuleSnapshotSchema], required: true, default: [] },
  },
  { _id: false }
);

const ReleaseGateSchema = new Schema(
  {
    status: { type: String, required: true, enum: ['PASS', 'CONDITIONAL', 'BLOCKED'] },
    highestSeverity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3', 'NONE'] },
    scoreCap: { type: Number, required: true, min: 0, max: 1000 },
    blockedForRelease: { type: Boolean, required: true },
    blockedForPaidSale: { type: Boolean, required: true },
    reasons: { type: [String], required: true, default: [] },
  },
  { _id: false }
);

const EvaluationRunSchema = new Schema<IEvaluationRun>(
  {
    runId: { type: String, required: true, unique: true, index: true, immutable: true },
    projectId: { type: String, index: true, immutable: true },
    targetId: { type: String, index: true, immutable: true },
    ownerId: { type: String, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    createdBy: { type: String, immutable: true },
    persistenceVersion: { type: Number, min: 1, default: 1, immutable: true },
    evaluationInputKind: {
      type: String,
      required: true,
      enum: ['baseline', 'source_evidence_adoption'],
      default: 'baseline',
      immutable: true,
      index: true,
      validate: {
        validator: validatesEvaluationInputContract,
        message:
          'Evaluation input kind must match complete source evidence provenance and production boundaries',
      },
    },
    adoptionId: {
      type: String,
      immutable: true,
      match: /^source-adoption:v1:[a-f0-9]{64}$/,
    },
    sourceScanId: { type: String, immutable: true, index: true },
    sourceScanVersion: { type: String, immutable: true, maxlength: 120 },
    snapshotHash: { type: String, immutable: true, match: /^sha256:[a-f0-9]{64}$/ },
    draftSetHash: { type: String, immutable: true, match: /^sha256:[a-f0-9]{64}$/ },
    sourceEvidenceProjectionVersion: { type: Number, min: 1, immutable: true },
    sourceEvidenceAdoptionVersion: { type: Number, min: 1, immutable: true },
    sourceEvidenceScoringPolicyVersion: { type: Number, min: 1, immutable: true },
    projectionStatus: {
      type: String,
      required: true,
      enum: ['pending', 'projecting', 'ready', 'failed'],
      default: 'pending',
      index: true,
    },
    projectionAttemptId: {
      type: String,
      match: /^projection-attempt:v1:[a-f0-9]{64}$/,
    },
    projectionStartedAt: { type: Date },
    projectionLeaseExpiresAt: { type: Date },
    projectedAt: { type: Date },
    projectionError: { type: String, maxlength: 1000 },
    projectName: { type: String, required: true, trim: true, immutable: true },
    projectType: {
      type: String,
      required: true,
      enum: [
        'website',
        'saas',
        'ai_application',
        'api_service',
        'mobile_application',
        'desktop_software',
        'enterprise_intranet',
        'open_source',
      ],
      index: true,
    },
    projectUrl: { type: String },
    rulePackKey: { type: String, required: true },
    rulePackVersion: { type: String, required: true },
    assessedAt: { type: Date, required: true, index: true },
    rawTotalScore: { type: Number, required: true, min: 0, max: 1000 },
    finalTotalScore: { type: Number, required: true, min: 0, max: 1000 },
    normalizedScore: { type: Number, required: true, min: 0, max: 100 },
    grade: { type: String, required: true, enum: ['S', 'A', 'B', 'C', 'D', 'F'] },
    releaseGate: { type: ReleaseGateSchema, required: true },
    snapshots: { type: [DimensionSnapshotSchema], required: true, default: [] },
    evidence: { type: [EvidenceSchema], required: true, default: [] },
    findings: { type: [FindingSchema], required: true, default: [] },
    productionVerified: { type: Boolean, required: true, default: false },
    summary: { type: String, required: true },
  },
  { timestamps: true }
);

EvaluationRunSchema.index({ projectName: 1, assessedAt: -1 });
EvaluationRunSchema.index({ projectId: 1, assessedAt: -1 });
EvaluationRunSchema.index({ ownerId: 1, assessedAt: -1 });
EvaluationRunSchema.index({ teamId: 1, assessedAt: -1 });
EvaluationRunSchema.index({ 'releaseGate.highestSeverity': 1, assessedAt: -1 });
EvaluationRunSchema.index({ projectionStatus: 1, assessedAt: -1 });
EvaluationRunSchema.index({ projectionStatus: 1, projectionLeaseExpiresAt: 1 });
EvaluationRunSchema.index(
  { adoptionId: 1 },
  {
    unique: true,
    partialFilterExpression: { evaluationInputKind: 'source_evidence_adoption' },
  }
);

export const EvaluationRun: Model<IEvaluationRun> =
  (mongoose.models.EvaluationRun as Model<IEvaluationRun> | undefined) ||
  mongoose.model<IEvaluationRun>('EvaluationRun', EvaluationRunSchema);
