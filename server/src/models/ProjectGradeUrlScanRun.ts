import mongoose, { Document, Schema, type Model } from 'mongoose';
import type { ProjectGradeUrlQuickScanResult } from '../services/project-grade-url-scan.service';

export type ProjectGradeUrlScanRunStatus = 'succeeded' | 'failed';

export interface IProjectGradeUrlScanRun extends Document {
  scanId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  createdBy: string;
  status: ProjectGradeUrlScanRunStatus;
  requestedUrl: string;
  finalUrl?: string;
  scanVersion?: string;
  statusCode?: number;
  durationMs?: number;
  result?: ProjectGradeUrlQuickScanResult;
  errorCode?: string;
  errorSummary?: string;
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  createdAt: Date;
}

const ProjectGradeUrlScanRunSchema = new Schema<IProjectGradeUrlScanRun>(
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
    requestedUrl: { type: String, required: true, immutable: true, maxlength: 2048 },
    finalUrl: { type: String, immutable: true, maxlength: 2048 },
    scanVersion: { type: String, immutable: true, maxlength: 100 },
    statusCode: { type: Number, immutable: true, min: 100, max: 599 },
    durationMs: { type: Number, immutable: true, min: 0 },
    result: { type: Schema.Types.Mixed, immutable: true },
    errorCode: { type: String, immutable: true, maxlength: 200 },
    errorSummary: { type: String, immutable: true, maxlength: 1000 },
    evidenceScope: {
      type: String,
      required: true,
      immutable: true,
      enum: ['single_server_http_observation'],
      default: 'single_server_http_observation',
    },
    productionAcceptance: {
      type: Boolean,
      required: true,
      immutable: true,
      validate: {
        validator: (value: boolean) => value === false,
        message: 'URL scan history cannot be used as production acceptance',
      },
      default: false,
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

ProjectGradeUrlScanRunSchema.index({ projectId: 1, createdAt: -1 });
ProjectGradeUrlScanRunSchema.index({ ownerId: 1, createdAt: -1 });
ProjectGradeUrlScanRunSchema.index({ teamId: 1, createdAt: -1 });

export const ProjectGradeUrlScanRun: Model<IProjectGradeUrlScanRun> =
  (mongoose.models.ProjectGradeUrlScanRun as Model<IProjectGradeUrlScanRun> | undefined) ||
  mongoose.model<IProjectGradeUrlScanRun>('ProjectGradeUrlScanRun', ProjectGradeUrlScanRunSchema);