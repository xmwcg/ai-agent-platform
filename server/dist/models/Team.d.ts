import mongoose, { Document } from 'mongoose';
export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';
export interface ITeamMember {
    userId: string;
    role: TeamRole;
    joinedAt: Date;
}
export interface ITeam extends Document {
    name: string;
    ownerId: string;
    plan: 'free' | 'pro' | 'max' | 'team';
    members: ITeamMember[];
    inviteCode: string | null;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Team: mongoose.Model<ITeam, {}, {}, {}, mongoose.Document<unknown, {}, ITeam, {}, {}> & ITeam & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=Team.d.ts.map