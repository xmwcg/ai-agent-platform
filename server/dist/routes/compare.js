"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const compare_service_1 = require("../services/compare.service");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'compare' }); });
// 获取可对比项列表
router.get('/items', (req, res) => {
    const type = req.query.type;
    const items = type ? compare_service_1.compareService.getPresetsByType(type) : compare_service_1.compareService.getPresets();
    res.json({ success: true, data: items });
});
// 生成对比（可选登录：登录用户消耗 ai_chat 配额，匿名放行）
router.post('/generate', auth_1.optionalAuth, (0, subscription_1.enforceQuota)('ai_chat'), async (req, res) => {
    try {
        const body = req.body;
        if (!body.items || body.items.length < 2) {
            return res.status(400).json({ success: false, error: 'At least 2 items required' });
        }
        const result = await compare_service_1.compareService.generateCompare(body);
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'ai_chat');
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=compare.js.map