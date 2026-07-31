import mongoose, { Schema, Document, type Model } from 'mongoose';

export type PublicReportSeverity = 'P0' | 'P1' | 'P2' | 'P3' | null;
export type PublicReportProjectKind = 'website' | 'saas' | 'ai_application';
export type PublicReportVerdict = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export interface PublicReportFindingHighlight {
  severity: 'P0' | 'P1' | 'P2' | 'P3';
  dimensionKey: string;
  title: string;
}

export interface PublicReportDimensionRow {
  dimensionKey: string;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
}

export interface IPublicReportDocument extends Document {
  reportId: string;
  publicId: string;
  runId: string;
  projectId: string;
  tenantId: string;
  ownerUserId: string;
  publicationVersion: number;
  contentFingerprint?: string;
  title: string;
  projectName: string;
  projectKind: PublicReportProjectKind;
  verdict: PublicReportVerdict;
  externalScore: number;
  internalScore: number;
  gateBlocked: PublicReportSeverity;
  dimensionSnapshot: PublicReportDimensionRow[];
  findingHighlights: PublicReportFindingHighlight[];
  assessmentScope?: {
    mode: string;
    target?: string;
    note: string;
  };
  baselineNote?: string;
  isPublic: boolean;
  publishedAt: Date;
  publishedBy?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  sharedCount: number;
  immutable: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const HighlightSchema = new Schema<PublicReportFindingHighlight>(
  {
    severity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3'] },
    dimensionKey: { type: String, required: true },
    title: { type: String, required: true },
  },
  { _id: false }
);

const DimensionSchema = new Schema<PublicReportDimensionRow>(
  {
    dimensionKey: { type: String, required: true },
    label: { type: String, required: true },
    weight: { type: Number, required: true, min: 0 },
    rawScore: { type: Number, required: true, min: 0 },
    normalizedScore: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const ProjectGradeReportSchema = new Schema<IPublicReportDocument>(
  {
    reportId: { type: String, required: true, unique: true, immutable: true },
    publicId: { type: String, required: true, unique: true, immutable: true },
    runId: { type: String, required: true, immutable: true },
    projectId: { type: String, required: true, index: true, immutable: true },
    tenantId: { type: String, required: true, index: true, immutable: true },
    ownerUserId: { type: String, required: true, index: true, immutable: true },
    publicationVersion: { type: Number, required: true, min: 1, default: 1, immutable: true },
    contentFingerprint: {
      type: String,
      required: false,
      match: /^sha256:[a-f0-9]{64}$/,
      immutable: true,
    },
    title: { type: String, required: true, maxlength: 160, immutable: true },
    projectName: { type: String, required: true, maxlength: 120, immutable: true },
    projectKind: {
      type: String,
      required: true,
      enum: ['website', 'saas', 'ai_application'] as PublicReportProjectKind[],
      immutable: true,
    },
    verdict: {
      type: String,
      required: true,
      enum: ['S', 'A', 'B', 'C', 'D', 'F'] as PublicReportVerdict[],
      immutable: true,
    },
    externalScore: { type: Number, required: true, min: 0, max: 100, immutable: true },
    internalScore: { type: Number, required: true, min: 0, max: 1000, immutable: true },
    gateBlocked: {
      type: String,
      default: null,
      enum: ['P0', 'P1', 'P2', 'P3', null] as PublicReportSeverity[],
      immutable: true,
    },
    dimensionSnapshot: { type: [DimensionSchema], required: true, default: [], immutable: true },
    findingHighlights: { type: [HighlightSchema], required: true, default: [], immutable: true },
    assessmentScope: {
      type: {
        mode: String,
        target: String,
        note: String,
      },
      required: false,
      immutable: true,
    },
    baselineNote: { type: String, required: false, immutable: true },
    isPublic: { type: Boolean, required: true, default: true, index: true },
    publishedAt: { type: Date, required: true, index: true },
    publishedBy: { type: String, required: false },
    expiresAt: { type: Date, required: true, index: true },
    revokedAt: { type: Date, required: false },
    revokedBy: { type: String, required: false },
    revocationReason: { type: String, required: false, maxlength: 1000 },
    sharedCount: { type: Number, required: true, default: 0, min: 0 },
    immutable: { type: Boolean, required: true, default: true, immutable: true },
  },
  { timestamps: true, collection: 'project_grade_reports' }
);

ProjectGradeReportSchema.index({ projectId: 1, publishedAt: -1 });
ProjectGradeReportSchema.index({ projectId: 1, isPublic: 1, publishedAt: -1 });
ProjectGradeReportSchema.index({ tenantId: 1, publishedAt: -1 });
ProjectGradeReportSchema.index(
  { runId: 1 },
  { unique: true, partialFilterExpression: { immutable: true } }
);
ProjectGradeReportSchema.index(
  { contentFingerprint: 1 },
  { sparse: true }
);

export const ProjectGradeReport: Model<IPublicReportDocument> =
  (mongoose.models.ProjectGradeReport as Model<IPublicReportDocument> | undefined) ||
  mongoose.model<IPublicReportDocument>('ProjectGradeReport', ProjectGradeReportSchema);

export const PUBLIC_REPORT_TTL_DAYS = 365;
export const PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID = 'rpt_aibak_baseline_20260720';

export function normalizePublicId(raw: string): string {
  return raw.replace(/[^a-z0-9_-]/gi, '').slice(0, 64);
}
