"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 邮箱验证路由
 *
 * POST /api/auth/verify-email/send    - 发送验证邮件
 * POST /api/auth/verify-email/confirm - 确认验证码
 * GET  /api/auth/verify-email/status  - 查询验证状态
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const rate_limit_1 = require("../middleware/rate-limit");
const User_1 = require("../models/User");
const SecurityAuditLog_1 = require("../models/SecurityAuditLog");
const database_1 = require("../config/database");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
const VERIFY_EXPIRE = 10 * 60; // 10 分钟
function generateVerifyCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}
async function setVerifyCode(email, code) {
    const key = "verify:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.setEx) {
        await database_1.redisClient.setEx(key, VERIFY_EXPIRE, code);
    }
    else {
        global.__emailCodes = global.__emailCodes || new Map();
        global.__emailCodes.set(key, { code, exp: Date.now() + VERIFY_EXPIRE * 1000 });
    }
}
async function getVerifyCode(email) {
    const key = "verify:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.get) {
        return await database_1.redisClient.get(key);
    }
    const entry = (global.__emailCodes || new Map()).get(key);
    if (entry && entry.exp > Date.now())
        return entry.code;
    return null;
}
async function deleteVerifyCode(email) {
    const key = "verify:email:" + email.toLowerCase().trim();
    if (database_1.redisClient && database_1.redisClient.del) {
        await database_1.redisClient.del(key);
    }
    (global.__emailCodes || new Map()).delete(key);
}
// 发送验证邮件
router.post("/verify-email/send", auth_1.requireAuth, rate_limit_1.authLimiter, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (user.emailVerified)
            return res.status(400).json({ error: "邮箱已验证", code: "ALREADY_VERIFIED" });
        const code = generateVerifyCode();
        await setVerifyCode(user.email, code);
        // 控制台输出验证码（生产环境应通过邮件服务发送）
        logger_1.logger.info("auth", "verify-email code: " + code + " for " + user.email);
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "email_verify",
            outcome: "success",
            details: { step: "code_sent" },
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({
            success: true,
            message: "验证码已发送至您的邮箱（开发环境请查看服务器日志）",
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 确认验证码
router.post("/verify-email/confirm", auth_1.requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || String(code).length !== 6) {
            return res.status(400).json({ error: "请输入6位验证码" });
        }
        const user = await User_1.User.findById(req.user.id);
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (user.emailVerified)
            return res.status(400).json({ error: "邮箱已验证" });
        const stored = await getVerifyCode(user.email);
        if (!stored || stored !== String(code)) {
            SecurityAuditLog_1.SecurityAuditLog.create({
                userId: user._id,
                action: "email_verify",
                outcome: "failure",
                failureReason: "invalid_code",
                ipAddress: req.ip,
            }).catch(() => { });
            return res.status(400).json({ error: "验证码无效或已过期" });
        }
        user.emailVerified = true;
        user.emailVerifiedAt = new Date();
        await user.save();
        await deleteVerifyCode(user.email);
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "email_verify",
            outcome: "success",
            details: { step: "confirmed" },
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "邮箱验证成功" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 查询验证状态
router.get("/verify-email/status", auth_1.requireAuth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("emailVerified emailVerifiedAt").lean();
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        res.json({
            success: true,
            data: {
                verified: !!user.emailVerified,
                verifiedAt: user.emailVerifiedAt || null,
            },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=auth-verify.js.map