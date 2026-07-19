import mongoose, { Document } from 'mongoose';
export type AuditAction = 'team_created' | 'team_deleted' | 'member_joined' | 'member_left' | 'member_removed' | 'role_changed' | 'invite_generated' | 'invite_revoked';
export interface ITeamAuditLog extends Document {
    teamId: string;
    actorId: string;
    action: AuditAction;
    targetId?: string;
    detail?: Record<string, unknown>;
    createdAt: Date;
}
export declare const TeamAuditLog: mongoose.Model<ITeamAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, ITeamAuditLog, {}, {}> & ITeamAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=TeamAuditLog.d.ts.map