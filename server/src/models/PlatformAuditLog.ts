import mongoose, { Schema, Document } from 'mongoose';

/** 平台级审计动作（管理员对用户执行的敏感操作） */
export type PlatformAuditAction =
  | 'user_role_changed'
  | 'user_banned'
  | 'user_unbanned';

export interface IPlatformAuditLog extends Document {
  actorId: string; // 执行操作的管理员 ID
  action: PlatformAuditAction;
  targetId?: string; // 被操作的用户 ID
  detail?: Record<string, unknown>; // 附加详情（如 oldRole→newRole）
  createdAt: Date;
}

const PlatformAuditLogSchema = new Schema<IPlatformAuditLog>(
  {
    actorId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['user_role_changed', 'user_banned', 'user_unbanned'],
      required: true,
    },
    targetId: { type: String, default: null, index: true },
    detail: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** 复合索引：按动作 + 时间倒序查询 */
PlatformAuditLogSchema.index({ action: 1, createdAt: -1 });

export const PlatformAuditLog = mongoose.model<IPlatformAuditLog>(
  'PlatformAuditLog',
  PlatformAuditLogSchema
);
