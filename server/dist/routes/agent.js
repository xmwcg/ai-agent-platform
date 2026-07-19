"use strict";
/**
 * 自主 Agent 路由
 * 对标 AutoGPT：接收高层目标 → 自动拆解 → 多步执行 → 汇总结果
 */
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const autonomous_agent_service_1 = require("../services/autonomous-agent.service");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
/**
 * POST /api/agent/goal
 * 提交高层目标，Agent 自主完成
 */
// ─── 根路由：返回Agent能力入口 ───
router.get("/", (_req, res) => {
    res.json({
        success: true,
        data: {
            capabilities: [
                { type: "goal", label: "设置目标", path: "/api/agent/goal", method: "POST", desc: "为Agent设置执行目标" },
                { type: "memory", label: "Agent记忆", path: "/api/agent/memory", desc: "查看Agent的对话记忆" },
            ],
        },
    });
});
router.post('/goal', auth_1.requireAuth, (0, subscription_1.enforceQuota)('ai_chat'), async (req, res) => {
    try {
        const { goal, context, constraints, maxSteps, maxRetries } = req.body;
        if (!goal) {
            return res.status(400).json({ error: 'Goal is required' });
        }
        const result = await autonomous_agent_service_1.autonomousAgent.executeGoal({
            goal,
            context,
            constraints: constraints || [],
            userId: req.user.id,
            maxSteps: maxSteps || 5,
            maxRetries: maxRetries || 2,
        });
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'ai_chat');
        res.json({ success: result.success, data: result });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/**
 * GET /api/agent/memory
 * 获取当前用户的 Agent 记忆
 */
router.get('/memory', auth_1.requireAuth, async (req, res) => {
    const memory = autonomous_agent_service_1.autonomousAgent.getUserMemory(req.user.id);
    res.json({ success: true, data: memory || { preferences: {}, recentTopics: [] } });
});
/**
 * DELETE /api/agent/memory
 * 清除当前用户的 Agent 记忆
 */
router.delete('/memory', auth_1.requireAuth, async (req, res) => {
    autonomous_agent_service_1.autonomousAgent.clearUserMemory(req.user.id);
    res.json({ success: true, message: 'Memory cleared' });
});
exports.default = router;
//# sourceMappingURL=agent.js.map