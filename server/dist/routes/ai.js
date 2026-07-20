"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ai_models_1 = require("../config/ai-models");
const ai_agent_1 = require("../services/ai-agent");
const aibak_chat_1 = require("./aibak-chat");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const cost_control_service_1 = require("../services/cost-control.service");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const router = (0, express_1.Router)();
// 根路由：AI 服务端点索引
router.get('/', (_req, res) => {
    res.json({
        success: true,
        name: 'ai-service',
        endpoints: [
            'POST /api/ai/chat - AI 对话',
            'GET  /api/ai/models - 可用模型列表',
            'GET  /api/ai/test/:provider - 测试模型连接',
            'POST /api/ai/session - 创建对话会话',
            'GET  /api/ai/session/:sessionId - 获取会话详情',
        ]
    });
});
// 聊天接口（使用 Agent 服务；chat provider 不可用时回退 CloudBase 免费模型，保证可用）
router.post('/chat', auth_1.optionalAuth, (0, subscription_1.enforceCostValve)(), (0, subscription_1.enforceQuota)('ai_chat'), async (req, res) => {
    try {
        const { message, sessionId, config, model, provider } = req.body;
        if (!message) {
            return res.status(400).json({ error: 'Message is required' });
        }
        let currentSessionId = sessionId;
        const userId = req.user?.id || 'anonymous';
        // If no sessionId from client or session not found on server, create new server session
        if (!currentSessionId || !ai_agent_1.aiAgentService.getSession(currentSessionId)) {
            currentSessionId = await ai_agent_1.aiAgentService.createSession(userId);
        }
        // 发送消息（model/provider 允许前端实时切换模型，直连统一网关）
        let reply;
        let usage = undefined;
        try {
            const result = await ai_agent_1.aiAgentService.sendMessage(currentSessionId, message, config, {
                model: model || undefined,
                provider: provider || undefined,
            });
            reply = result.reply;
            usage = result.usage;
        }
        catch (gwErr) {
            // 兜底：外部 chat provider 未配置/不可用时，走 CloudBase 小程序成长计划免费模型
            logger_1.logger.warn('ai.chat', `Gateway failed, falling back to CloudBase free model: ${gwErr?.message}`);
            const cfMessages = [
                { role: 'system', content: config?.systemPrompt || 'You are a helpful AI assistant.' },
                { role: 'user', content: message },
            ];
            reply = await (0, aibak_chat_1.callCloudbaseChat)(cfMessages, 'hy3');
        }
        // 登录用户：累加用量 + 记录 AI 成本（驱动成本预警阀门）
        if (req.user?.id) {
            await (0, subscription_1.quotaIncrement)(req.user.id, 'ai_chat');
            const u = usage || {};
            const costFen = (0, cost_control_service_1.estimateCostFen)(Number(u.prompt_tokens) || 0, Number(u.completion_tokens) || 0);
            await (0, subscription_1.quotaCostRecord)(req.user.id, costFen);
        }
        res.json({
            success: true,
            sessionId: currentSessionId,
            message: reply,
            usage,
            provider: usage ? undefined : 'cloudbase-free'
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取可用模型
router.get('/models', (req, res) => {
    const models = ai_models_1.aiModelManager.getAvailableModels();
    const providers = ai_models_1.aiModelManager.getEnabledProviders().map(p => ({
        name: p.name,
        defaultModel: p.defaultModel
    }));
    res.json({
        success: true,
        models,
        providers,
        defaultProvider: ai_models_1.aiModelManager.getDefaultProvider()?.name
    });
});
// 测试 Provider 连接
router.get('/test/:provider', async (req, res) => {
    const { provider } = req.params;
    if (process.env.NODE_ENV === 'production' && provider === 'mock') {
        return res.status(400).json({
            success: false,
            error: '生产环境禁止使用 Mock AI Provider',
            code: 'AI_MOCK_DISABLED',
        });
    }
    try {
        const result = await ai_models_1.aiModelManager.testConnection(provider);
        res.json({
            success: true,
            provider,
            connected: result
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 创建新会话
router.post('/session', auth_1.optionalAuth, async (req, res) => {
    try {
        const userId = req.user?.id || req.body.userId || 'anonymous';
        const { provider } = req.body;
        const sessionId = await ai_agent_1.aiAgentService.createSession(userId, provider);
        res.json({
            success: true,
            sessionId
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取会话历史（需登录 + 仅本人）
router.get('/session/:sessionId', auth_1.requireAuth, (req, res) => {
    try {
        const { sessionId } = req.params;
        const history = ai_agent_1.aiAgentService.getSessionHistory(sessionId);
        const session = ai_agent_1.aiAgentService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        if (session.userId !== req.user.id) {
            return res.status(403).json({ error: '无权查看他人会话' });
        }
        res.json({
            success: true,
            sessionId,
            history,
            provider: session.provider,
            model: session.model
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 清空会话（需登录 + 仅本人）
router.delete('/session/:sessionId', auth_1.requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = ai_agent_1.aiAgentService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        if (session.userId !== req.user.id) {
            return res.status(403).json({ error: '无权操作他人会话' });
        }
        await ai_agent_1.aiAgentService.clearSession(sessionId);
        res.json({
            success: true,
            message: 'Session cleared'
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 删除会话（需登录 + 仅本人）
router.delete('/session/:sessionId/delete', auth_1.requireAuth, async (req, res) => {
    try {
        const { sessionId } = req.params;
        const session = ai_agent_1.aiAgentService.getSession(sessionId);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        if (session.userId !== req.user.id) {
            return res.status(403).json({ error: '无权操作他人会话' });
        }
        await ai_agent_1.aiAgentService.deleteSession(sessionId);
        res.json({
            success: true,
            message: 'Session deleted'
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=ai.js.map