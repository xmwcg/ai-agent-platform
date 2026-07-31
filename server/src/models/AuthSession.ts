/**
 * 认证会话模型
 *
 * 管理用户的活跃会话，支持：
 * - JWT 访问令牌（15分钟）+ 旋转刷新令牌（7天）
 * - 刷新令牌存入 HttpOnly + Secure + SameSite Cookie
 * - 单设备注销、全部设备注销、令牌撤销
 * - 密码变更后强制所有会话失效
 * - 设备指纹跟踪
 */
import mongoose, { Schema, Document } from "mongoose";

export type AuthSessionStatus = "active" | "revoked" | "expired";

export interface IAuthSession extends Document {
  userId: mongoose.Types.ObjectId;
  refreshToken: string;
  refreshTokenHash: string;
  accessTokenJti: string;
  deviceFingerprint: string;
  userAgent?: string;
  ipAddress?: string;
  status: AuthSessionStatus;
  expiresAt: Date;
  revokedAt?: Date;
  revokeReason?: "user_logout" | "all_logout" | "password_change" | "admin_revoke" | "token_theft";
  createdAt: Date;
  updatedAt: Date;
}

const authSessionSchema = new Schema<IAuthSession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    refreshToken: { type: String, required: true, select: false },
    refreshTokenHash: { type: String, required: true, unique: true, index: true },
    accessTokenJti: { type: String, required: true },
    deviceFingerprint: { type: String, required: true },
    userAgent: String,
    ipAddress: String,
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    revokeReason: { type: String, enum: ["user_logout", "all_logout", "password_change", "admin_revoke", "token_theft"] },
  },
  { timestamps: true }
);

authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ userId: 1, status: 1 });
authSessionSchema.index({ refreshTokenHash: 1, status: 1 });

export const AuthSession = mongoose.model<IAuthSession>("AuthSession", authSessionSchema);
