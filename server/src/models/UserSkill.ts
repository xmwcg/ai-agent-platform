import mongoose, { Schema, Document } from 'mongoose';
import type { SkillPackageKind } from '../skills/package-types';

export interface IUserSkill extends Document {
  skillId: string; // 唯一标识（清洗后）
  owner: string; // 上传者 userId
  name: string;
  description: string;
  division: string;
  color: string;
  coreMission: string;
  criticalRules: string[];
  successMetrics: string[];
  minRole: string;
  requireAuth: boolean;
  marketable: boolean;
  tags: string[];
  isPublic: boolean;
  kind: SkillPackageKind;
  prompt?: {
    system: string;
    userTemplate?: string;
    maxTokens?: number;
    temperature?: number;
  };
  mcp?: {
    serverId: string;
    tool: string;
    argsTemplate?: Record<string, any>;
  };
  workflow?: {
    workflowId: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

const userSkillSchema = new Schema<IUserSkill>(
  {
    skillId: { type: String, required: true, index: true },
    owner: { type: String, required: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    division: { type: String, default: 'productivity' },
    color: { type: String, default: '#6366f1' },
    coreMission: { type: String, default: '' },
    criticalRules: { type: [String], default: [] },
    successMetrics: { type: [String], default: [] },
    minRole: { type: String, default: 'none' },
    requireAuth: { type: Boolean, default: true },
    marketable: { type: Boolean, default: false },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false },
    kind: { type: String, enum: ['prompt', 'mcp', 'workflow'], default: 'prompt' },
    prompt: { type: Schema.Types.Mixed },
    mcp: { type: Schema.Types.Mixed },
    workflow: { type: Schema.Types.Mixed },
  },
  { timestamps: true }
);

userSkillSchema.index({ skillId: 1, owner: 1 }, { unique: true });

export const UserSkill = mongoose.model<IUserSkill>('UserSkill', userSkillSchema);
