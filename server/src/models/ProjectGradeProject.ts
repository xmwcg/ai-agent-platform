import { randomUUID } from 'crypto';
import mongoose, { Schema, Document, type Model } from 'mongoose';
import {
  INITIAL_PROJECT_TYPES,
  type ProjectGradeProjectType,
} from '../project-grade/config';

export type ProjectGradeProjectStatus = 'active' | 'archived';

export interface IProjectGradeProject extends Document {
  projectId: string;
  ownerId: string;
  teamId?: string;
  name: string;
  description?: string;
  projectType: ProjectGradeProjectType;
  projectUrl?: string;
  status: ProjectGradeProjectStatus;
  createdBy: string;
  updatedBy: string;
  latestRunId?: string;
  latestScore?: number;
  latestGrade?: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  latestAssessedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const ProjectGradeProjectSchema = new Schema<IProjectGradeProject>(
  {
    projectId: { type: String, required: true, unique: true, index: true, default: randomUUID },
    ownerId: { type: String, required: true, index: true, immutable: true },
    teamId: { type: String, index: true, immutable: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 1000 },
    projectType: {
      type: String,
      required: true,
      enum: INITIAL_PROJECT_TYPES,
      index: true,
    },
    projectUrl: { type: String, trim: true },
    status: { type: String, required: true, enum: ['active', 'archived'], default: 'active', index: true },
    createdBy: { type: String, required: true, immutable: true },
    updatedBy: { type: String, required: true },
    latestRunId: { type: String },
    latestScore: { type: Number, min: 0, max: 100 },
    latestGrade: { type: String, enum: ['S', 'A', 'B', 'C', 'D', 'F'] },
    latestAssessedAt: { type: Date },
  },
  { timestamps: true }
);

ProjectGradeProjectSchema.index({ ownerId: 1, status: 1, updatedAt: -1 });
ProjectGradeProjectSchema.index({ teamId: 1, status: 1, updatedAt: -1 });

export const ProjectGradeProject: Model<IProjectGradeProject> =
  (mongoose.models.ProjectGradeProject as Model<IProjectGradeProject> | undefined) ||
  mongoose.model<IProjectGradeProject>('ProjectGradeProject', ProjectGradeProjectSchema);
