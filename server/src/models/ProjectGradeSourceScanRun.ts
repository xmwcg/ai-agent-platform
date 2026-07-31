import mongoose, { Document, Schema, type Model } from 'mongoose';
import {
  normalizeProjectGradeSourceRelativePath,
  PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH,
} from '../project-grade/source-scan-safety';
import type {
  ProjectGradeSourceFileEvidence,
  ProjectGradeSourceFinding,
  ProjectGradeSourceProjectSignals,
  ProjectGradeSourceRoute,
  ProjectGradeSourceScanLimits,
  ProjectGradeSourceScanResult,
} from '../project-grade/source-scan.types';

export type ProjectGradeSourceScanRunStatus = 'succeeded' | 'failed';

export interface IProjectGradeSourceScanRun extends Document {
  scanId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  createdBy: string;
  status: ProjectGradeSourceScanRunStatus;
  rootKey: string;
  scanVersion?: string;
  snapshotHash?: string;
  result?: ProjectGradeSourceScanResult;
  errorCode?: string;
  errorSummary?: string;
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  createdAt: Date;
}

const strictEmbeddedOptions = {
  _id: false,
  id: false,
  strict: 'throw',
  versionKey: false,
} as const;

const integerValidator = {
  validator: Number.isInteger,
  message: 'Source scan numeric evidence must be an integer',
};

function fixedFalse(message: string) {
  return {
    type: Boolean,
    required: true,
    default: false as const,
    validate: {
      validator: (value: boolean) => value === false,
      message,
    },
  };
}

function safeRelativePath() {
  return {
    type: String,
    required: true,
    maxlength: PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH,
    set: (value: unknown) => normalizeProjectGradeSourceRelativePath(value) ?? value,
    validate: {
      validator: (value: unknown) => normalizeProjectGradeSourceRelativePath(value) !== null,
      message: 'Source scan evidence paths must remain safe relative paths',
    },
  };
}

const ProjectGradeSourceFileEvidenceSchema = new Schema<ProjectGradeSourceFileEvidence>(
  {
    path: safeRelativePath(),
    sizeBytes: { type: Number, required: true, min: 0, validate: integerValidator },
    sha256: { type: String, required: true, match: /^[a-f0-9]{64}$/i },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceFindingSchema = new Schema<ProjectGradeSourceFinding>(
  {
    ruleKey: { type: String, required: true, maxlength: 200 },
    severity: { type: String, required: true, enum: ['info', 'warning', 'high'] },
    filePath: safeRelativePath(),
    line: { type: Number, required: true, min: 1, validate: integerValidator },
    message: { type: String, required: true, maxlength: 1000 },
    fingerprint: { type: String, required: true, match: /^[a-f0-9]{32,64}$/i },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceRouteSchema = new Schema<ProjectGradeSourceRoute>(
  {
    framework: { type: String, required: true, enum: ['express'] },
    method: { type: String, required: true, maxlength: 20, match: /^[A-Z]+$/ },
    routePath: { type: String, required: true, maxlength: 300 },
    filePath: safeRelativePath(),
    line: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceProjectSignalsSchema = new Schema<ProjectGradeSourceProjectSignals>(
  {
    hasTests: { type: Boolean, required: true },
    hasDocker: { type: Boolean, required: true },
    hasCi: { type: Boolean, required: true },
    hasLicense: { type: Boolean, required: true },
    hasPackageManifest: { type: Boolean, required: true },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceSummarySchema = new Schema(
  {
    filesScanned: { type: Number, required: true, min: 0, validate: integerValidator },
    totalBytes: { type: Number, required: true, min: 0, validate: integerValidator },
    findings: { type: Number, required: true, min: 0, validate: integerValidator },
    routes: { type: Number, required: true, min: 0, validate: integerValidator },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceSkippedSchema = new Schema(
  {
    ignoredDirectories: { type: Number, required: true, min: 0, validate: integerValidator },
    unsupportedExtensions: { type: Number, required: true, min: 0, validate: integerValidator },
    binaryFiles: { type: Number, required: true, min: 0, validate: integerValidator },
    symbolicLinks: { type: Number, required: true, min: 0, validate: integerValidator },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceLimitsSchema = new Schema<ProjectGradeSourceScanLimits>(
  {
    maxFiles: { type: Number, required: true, min: 1, validate: integerValidator },
    maxFileBytes: { type: Number, required: true, min: 1, validate: integerValidator },
    maxTotalBytes: { type: Number, required: true, min: 1, validate: integerValidator },
    timeoutMs: { type: Number, required: true, min: 1, validate: integerValidator },
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceScanResultSchema = new Schema<ProjectGradeSourceScanResult>(
  {
    scanVersion: { type: String, required: true, maxlength: 100 },
    rootKey: {
      type: String,
      required: true,
      maxlength: 120,
      enum: ['aibak_server_repository'],
    },
    snapshotHash: {
      type: String,
      required: true,
      maxlength: 100,
      match: /^sha256:[a-f0-9]{64}$/i,
    },
    files: { type: [ProjectGradeSourceFileEvidenceSchema], required: true, default: undefined },
    findings: { type: [ProjectGradeSourceFindingSchema], required: true, default: undefined },
    routes: { type: [ProjectGradeSourceRouteSchema], required: true, default: undefined },
    projectSignals: { type: ProjectGradeSourceProjectSignalsSchema, required: true },
    summary: { type: ProjectGradeSourceSummarySchema, required: true },
    skipped: { type: ProjectGradeSourceSkippedSchema, required: true },
    limits: { type: ProjectGradeSourceLimitsSchema, required: true },
    evidenceScope: {
      type: String,
      required: true,
      enum: ['authorized_local_source_snapshot'],
    },
    productionAcceptance: fixedFalse('Source scan result cannot be used as production acceptance'),
    externalScanningEnabled: fixedFalse('External source scanning must remain disabled'),
    sourceContentPersisted: fixedFalse('Source content persistence must remain disabled'),
    executedSourceCode: fixedFalse('Source code execution must remain disabled'),
    installedDependencies: fixedFalse('Dependency installation must remain disabled'),
    networkAccessed: fixedFalse('Source scan network access must remain disabled'),
  },
  strictEmbeddedOptions
);

const ProjectGradeSourceScanRunSchema = new Schema<IProjectGradeSourceScanRun>(
  {
    scanId: { type: String, required: true, unique: true, immutable: true },
    projectId: { type: String, required: true, immutable: true, index: true },
    ownerId: { type: String, required: true, immutable: true, index: true },
    teamId: { type: String, immutable: true, index: true },
    createdBy: { type: String, required: true, immutable: true },
    status: {
      type: String,
      required: true,
      immutable: true,
      enum: ['succeeded', 'failed'],
    },
    rootKey: {
      type: String,
      required: true,
      immutable: true,
      maxlength: 120,
      enum: ['aibak_server_repository'],
    },
    scanVersion: {
      type: String,
      immutable: true,
      maxlength: 100,
      required: function (this: IProjectGradeSourceScanRun) {
        return this.status === 'succeeded';
      },
    },
    snapshotHash: {
      type: String,
      immutable: true,
      maxlength: 100,
      match: /^sha256:[a-f0-9]{64}$/i,
      required: function (this: IProjectGradeSourceScanRun) {
        return this.status === 'succeeded';
      },
    },
    result: {
      type: ProjectGradeSourceScanResultSchema,
      immutable: true,
      required: function (this: IProjectGradeSourceScanRun) {
        return this.status === 'succeeded';
      },
      validate: {
        validator: function (
          this: IProjectGradeSourceScanRun,
          value: ProjectGradeSourceScanResult | undefined
        ) {
          return this.status !== 'failed' || value === undefined || value === null;
        },
        message: 'Failed source scan history must not persist a result payload',
      },
    },
    errorCode: {
      type: String,
      immutable: true,
      maxlength: 200,
      required: function (this: IProjectGradeSourceScanRun) {
        return this.status === 'failed';
      },
    },
    errorSummary: {
      type: String,
      immutable: true,
      maxlength: 1000,
      required: function (this: IProjectGradeSourceScanRun) {
        return this.status === 'failed';
      },
    },
    evidenceScope: {
      type: String,
      required: true,
      immutable: true,
      enum: ['authorized_local_source_snapshot'],
      default: 'authorized_local_source_snapshot',
    },
    productionAcceptance: {
      type: Boolean,
      required: true,
      immutable: true,
      validate: {
        validator: (value: boolean) => value === false,
        message: 'Source scan history cannot be used as production acceptance',
      },
      default: false as const,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

ProjectGradeSourceScanRunSchema.index({ projectId: 1, createdAt: -1 });
ProjectGradeSourceScanRunSchema.index({ ownerId: 1, createdAt: -1 });
ProjectGradeSourceScanRunSchema.index({ teamId: 1, createdAt: -1 });

export const ProjectGradeSourceScanRun: Model<IProjectGradeSourceScanRun> =
  (mongoose.models.ProjectGradeSourceScanRun as Model<IProjectGradeSourceScanRun> | undefined) ||
  mongoose.model<IProjectGradeSourceScanRun>(
    'ProjectGradeSourceScanRun',
    ProjectGradeSourceScanRunSchema
  );
