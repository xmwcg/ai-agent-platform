import mongoose, { Document } from 'mongoose';
import type { SkillPackageKind } from '../skills/package-types';
export interface IUserSkill extends Document {
    skillId: string;
    owner: string;
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
export declare const UserSkill: mongoose.Model<IUserSkill, {}, {}, {}, mongoose.Document<unknown, {}, IUserSkill, {}, {}> & IUserSkill & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=UserSkill.d.ts.map