/**
 * AI 网关（OmniRoute 风格）
 * ----------------------------------------------------------------
 * 参考 diegosouzapw/OmniRoute 的设计：本地优先、单入口统一路由多家 AI 厂商，
 * 支持「provider 注册表 + 前缀寻址 + fallback 策略 + 协议翻译」。
 *
 * 与我们系统的结合点：
 *   - 把现有 ai-models.ts 的各家客户端纳入统一 Provider 注册表；
 *   - 把 media-gen.service.ts 里已落地的【腾讯云 TC3-HMAC-SHA256 签名】
 *     作为本网关的 `hunyuan` provider（用于混元大模型对话，与媒体生成复用同一签名算法）；
 *   - 提供 route() 统一入口，路由层 / 技能层 / 开放 API 市场都只调它，不直接散落 axios；
 *   - 支持 priority fallback 策略（主厂商失败自动切备份），并尊重 ENABLE_MOCK_MODE。
 */
export type GatewayProviderName = 'mock' | 'openai' | 'anthropic' | 'deepseek' | 'hunyuan' | 'zhipu' | 'qwen' | 'doubao' | 'agnes';
export interface ChatRouteRequest {
    /** 支持前缀寻址，如 "hunyuan/hunyuan-pro" 或 "deepseek/deepseek-v4-flash"；缺省走策略选择 */
    model?: string;
    messages: {
        role: 'system' | 'user' | 'assistant';
        content: string;
    }[];
    temperature?: number;
    maxTokens?: number;
    /** 强制指定 provider（绕过策略与 fallback） */
    provider?: GatewayProviderName;
}
export interface ChatRouteResult {
    reply: string;
    provider: GatewayProviderName;
    model: string;
    usage?: any;
}
/**
 * 从数据库加载启用的 ModelConfig 作为自定义 provider。
 * 单测可传入 injected（不触库）以验证路由行为。
 */
export declare function reloadCustomProviders(injected?: any[]): Promise<void>;
/** 热重载 provider 注册表（配置变更后调用） */
export declare function reloadGatewayProviders(): void;
export declare function listGatewayProviders(): {
    name: GatewayProviderName;
    label: string;
    configured: boolean;
}[];
/** 列出全部可选模型（内置 + 第三方自定义），供前端模型选择器
 *  如果自定义 provider 与内置 provider 指向同一 API（同 baseURL + apiKey），
 *  则内置 provider 的模型列表会以自定义 provider 为主，避免重复。 */
export declare function listGatewayModels(): {
    provider: string;
    label: string;
    models: string[];
    custom?: boolean;
}[];
/**
 * priority fallback 策略：按注册顺序尝试，第一个 configured 且能服务的 provider 先上；
 * 调用失败则依次降级到下一个。与 OmniRoute 的 priority combo 一致。
 */
export declare function route(req: ChatRouteRequest): Promise<ChatRouteResult>;
//# sourceMappingURL=ai-gateway.service.d.ts.map