import mongoose, { Document, Schema } from 'mongoose';

export type ProjectGradeAuditAction =
  | 'finding_workflow_update'
  | 'remediation_create'
  | 'remediation_update'
  | 'projection_rebuild'
  | 'projection_recovery'
  | 'url_scan_execute'
  | 'source_scan_execute'
  | 'source_evidence_adopt'
  | 'source_evidence_evaluate'
  | 'report_publish'
  | 'report_revoke'
  | 'report_download';

export type ProjectGradeAuditOutcome = 'attempted' | 'succeeded' | 'failed';
export type ProjectGradeAuditTargetType =
  | 'finding'
  | 'remediation'
  | 'evaluation_run'
  | 'url_scan'
  | 'source_scan'
  | 'evidence_adoption'
  | 'report';

export interface IProjectGradeAuditLog extends Document {
  auditId: string;
  operationId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  actorId: string;
  action: ProjectGradeAuditAction;
  outcome: ProjectGradeAuditOutcome;
  targetType: ProjectGradeAuditTargetType;
  targetId: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  errorCode?: string;
  errorSummary?: string;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const ProjectGradeAuditLogSchema = new Schema<IProjectGradeAuditLog>(
  {
    auditId: { type: String, required: true, unique: true, immutable: true },
    operationId: { type: String, required: true, immutable: true, index: true },
    projectId: { type: String, required: true, immutable: true, index: true },
    ownerId: { type: String, required: true, immutable: true, index: true },
    teamId: { type: String, immutable: true, index: true },
    actorId: { type: String, required: true, immutable: true, index: true },
    action: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        'finding_workflow_update',
        'remediation_create',
        'remediation_update',
        'projection_rebuild',
        'projection_recovery',
        'url_scan_execute',
        'source_scan_execute',
        'source_evidence_adopt',
        'source_evidence_evaluate',
        'report_publish',
        'report_revoke',
        'report_download',
      ],
    },
    outcome: {
      type: String,
      required: true,
      immutable: true,
      enum: ['attempted', 'succeeded', 'failed'],
    },
    targetType: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        'finding',
        'remediation',
        'evaluation_run',
        'url_scan',
        'source_scan',
        'evidence_adoption',
        'report',
      ],
    },
    targetId: { type: String, required: true, immutable: true, index: true },
    fromStatus: { type: String, immutable: true },
    toStatus: { type: String, immutable: true },
    reason: { type: String, immutable: true, maxlength: 2000 },
    errorCode: { type: String, immutable: true },
    errorSummary: { type: String, immutable: true, maxlength: 1000 },
    metadata: { type: Schema.Types.Mixed, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

ProjectGradeAuditLogSchema.index({ projectId: 1, createdAt: -1 });
ProjectGradeAuditLogSchema.index({ operationId: 1, createdAt: 1 });
ProjectGradeAuditLogSchema.index({ projectId: 1, action: 1, createdAt: -1 });
ProjectGradeAuditLogSchema.index({ projectId: 1, ownerId: 1, teamId: 1, createdAt: -1 });

export const ProjectGradeAuditLog = mongoose.model<IProjectGradeAuditLog>(
  'ProjectGradeAuditLog',
  ProjectGradeAuditLogSchema
);
