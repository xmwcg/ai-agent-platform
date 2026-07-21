"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.aiAgentService = void 0;
const ai_models_1 = require("../config/ai-models");
const database_1 = require("../config/database");
const ai_gateway_service_1 = require("../gateway/ai-gateway.service");
const logger_1 = require("../lib/logger");
const http_error_1 = require("../lib/http-error");
// AI Agent 服务类
class AIAgentService {
    constructor() {
        this.sessions = new Map();
        // 从 Redis 恢复会话（可选）
        this.loadSessionsFromRedis();
    }
    // 创建新会话
    async createSession(userId, provider) {
        if (process.env.NODE_ENV === 'production' && provider === 'mock') {
            throw new http_error_1.AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
        }
        const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const defaultProvider = provider || ai_models_1.aiModelManager.getDefaultProvider()?.name.toLowerCase() || 'openai';
        const session = {
            sessionId,
            userId,
            messages: [],
            provider: defaultProvider,
            model: ai_models_1.aiModelManager.getProvider(defaultProvider)?.defaultModel || 'gpt-4o',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };
        this.sessions.set(sessionId, session);
        await this.saveSessionToRedis(session);
        return sessionId;
    }
    // 发送消息（统一走 AI 网关 route，屏蔽厂商差异与 fallback）
    async sendMessage(sessionId, message, config, modelOverride) {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`Session ${sessionId} not found`);
        }
        // 添加用户消息
        const userMessage = {
            role: 'user',
            content: message,
            timestamp: Date.now()
        };
        session.messages.push(userMessage);
        // 构建消息历史
        const messages = this.buildMessages(session, config);
        try {
            // 统一经 AI 网关路由（前缀寻址 + priority fallback + TC3 签名）
            // modelOverride 允许前端实时切换模型（如智谱/通义/豆包/自定义 mc_<id>）
            const routeModel = modelOverride?.model
                ? modelOverride.model
                : `${session.provider}/${session.model}`;
            const result = await (0, ai_gateway_service_1.route)({
                model: routeModel,
                provider: modelOverride?.provider,
                messages,
                temperature: config?.temperature || 0.7,
                maxTokens: config?.maxTokens || 2000,
                publicOnly: true,
            });
            const reply = result.reply;
            const usage = result.usage;
            // 添加助手回复
            const assistantMessage = {
                role: 'assistant',
                content: reply,
                timestamp: Date.now()
            };
            session.messages.push(assistantMessage);
            // 更新会话
            session.updatedAt = Date.now();
            await this.saveSessionToRedis(session);
            return { reply, usage };
        }
        catch (error) {
            logger_1.logger.error('ai-agent', 'sendMessage error', error?.message ?? error);
            throw error;
        }
    }
    // 构建消息列表
    buildMessages(session, config) {
        const messages = [];
        // 系统提示词
        if (config?.systemPrompt) {
            messages.push({
                role: 'system',
                content: config.systemPrompt
            });
        }
        else {
            messages.push({
                role: 'system',
                content: 'You are a helpful AI assistant specialized in knowledge management and learning.'
            });
        }
        // 添加历史消息（限制最近 20 条）
        const recentMessages = session.messages.slice(-20);
        messages.push(...recentMessages.map(msg => ({
            role: msg.role,
            content: msg.content
        })));
        return messages;
    }
    // 获取会话
    getSession(sessionId) {
        return this.sessions.get(sessionId);
    }
    // 获取会话历史
    getSessionHistory(sessionId) {
        const session = this.sessions.get(sessionId);
        return session?.messages || [];
    }
    // 清空会话历史
    async clearSession(sessionId) {
        const session = this.sessions.get(sessionId);
        if (session) {
            session.messages = [];
            session.updatedAt = Date.now();
            await this.saveSessionToRedis(session);
        }
    }
    // 删除会话
    async deleteSession(sessionId) {
        this.sessions.delete(sessionId);
        await database_1.redisClient.del(`chat_session:${sessionId}`);
    }
    // 保存会话到 Redis
    async saveSessionToRedis(session) {
        try {
            await database_1.redisClient.setex(`chat_session:${session.sessionId}`, 3600 * 24, // 24 小时过期
            JSON.stringify(session));
        }
        catch (error) {
            logger_1.logger.error('ai-agent', 'Failed to save session to Redis', error?.message ?? error);
        }
    }
    // 从 Redis 加载会话
    async loadSessionsFromRedis() {
        try {
            const keys = await database_1.redisClient.keys('chat_session:*');
            for (const key of keys) {
                const data = await database_1.redisClient.get(key);
                if (data) {
                    const session = JSON.parse(data);
                    this.sessions.set(session.sessionId, session);
                }
            }
            logger_1.logger.info('ai-agent', `Loaded ${this.sessions.size} chat sessions from Redis`);
        }
        catch (error) {
            logger_1.logger.error('ai-agent', 'Failed to load sessions from Redis', error?.message ?? error);
        }
    }
    // 获取用户的所有会话
    getUserSessions(userId) {
        return Array.from(this.sessions.values()).filter(s => s.userId === userId);
    }
}
// 导出单例
exports.aiAgentService = new AIAgentService();
// 导出类（用于测试）
exports.default = AIAgentService;
//# sourceMappingURL=ai-agent.js.map