"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * MFA (多因素认证) 路由
 *
 * POST /api/auth/mfa/enroll   - 生成 MFA 密钥和二维码 URL（返回 secret + qrcode URL）
 * POST /api/auth/mfa/verify   - 首次验证并激活 MFA
 * POST /api/auth/mfa/challenge - 登录时输入 MFA 验证码完成二次认证
 * DELETE /api/auth/mfa        - 移除 MFA（需要密码确认）
 * GET /api/auth/mfa/status    - 查看 MFA 状态
 */
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const User_1 = require("../models/User");
const SecurityAuditLog_1 = require("../models/SecurityAuditLog");
const totp_1 = require("../utils/totp");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
// 生成 MFA 密钥
router.post("/mfa/enroll", auth_1.requireAuth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("+mfaSecret");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (user.mfaEnabled)
            return res.status(400).json({ error: "MFA 已启用", code: "MFA_ALREADY_ENABLED" });
        const secret = (0, totp_1.generateSecret)();
        user.mfaSecret = secret;
        user.mfaEnabled = false; // 待验证后才启用
        await user.save();
        const qrcodeUrl = (0, totp_1.generateOtpAuthUrl)(user.email, secret);
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "mfa_enroll",
            details: { step: "generated" },
            ipAddress: req.ip,
            outcome: "success",
        }).catch(() => { });
        res.json({
            success: true,
            secret,
            qrcodeUrl,
            message: "请使用 Google Authenticator 或同类应用扫描二维码，然后调用 /mfa/verify 完成激活",
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 验证并激活 MFA
router.post("/mfa/verify", auth_1.requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || String(code).length !== 6) {
            return res.status(400).json({ error: "请输入6位验证码" });
        }
        const user = await User_1.User.findById(req.user.id).select("+mfaSecret");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (!user.mfaSecret)
            return res.status(400).json({ error: "请先发起 MFA 注册" });
        const valid = (0, totp_1.verifyTotp)(user.mfaSecret, String(code));
        if (!valid) {
            SecurityAuditLog_1.SecurityAuditLog.create({
                userId: user._id,
                action: "mfa_verify",
                details: { step: "failed" },
                ipAddress: req.ip,
                outcome: "failure",
                failureReason: "invalid_code",
                severity: "medium",
            }).catch(() => { });
            return res.status(400).json({ error: "验证码无效，请确保设备时间准确后重试" });
        }
        user.mfaEnabled = true;
        user.mfaVerifiedAt = new Date();
        await user.save();
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "mfa_verify",
            details: { step: "activated" },
            ipAddress: req.ip,
            outcome: "success",
        }).catch(() => { });
        res.json({ success: true, message: "MFA 已成功启用" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 登录时 MFA 二次认证
router.post("/mfa/challenge", auth_1.requireAuth, async (req, res) => {
    try {
        const { code } = req.body;
        if (!code || String(code).length !== 6) {
            return res.status(400).json({ error: "请输入6位验证码" });
        }
        const user = await User_1.User.findById(req.user.id).select("+mfaSecret");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (!user.mfaSecret || !user.mfaEnabled) {
            return res.status(400).json({ error: "未启用 MFA" });
        }
        const valid = (0, totp_1.verifyTotp)(user.mfaSecret, String(code));
        if (!valid) {
            SecurityAuditLog_1.SecurityAuditLog.create({
                userId: user._id,
                action: "mfa_verify",
                outcome: "failure",
                failureReason: "invalid_code",
                severity: "medium",
                ipAddress: req.ip,
            }).catch(() => { });
            return res.status(400).json({ error: "MFA 验证失败" });
        }
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "mfa_verify",
            outcome: "success",
            details: { context: "login_challenge" },
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "MFA 验证通过" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 移除 MFA（需要密码确认）
router.delete("/mfa", auth_1.requireAuth, async (req, res) => {
    try {
        const { password } = req.body;
        if (!password)
            return res.status(400).json({ error: "需要密码确认" });
        const user = await User_1.User.findById(req.user.id).select("+mfaSecret +password");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        if (!user.mfaEnabled)
            return res.status(400).json({ error: "MFA 未启用" });
        const pwValid = await user.comparePassword(password);
        if (!pwValid)
            return res.status(403).json({ error: "密码错误" });
        user.mfaEnabled = false;
        user.mfaSecret = undefined;
        await user.save();
        SecurityAuditLog_1.SecurityAuditLog.create({
            userId: user._id,
            action: "mfa_remove",
            outcome: "success",
            severity: "medium",
            ipAddress: req.ip,
        }).catch(() => { });
        res.json({ success: true, message: "MFA 已停用" });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
// 查看 MFA 状态
router.get("/mfa/status", auth_1.requireAuth, async (req, res) => {
    try {
        const user = await User_1.User.findById(req.user.id).select("mfaEnabled mfaVerifiedAt");
        if (!user)
            return res.status(404).json({ error: "用户不存在" });
        res.json({
            success: true,
            data: {
                enabled: !!user.mfaEnabled,
                verifiedAt: user.mfaVerifiedAt || null,
            },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=auth-mfa.js.map