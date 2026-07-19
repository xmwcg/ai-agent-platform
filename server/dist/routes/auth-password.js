"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 密码重置路由
 *
 * POST /api/auth/forgot-password    - 发送重置验证码到邮箱
 * POST /api/auth/reset-password     - 使用验证码重置密码
 * PUT  /api/auth/change-password    - 登录后修改密码（强制撤销所有会话）
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const User_1 = require("../models/User");
const AuthSession_1 = require("../models/AuthSession");
const SecurityAuditLog_1 = require("../models/SecurityAuditLog");
const database_1 = require("../config/database");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const validation_1 = require("../lib/validation");
const router = (0, express_1.Router)();
const RESET_EXPIRE = 15 * 60; // 15 分钟
function generateResetCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function setResetCode(email, code) {
    const key = "reset:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.setEx) {
        await database_1.redisClient.setEx(key, RESET_EXPIRE, code);
    }
    else {
        global.__resetCodes = global.__resetCodes || new Map();
        global.__resetCodes.set(key, { code, exp: Date.now() + RESET_EXPIRE * 1000 });
    }
}
async function getResetCode(email) {
    const key = "reset:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.get) {
        return await database_1.redisClient.get(key);
    }
    const entry = (global.__resetCodes || new Map()).get(key);
    if (entry && entry.exp > Date.now())
        return entry.code;
    return null;
}
async function deleteResetCode(email) {
    const key = "reset:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.del) {
        await database_1.redisClient.del(key);
    }
    (global.__resetCodes || new Map()).delete(key);
}
// 忘记密码 → 发送重置验证码
router.post("/forgot-password", rate_limit_1.authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email)
            return res.status(400).json({ error: "请输入邮箱地址" });
        const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user) {
            // 不泄露用户是否存在
            return res.json({ success: true, message: "如果该邮箱已注册，您将收到重置验证码" });
        }
        const code = generateResetCode();
        await setResetCode(user.email, code);
        logger_1.logger.info("auth", "reset-password code: " + code + " for " + user.email);
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "password_reset",
            outcome: "success",
            details: { step: "code_sent" },
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "如果该邮箱已注册，您将收到重置验证码" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 重置密码
router.post("/reset-password", rate_limit_1.authLimiter, async (req, res) => {
    try {
        const { email, code, newPassword } = req.body;
        if (!email || !code || !newPassword) {
            return res.status(400).json({ error: "请提供邮箱、验证码和新密码" });
        }
        if (newPassword.length < 10) {
            return res.status(400).json({ error: "密码长度至少10位" });
        }
        const user = await User_1.User.findOne({ email: email.toLowerCase().trim() });
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        const stored = await getResetCode(user.email);
        if (!stored || stored !== String(code)) {
            SecurityAuditLog_1.SecurityAuditLog.create({
                userId: user._id,
                action: "password_reset",
                outcome: "failure",
                failureReason: "invalid_code",
                ipAddress: req.ip,
                severity: "medium",
            }).catch(() => { });
            return res.status(400).json({ error: "验证码无效或已过期" });
        }
        user.password = newPassword;
        await user.save();
        await deleteResetCode(user.email);
        // 强制撤销所有会话
        await AuthSession_1.AuthSession.updateMany({ userId: user._id, status: "active" }, { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" });
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "password_reset",
            outcome: "success",
            details: { step: "completed" },
            severity: "high",
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "密码已重置，所有设备已登出，请重新登录" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 修改密码（登录后）— 强制撤销所有会话
const changePasswordSchema = {
    currentPassword: { required: true, type: "string", minLength: 1 },
    newPassword: { required: true, type: "string", minLength: 10, maxLength: 64 },
};
router.put("/change-password", auth_1.requireAuth, (0, validation_1.validate)(changePasswordSchema), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;
        const user = await User_1.User.findById(req.user.id).select("+password");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        const valid = await user.comparePassword(currentPassword);
        if (!valid) {
            SecurityAuditLog_1.SecurityAuditLog.create({
                userId: user._id,
                action: "password_change",
                outcome: "failure",
                failureReason: "wrong_current_password",
                severity: "medium",
                ipAddress: req.ip,
            }).catch(() => { });
            return res.status(403).json({ error: "当前密码错误" });
        }
        user.password = newPassword;
        await user.save();
        // 强制撤销所有其他会话（保留当前会话如果sessionId匹配）
        const currentSessionId = req.user?.sessionId;
        if (currentSessionId) {
            await AuthSession_1.AuthSession.updateMany({ userId: user._id, status: "active", _id: { $ne: currentSessionId } }, { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" });
        }
        else {
            await AuthSession_1.AuthSession.updateMany({ userId: user._id, status: "active" }, { status: "revoked", revokedAt: new Date(), revokeReason: "password_change" });
        }
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "password_change",
            outcome: "success",
            severity: "medium",
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "密码已修改，其他设备已自动登出" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=auth-password.js.map