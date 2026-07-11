import mongoose, { Schema, Document } from 'mongoose';

export type TeamRole = 'owner' | 'admin' | 'member' | 'viewer';

export interface ITeamMember {
  userId: string;
  role: TeamRole;
  joinedAt: Date;
}

export interface ITeam extends Document {
  _id: string;
  name: string;
  ownerId: string;
  plan: 'free' | 'pro' | 'max' | 'team';
  members: ITeamMember[];
  inviteCode: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const TeamMemberSchema = new Schema<ITeamMember>(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], default: 'member' },
    joinedAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const TeamSchema = new Schema<ITeam>(
  {
    name: { type: String, required: true, trim: true },
    ownerId: { type: String, required: true, index: true },
    plan: { type: String, enum: ['free', 'pro', 'max', 'team'], default: 'team' },
    members: { type: [TeamMemberSchema], default: [] },
    inviteCode: { type: String, default: null, index: true, sparse: true },
  },
  { timestamps: true }
);

export const Team = mongoose.model<ITeam>('Team', TeamSchema);
