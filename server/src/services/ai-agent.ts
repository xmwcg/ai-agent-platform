import { aiModelManager, type AIProvider } from '../config/ai-models';
import { redisClient } from '../config/database';
import { route, type GatewayProviderName } from '../gateway/ai-gateway.service';
import { logger } from '../lib/logger';
import { AppError } from '../lib/http-error';

// 对话消息接口
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: number;
}

// 对话会话接口
export interface ChatSession {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  provider: AIProvider;
  model: string;
  createdAt: number;
  updatedAt: number;
}

// Agent 配置
export interface AgentConfig {
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  enableRAG?: boolean; // 是否启用 RAG
  enableTools?: boolean; // 是否启用工具调用
}

// AI Agent 服务类
class AIAgentService {
  private sessions: Map<string, ChatSession> = new Map();

  constructor() {
    // 从 Redis 恢复会话（可选）
    this.loadSessionsFromRedis();
  }

  // 创建新会话
  async createSession(userId: string, provider?: AIProvider): Promise<string> {
    if (process.env.NODE_ENV === 'production' && provider === 'mock') {
      throw new AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
    }
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const defaultProvider = provider || (aiModelManager.getDefaultProvider()?.name.toLowerCase() as AIProvider) || 'openai';
    
    const session: ChatSession = {
      sessionId,
      userId,
      messages: [],
      provider: defaultProvider,
      model: aiModelManager.getProvider(defaultProvider)?.defaultModel || 'gpt-4o',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.sessions.set(sessionId, session);
    await this.saveSessionToRedis(session);

    return sessionId;
  }

  // 发送消息（统一走 AI 网关 route，屏蔽厂商差异与 fallback）
  async sendMessage(
    sessionId: string,
    message: string,
    config?: AgentConfig,
    modelOverride?: { model?: string; provider?: GatewayProviderName }
  ): Promise<{ reply: string; usage?: any }> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    // 添加用户消息
    const userMessage: ChatMessage = {
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
      const result = await route({
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
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: reply,
        timestamp: Date.now()
      };
      session.messages.push(assistantMessage);

      // 更新会话
      session.updatedAt = Date.now();
      await this.saveSessionToRedis(session);

      return { reply, usage };
    } catch (error: any) {
      logger.error('ai-agent', 'sendMessage error', error?.message ?? error);
      throw error;
    }
  }

  // 构建消息列表
  private buildMessages(session: ChatSession, config?: AgentConfig): any[] {
    const messages: any[] = [];

    // 系统提示词
    if (config?.systemPrompt) {
      messages.push({
        role: 'system',
        content: config.systemPrompt
      });
    } else {
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
  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  // 获取会话历史
  getSessionHistory(sessionId: string): ChatMessage[] {
    const session = this.sessions.get(sessionId);
    return session?.messages || [];
  }

  // 清空会话历史
  async clearSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages = [];
      session.updatedAt = Date.now();
      await this.saveSessionToRedis(session);
    }
  }

  // 删除会话
  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
    await redisClient.del(`chat_session:${sessionId}`);
  }

  // 保存会话到 Redis
  private async saveSessionToRedis(session: ChatSession): Promise<void> {
    try {
      await redisClient.setex(
        `chat_session:${session.sessionId}`,
        3600 * 24, // 24 小时过期
        JSON.stringify(session)
      );
    } catch (error) {
      logger.error('ai-agent', 'Failed to save session to Redis', (error as Error)?.message ?? error);
    }
  }

  // 从 Redis 加载会话
  private async loadSessionsFromRedis(): Promise<void> {
    try {
      const keys = await redisClient.keys('chat_session:*');
      for (const key of keys) {
        const data = await redisClient.get(key);
        if (data) {
          const session: ChatSession = JSON.parse(data);
          this.sessions.set(session.sessionId, session);
        }
      }
      logger.info('ai-agent', `Loaded ${this.sessions.size} chat sessions from Redis`);
    } catch (error) {
      logger.error('ai-agent', 'Failed to load sessions from Redis', (error as Error)?.message ?? error);
    }
  }

  // 获取用户的所有会话
  getUserSessions(userId: string): ChatSession[] {
    return Array.from(this.sessions.values()).filter(s => s.userId === userId);
  }
}

// 导出单例
export const aiAgentService = new AIAgentService();

// 导出类（用于测试）
export default AIAgentService;
