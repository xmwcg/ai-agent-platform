"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const http_error_1 = require("../lib/http-error");
const xhs_copy_service_1 = require("../services/xhs-copy.service");
const VALID_ROLES = ['copywriter', 'architect', 'frontend', 'devops'];
const router = (0, express_1.Router)();
// 列出可用的专家角色（前端选择器数据源）
router.get("/", (_req, res) => {
    res.json({
        success: true,
        data: {
            capabilities: [
                { type: "generate", label: "生成小红书文案", path: "/api/xhs/generate", method: "POST", desc: "AI生成小红书文案" },
                { type: "agents", label: "风格代理", path: "/api/xhs/agents", desc: "查看可用写作风格" },
            ],
        },
    });
});
router.get('/agents', (_req, res) => {
    res.json({ success: true, data: (0, xhs_copy_service_1.listXhsAgents)() });
});
// 生成文案 / 调用专家角色
router.post('/generate', auth_1.optionalAuth, async (req, res) => {
    try {
        const { role, product, audience, style, keywords, count } = req.body || {};
        if (!role || !VALID_ROLES.includes(role)) {
            return res.status(400).json({ success: false, error: 'role 必填，且必须为 copywriter/architect/frontend/devops 之一' });
        }
        if (!product || typeof product !== 'string' || !product.trim()) {
            return res.status(400).json({ success: false, error: 'product（产品卖点/主题）为必填项' });
        }
        const result = await (0, xhs_copy_service_1.generateXhsCopy)({
            role,
            product: product.trim(),
            audience: typeof audience === 'string' ? audience.trim() : undefined,
            style: typeof style === 'string' ? style.trim() : undefined,
            keywords: typeof keywords === 'string' ? keywords.trim() : undefined,
            count: typeof count === 'number' ? count : undefined,
        });
        res.json({ success: true, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=xhs.js.map