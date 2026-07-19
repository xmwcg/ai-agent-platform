import OpenAI from 'openai';
export declare const HUNYUAN_SECRET_ID: string;
export declare const HUNYUAN_SECRET_KEY: string;
export declare const HUNYUAN_API_KEY: string;
export declare const OPENAI_API_KEY: string;
export declare const ANTHROPIC_API_KEY: string;
export declare const DEEPSEEK_API_KEY: string;
export declare const ZHIPU_API_KEY: string;
export declare const QWEN_API_KEY: string;
export declare const DOUBAO_API_KEY: string;
export declare const MOONSHOT_API_KEY: string;
export declare const BAICHUAN_API_KEY: string;
export declare const YI_API_KEY: string;
export declare const STEPFUN_API_KEY: string;
export declare const IFlyTEK_API_KEY: string;
export declare const AGNES_API_KEY: string;
export declare const AGNES_BASE_URL: string;
export type AIProvider = 'openai' | 'anthropic' | 'deepseek' | 'hunyuan' | 'zhipu' | 'qwen' | 'doubao' | 'moonshot' | 'baichuan' | 'yi' | 'stepfun' | 'iflytek' | 'agnes' | 'custom' | 'mock';
export interface ProviderConfig {
    name: string;
    baseURL?: string;
    apiKey: string;
    models: string[];
    defaultModel: string;
    enabled: boolean;
}
export declare class AIModelManager {
    private providers;
    private defaultProvider;
    constructor();
    private initializeProviders;
    private isProviderAllowed;
    getProvider(provider: AIProvider): ProviderConfig | undefined;
    getEnabledProviders(): ProviderConfig[];
    getDefaultProvider(): ProviderConfig | undefined;
    setDefaultProvider(provider: AIProvider): void;
    createClient(provider?: AIProvider): OpenAI;
    getAvailableModels(): {
        provider: string;
        models: string[];
    }[];
    testConnection(provider: AIProvider): Promise<boolean>;
}
export declare const aiModelManager: AIModelManager;
export declare const createAIClient: (provider?: AIProvider) => OpenAI;
/**
 * 平台免费额度：云函数 4 个免费模型（消耗小程序成长计划免费额度）
 * 全站已内置为统一推理兜底，此处作为「模型配置中心」的一等公民展示能力标签
 */
export interface FreeModelDef {
    id: string;
    label: string;
    kind: 'text' | 'image';
    capabilities: {
        reasoning: boolean;
        vision: boolean;
        image: boolean;
    };
}
export declare const AIBAK_FREE_MODELS: FreeModelDef[];
//# sourceMappingURL=ai-models.d.ts.map