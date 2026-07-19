"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthSession = void 0;
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
const mongoose_1 = __importStar(require("mongoose"));
const authSessionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
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
}, { timestamps: true });
authSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
authSessionSchema.index({ userId: 1, status: 1 });
authSessionSchema.index({ refreshTokenHash: 1, status: 1 });
exports.AuthSession = mongoose_1.default.model("AuthSession", authSessionSchema);
//# sourceMappingURL=AuthSession.js.map