"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAdmin = requireAdmin;
const User_1 = require("../models/User");
async function requireAdmin(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: '未授权，缺少登录信息' });
        return;
    }
    if (req.user.role !== 'admin') {
        res.status(403).json({ error: '需要管理员权限', yourRole: req.user.role });
        return;
    }
    // MFA 检查：管理员必须已启用 MFA
    try {
        const user = await User_1.User.findById(req.user.id).select('mfaEnabled').lean();
        if (user && !user.mfaEnabled) {
            res.status(403).json({
                error: '管理员必须启用多因素认证(MFA)才能执行此操作',
                code: 'MFA_REQUIRED',
                action: '请在 我的 → 安全设置 → 多因素认证 中启用 MFA',
            });
            return;
        }
    }
    catch {
        // DB 查询失败时保守拒绝
        res.status(503).json({ error: '无法验证管理员 MFA 状态，请稍后重试' });
        return;
    }
    next();
}
exports.default = requireAdmin;
//# sourceMappingURL=requireAdmin.js.map