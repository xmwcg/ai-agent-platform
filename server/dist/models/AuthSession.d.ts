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
import mongoose, { Document } from "mongoose";
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
export declare const AuthSession: mongoose.Model<IAuthSession, {}, {}, {}, mongoose.Document<unknown, {}, IAuthSession, {}, {}> & IAuthSession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
//# sourceMappingURL=AuthSession.d.ts.map