import mongoose, { Schema, Document, type Model } from 'mongoose';
import type { PlanId } from '../config/billing';
import type { ProjectGradeReportBranding } from '../services/project-grade-report-pdf.service';

export interface IProjectGradeReportDelivery extends Document {
  deliveryId: string;
  reportId: string;
  publicId: string;
  runId: string;
  projectId: string;
  tenantId: string;
  ownerUserId: string;
  requestedBy: string;
  format: 'pdf';
  planId: PlanId;
  branding: ProjectGradeReportBranding;
  contentFingerprint: string;
  documentFingerprint: string;
  fileName: string;
  byteLength: number;
  reportPublishedAt: Date;
  reportExpiresAt: Date;
  deliveredAt: Date;
  createdAt: Date;
}

const ProjectGradeReportDeliverySchema = new Schema<IProjectGradeReportDelivery>(
  {
    deliveryId: { type: String, required: true, unique: true, immutable: true },
    reportId: { type: String, required: true, immutable: true, index: true },
    publicId: { type: String, required: true, immutable: true, index: true },
    runId: { type: String, required: true, immutable: true },
    projectId: { type: String, required: true, immutable: true, index: true },
    tenantId: { type: String, required: true, immutable: true, index: true },
    ownerUserId: { type: String, required: true, immutable: true, index: true },
    requestedBy: { type: String, required: true, immutable: true, index: true },
    format: { type: String, required: true, enum: ['pdf'], immutable: true },
    planId: { type: String, required: true, enum: ['free', 'pro', 'max', 'team'], immutable: true },
    branding: { type: String, required: true, enum: ['aibak', 'white_label'], immutable: true },
    contentFingerprint: {
      type: String,
      required: true,
      match: /^sha256:[a-f0-9]{64}$/,
      immutable: true,
    },
    documentFingerprint: {
      type: String,
      required: true,
      match: /^sha256:[a-f0-9]{64}$/,
      immutable: true,
    },
    fileName: { type: String, required: true, maxlength: 220, immutable: true },
    byteLength: { type: Number, required: true, min: 1, immutable: true },
    reportPublishedAt: { type: Date, required: true, immutable: true },
    reportExpiresAt: { type: Date, required: true, immutable: true },
    deliveredAt: { type: Date, required: true, immutable: true, index: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
    collection: 'project_grade_report_deliveries',
    strict: 'throw',
  }
);

ProjectGradeReportDeliverySchema.index({ projectId: 1, deliveredAt: -1 });
ProjectGradeReportDeliverySchema.index({ reportId: 1, deliveredAt: -1 });
ProjectGradeReportDeliverySchema.index({ tenantId: 1, deliveredAt: -1 });
ProjectGradeReportDeliverySchema.index({ requestedBy: 1, deliveredAt: -1 });

export const ProjectGradeReportDelivery: Model<IProjectGradeReportDelivery> =
  (mongoose.models.ProjectGradeReportDelivery as Model<IProjectGradeReportDelivery> | undefined) ||
  mongoose.model<IProjectGradeReportDelivery>(
    'ProjectGradeReportDelivery',
    ProjectGradeReportDeliverySchema
  );
