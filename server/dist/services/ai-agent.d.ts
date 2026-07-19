import { type AIProvider } from '../config/ai-models';
import { type GatewayProviderName } from '../gateway/ai-gateway.service';
export interface ChatMessage {
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp?: number;
}
export interface ChatSession {
    sessionId: string;
    userId: string;
    messages: ChatMessage[];
    provider: AIProvider;
    model: string;
    createdAt: number;
    updatedAt: number;
}
export interface AgentConfig {
    systemPrompt?: string;
    temperature?: number;
    maxTokens?: number;
    enableRAG?: boolean;
    enableTools?: boolean;
}
declare class AIAgentService {
    private sessions;
    constructor();
    createSession(userId: string, provider?: AIProvider): Promise<string>;
    sendMessage(sessionId: string, message: string, config?: AgentConfig, modelOverride?: {
        model?: string;
        provider?: GatewayProviderName;
    }): Promise<{
        reply: string;
        usage?: any;
    }>;
    private buildMessages;
    getSession(sessionId: string): ChatSession | undefined;
    getSessionHistory(sessionId: string): ChatMessage[];
    clearSession(sessionId: string): Promise<void>;
    deleteSession(sessionId: string): Promise<void>;
    private saveSessionToRedis;
    private loadSessionsFromRedis;
    getUserSessions(userId: string): ChatSession[];
}
export declare const aiAgentService: AIAgentService;
export default AIAgentService;
//# sourceMappingURL=ai-agent.d.ts.map