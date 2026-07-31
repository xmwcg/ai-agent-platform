import mongoose, { Schema, Document } from 'mongoose';

/** 针对敏感密钥（如第三方 ModelConfig.apiKey）的操作审计类型 */
export type SecretAuditAction =
  | 'secret_created'   // 新增含 apiKey 的配置
  | 'secret_updated'   // 更新/替换了 apiKey
  | 'secret_test'      // 使用 apiKey 发起了测试连接
  | 'secret_deleted';  // 删除了含 apiKey 的配置

export interface ISecretAuditLog extends Document {
  secretType: string;  // 固定 'model_config_api_key'，便于未来扩展其它密钥类型
  ownerId: string;     // 配置所属用户（createdBy）
  actorId: string;     // 实际执行操作的人（绝大多数 = ownerId）
  targetId: string;    // 被操作对象 ID（ModelConfig._id）
  action: SecretAuditAction;
  ip: string;          // 操作者来源 IP
  userAgent?: string;
  result: 'success' | 'failure';
  alert: boolean;      // 是否触发异常告警（如高频测试连接）
  detail?: Record<string, unknown>;
  createdAt: Date;
}

const SecretAuditLogSchema = new Schema<ISecretAuditLog>(
  {
    secretType: { type: String, default: 'model_config_api_key', index: true },
    ownerId: { type: String, required: true, index: true },
    actorId: { type: String, required: true, index: true },
    targetId: { type: String, required: true, index: true },
    action: {
      type: String,
      enum: ['secret_created', 'secret_updated', 'secret_test', 'secret_deleted'],
      required: true,
    },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: null },
    result: { type: String, enum: ['success', 'failure'], default: 'success' },
    alert: { type: Boolean, default: false },
    detail: { type: Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

/** 复合索引：按目标+时间倒序查询某个配置的全部密钥操作 */
SecretAuditLogSchema.index({ targetId: 1, createdAt: -1 });

export const SecretAuditLog = mongoose.model<ISecretAuditLog>('SecretAuditLog', SecretAuditLogSchema);
