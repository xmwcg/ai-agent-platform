import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  INITIAL_PROJECT_TYPES,
  PROJECT_GRADE_DIMENSIONS,
  type FindingSeverity,
  type ProjectGradeDimensionKey,
  type ProjectGradeProjectType,
} from '../project-grade/config';

export interface IProjectGradeRule extends Document {
  key: string;
  rulePackKey: string;
  rulePackVersion: string;
  dimensionKey: ProjectGradeDimensionKey;
  dimensionLabel: string;
  title: string;
  description: string;
  weight: number;
  defaultSeverity: FindingSeverity;
  projectTypes: ProjectGradeProjectType[];
  evidenceGuidance: string[];
  remediationGuidance: string[];
  enabled: boolean;
}

const ProjectGradeRuleSchema = new Schema<IProjectGradeRule>(
  {
    key: { type: String, required: true, trim: true },
    rulePackKey: { type: String, required: true, index: true },
    rulePackVersion: { type: String, required: true },
    dimensionKey: {
      type: String,
      required: true,
      enum: PROJECT_GRADE_DIMENSIONS.map((dimension) => dimension.key),
      index: true,
    },
    dimensionLabel: { type: String, required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    weight: { type: Number, required: true, min: 0, max: 1000 },
    defaultSeverity: { type: String, required: true, enum: ['P0', 'P1', 'P2', 'P3'] },
    projectTypes: {
      type: [String],
      required: true,
      default: INITIAL_PROJECT_TYPES,
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
    },
    evidenceGuidance: { type: [String], required: true, default: [] },
    remediationGuidance: { type: [String], required: true, default: [] },
    enabled: { type: Boolean, required: true, default: true, index: true },
  },
  { timestamps: true }
);

ProjectGradeRuleSchema.index(
  { rulePackKey: 1, rulePackVersion: 1, key: 1 },
  { unique: true }
);
ProjectGradeRuleSchema.index({ rulePackKey: 1, rulePackVersion: 1, dimensionKey: 1 });

export const ProjectGradeRule: Model<IProjectGradeRule> =
  (mongoose.models.ProjectGradeRule as Model<IProjectGradeRule> | undefined) ||
  mongoose.model<IProjectGradeRule>('ProjectGradeRule', ProjectGradeRuleSchema);

