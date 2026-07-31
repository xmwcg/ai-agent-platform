import mongoose, { Schema, Document } from 'mongoose';

export type AuditAction =
  | 'team_created'
  | 'team_deleted'
  | 'member_joined'
  | 'member_left'
  | 'member_removed'
  | 'role_changed'
  | 'invite_generated'
  | 'invite_revoked';

export interface ITeamAuditLog extends Document {
  teamId: string;
  actorId: string;       // 执行操作的用户 ID
  action: AuditAction;
  targetId?: string;     // 被操作的目标（成员 ID 等）
  detail?: Record<string, unknown>; // 附加详情（如旧角色→新角色）
  createdAt: Date;
}

const TeamAuditLogSchema = new Schema<ITeamAuditLog>(
  {
    teamId: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: [
        'team_created',
        'team_deleted',
        'member_joined',
        'member_left',
        'member_removed',
        'role_changed',
        'invite_generated',
        'invite_revoked',
      ],
      required: true,
    },
    targetId: { type: String, default: null },
    detail: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** 复合索引：按团队+时间倒序查询 */
TeamAuditLogSchema.index({ teamId: 1, createdAt: -1 });

export const TeamAuditLog = mongoose.model<ITeamAuditLog>('TeamAuditLog', TeamAuditLogSchema);
