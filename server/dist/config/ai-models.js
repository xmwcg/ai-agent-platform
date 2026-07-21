"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIBAK_FREE_MODELS = exports.createAIClient = exports.aiModelManager = exports.AIModelManager = exports.AGNES_BASE_URL = exports.AGNES_API_KEY = exports.IFlyTEK_API_KEY = exports.STEPFUN_API_KEY = exports.YI_API_KEY = exports.BAICHUAN_API_KEY = exports.MOONSHOT_API_KEY = exports.DOUBAO_API_KEY = exports.QWEN_API_KEY = exports.ZHIPU_API_KEY = exports.DEEPSEEK_API_KEY = exports.ANTHROPIC_API_KEY = exports.OPENAI_API_KEY = exports.HUNYUAN_API_KEY = exports.HUNYUAN_SECRET_KEY = exports.HUNYUAN_SECRET_ID = void 0;
const openai_1 = __importDefault(require("openai"));
const dotenv_1 = __importDefault(require("dotenv"));
const logger_1 = require("../lib/logger");
const http_error_1 = require("../lib/http-error");
dotenv_1.default.config();
// 导出 API Key（供其他 service 使用）
// 混元采用腾讯云 TC3 签名，凭据为 SECRET_ID / SECRET_KEY（兼容旧名 HUNYUAN_API_KEY 退化）。
exports.HUNYUAN_SECRET_ID = process.env.HUNYUAN_SECRET_ID || process.env.HUNYUAN_API_KEY || '';
exports.HUNYUAN_SECRET_KEY = process.env.HUNYUAN_SECRET_KEY || process.env.HUNYUAN_API_KEY || '';
exports.HUNYUAN_API_KEY = process.env.HUNYUAN_API_KEY || '';
exports.OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
exports.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
exports.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
// 国内主流模型 API（低成本、合规、中文友好，直接拉高毛利）
exports.ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '';
exports.QWEN_API_KEY = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
exports.DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || '';
exports.MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || '';
exports.BAICHUAN_API_KEY = process.env.BAICHUAN_API_KEY || '';
exports.YI_API_KEY = process.env.YI_API_KEY || process.env.LINGYIWANWU_API_KEY || '';
exports.STEPFUN_API_KEY = process.env.STEPFUN_API_KEY || '';
exports.IFlyTEK_API_KEY = process.env.IFLYTEK_API_KEY || process.env.SPARK_API_KEY || '';
// Agnes AIHub 免费模型网关（apihub.agnes-ai.com，OpenAI 兼容：文本/图像/视频）
exports.AGNES_API_KEY = process.env.AGNES_API_KEY || '';
exports.AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1';
// AI 模型配置管理类
class AIModelManager {
    constructor() {
        this.providers = new Map();
        this.defaultProvider = 'openai';
        this.initializeProviders();
    }
    // 初始化所有 Provider
    initializeProviders() {
        const production = process.env.NODE_ENV === 'production';
        // Mock 仅允许在非生产环境启用。
        const mockMode = !production && process.env.ENABLE_MOCK_MODE === 'true';
        // 显式指定的默认 provider（平台配置 / 环境变量优先）
        const configuredDefault = process.env.DEFAULT_AI_PROVIDER || undefined;
        if (mockMode) {
            logger_1.logger.warn('ai-models', 'Mock mode enabled - AI responses will be simulated');
        }
        // 保留开发/测试用 Provider 定义，但生产环境永远标记为不可用且不会对外暴露。
        this.providers.set('mock', {
            name: 'Mock AI',
            apiKey: 'mock-key',
            models: ['mock-gpt-4', 'mock-claude'],
            defaultModel: 'mock-gpt-4',
            enabled: !production
        });
        // OpenAI
        if (process.env.OPENAI_API_KEY) {
            this.providers.set('openai', {
                name: 'OpenAI',
                baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
                apiKey: process.env.OPENAI_API_KEY,
                models: ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
                defaultModel: 'gpt-4.1',
                enabled: true
            });
        }
        // Anthropic (Claude)
        if (process.env.ANTHROPIC_API_KEY) {
            this.providers.set('anthropic', {
                name: 'Anthropic Claude',
                baseURL: 'https://api.anthropic.com/v1',
                apiKey: process.env.ANTHROPIC_API_KEY,
                models: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
                defaultModel: 'claude-3-sonnet',
                enabled: true
            });
        }
        // 注：DeepSeek 厂商已按计划取消（用户要求默认走免费模型），不再注册。
        // 智谱 GLM（OpenAI 兼容，低成本中文强模型）
        if (exports.ZHIPU_API_KEY) {
            this.providers.set('zhipu', {
                name: '智谱 GLM',
                baseURL: 'https://open.bigmodel.cn/api/paas/v4',
                apiKey: exports.ZHIPU_API_KEY,
                models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long'],
                defaultModel: 'glm-4-air',
                enabled: true,
            });
        }
        // 通义千问（阿里云 DashScope，OpenAI 兼容）
        if (exports.QWEN_API_KEY) {
            this.providers.set('qwen', {
                name: '通义千问',
                baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                apiKey: exports.QWEN_API_KEY,
                models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen-vl-max'],
                defaultModel: 'qwen-plus',
                enabled: true,
            });
        }
        // 豆包（火山方舟，OpenAI 兼容；model 用方舟 EndpointID 或通用名）
        if (exports.DOUBAO_API_KEY) {
            this.providers.set('doubao', {
                name: '豆包',
                baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
                apiKey: exports.DOUBAO_API_KEY,
                models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k'],
                defaultModel: 'doubao-pro-32k',
                enabled: true,
            });
        }
        // Moonshot Kimi（月之暗面，OpenAI 兼容，超长上下文 128K）
        if (exports.MOONSHOT_API_KEY) {
            this.providers.set('moonshot', {
                name: 'Moonshot Kimi',
                baseURL: 'https://api.moonshot.cn/v1',
                apiKey: exports.MOONSHOT_API_KEY,
                models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
                defaultModel: 'moonshot-v1-32k',
                enabled: true,
            });
        }
        // 百川智能（OpenAI 兼容，医疗/法律场景专业优化）
        if (exports.BAICHUAN_API_KEY) {
            this.providers.set('baichuan', {
                name: '百川智能',
                baseURL: 'https://api.baichuan-ai.com/v1',
                apiKey: exports.BAICHUAN_API_KEY,
                models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
                defaultModel: 'Baichuan3-Turbo',
                enabled: true,
            });
        }
        // 零一万物 Yi（OpenAI 兼容，视觉理解 + 超长上下文）
        if (exports.YI_API_KEY) {
            this.providers.set('yi', {
                name: '零一万物 Yi',
                baseURL: 'https://api.lingyiwanwu.com/v1',
                apiKey: exports.YI_API_KEY,
                models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-vision'],
                defaultModel: 'yi-medium',
                enabled: true,
            });
        }
        // 阶跃星辰 Step（OpenAI 兼容，多模态新势力）
        if (exports.STEPFUN_API_KEY) {
            this.providers.set('stepfun', {
                name: '阶跃星辰',
                baseURL: 'https://api.stepfun.com/v1',
                apiKey: exports.STEPFUN_API_KEY,
                models: ['step-2-16k', 'step-1-8k', 'step-1v-32k'],
                defaultModel: 'step-1-8k',
                enabled: true,
            });
        }
        // 讯飞星火（OpenAI 兼容接口）
        if (exports.IFlyTEK_API_KEY) {
            this.providers.set('iflytek', {
                name: '讯飞星火',
                baseURL: 'https://spark-api-open.xf-yun.com/v1',
                apiKey: exports.IFlyTEK_API_KEY,
                models: ['spark-lite', 'spark-pro', 'spark-max', 'spark-4.0-ultra'],
                defaultModel: 'spark-pro',
                enabled: true,
            });
        }
        // Agnes AIHub（免费模型网关，OpenAI 兼容：文本/图像/视频）
        if (exports.AGNES_API_KEY) {
            this.providers.set('agnes', {
                name: 'agnes',
                baseURL: exports.AGNES_BASE_URL,
                apiKey: exports.AGNES_API_KEY,
                models: ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0'],
                defaultModel: 'agnes-2.0-flash',
                enabled: true,
            });
        }
        // CloudBase AI Gateway（OpenAI 兼容）优先直连；未配置 API Key 时兼容旧 ai-chat 云函数回退。
        if ((process.env.CLOUDBASE_FREE_BASE_URL && process.env.CLOUDBASE_FREE_API_KEY)
            || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL) {
            this.providers.set('cloudbase', {
                name: 'CloudBase AI',
                baseURL: process.env.CLOUDBASE_FREE_BASE_URL || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL,
                apiKey: process.env.CLOUDBASE_FREE_API_KEY || '',
                models: ['hunyuan-2.0-instruct-20251111'],
                defaultModel: 'hunyuan-2.0-instruct-20251111',
                enabled: true,
            });
        }
        // 混元 (Tencent Hunyuan) — 使用腾讯云 TC3 凭据（SECRET_ID / SECRET_KEY）
        if (exports.HUNYUAN_SECRET_ID && exports.HUNYUAN_SECRET_KEY) {
            this.providers.set('hunyuan', {
                name: '腾讯混元',
                baseURL: 'https://hunyuan.tencentcloudapi.com',
                apiKey: exports.HUNYUAN_SECRET_KEY,
                models: ['hunyuan-pro', 'hunyuan-std', 'hunyuan-lite'],
                defaultModel: 'hunyuan-pro',
                enabled: true,
                // 记录 secretId 供 TC3 签名使用
                ...(exports.HUNYUAN_SECRET_ID ? { secretId: exports.HUNYUAN_SECRET_ID } : {}),
            });
        }
        // 默认 provider 决策（跟随平台配置）：
        //   1) 显式 DEFAULT_AI_PROVIDER 且已注册 → 优先采用；
        //   2) 非 Mock 模式 → 取第一个已注册的真实 provider；
        //   3) Mock 模式且未显式指定 → 保持 mock 兜底（零依赖可跑）。
        if (configuredDefault
            && this.providers.has(configuredDefault)
            && (!production || configuredDefault !== 'mock')) {
            this.defaultProvider = configuredDefault;
        }
        else if ((process.env.CLOUDBASE_FREE_BASE_URL || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL)
            && this.providers.has('cloudbase')) {
            // 配置了 CloudBase AI Gateway 或兼容云函数时，未显式指定默认厂商则优先走它。
            this.defaultProvider = 'cloudbase';
        }
        else if (exports.AGNES_API_KEY && this.providers.has('agnes')) {
            // 配置 Agnes 免费网关且未显式指定默认厂商时，平台默认走 Agnes（文本/图像/视频统一供给）
            this.defaultProvider = 'agnes';
        }
        else if (!mockMode) {
            const firstReal = Array.from(this.providers.entries())
                .find(([provider, config]) => provider !== 'mock' && config.enabled)?.[0];
            // 类型保持非空；若没有真实 Provider，getDefaultProvider() 会返回 undefined，生产启动校验会拒绝启动。
            this.defaultProvider = firstReal || 'openai';
        }
        else {
            this.defaultProvider = 'mock';
        }
    }
    isProviderAllowed(provider) {
        return process.env.NODE_ENV !== 'production' || provider !== 'mock';
    }
    // 获取 Provider 配置
    getProvider(provider) {
        if (!this.isProviderAllowed(provider))
            return undefined;
        const config = this.providers.get(provider);
        return config?.enabled ? config : undefined;
    }
    // 获取所有启用的 Providers
    getEnabledProviders() {
        return Array.from(this.providers.entries())
            .filter(([provider, config]) => config.enabled && this.isProviderAllowed(provider))
            .map(([, config]) => config);
    }
    // 获取默认 Provider
    getDefaultProvider() {
        return this.getProvider(this.defaultProvider);
    }
    // 设置默认 Provider
    setDefaultProvider(provider) {
        if (!this.isProviderAllowed(provider)) {
            throw new http_error_1.AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
        }
        if (this.getProvider(provider)) {
            this.defaultProvider = provider;
        }
    }
    // 创建 OpenAI 客户端（支持多 Provider）
    createClient(provider) {
        if (provider && !this.isProviderAllowed(provider)) {
            throw new http_error_1.AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
        }
        const targetProvider = provider ? this.getProvider(provider) : this.getDefaultProvider();
        if (!targetProvider) {
            throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
        }
        return new openai_1.default({
            apiKey: targetProvider.apiKey,
            baseURL: targetProvider.baseURL
        });
    }
    // 获取可用模型列表
    getAvailableModels() {
        const result = [];
        this.providers.forEach((config, provider) => {
            if (config.enabled && this.isProviderAllowed(provider)) {
                result.push({
                    provider: config.name,
                    models: config.models
                });
            }
        });
        return result;
    }
    // 测试 Provider 连接
    async testConnection(provider) {
        const config = this.getProvider(provider);
        if (!config)
            return false;
        try {
            const client = this.createClient(provider);
            // 简单测试：调用 models.list
            await client.models.list();
            return true;
        }
        catch (error) {
            logger_1.logger.error('ai-models', `Provider ${config.name} connection test failed`, error);
            return false;
        }
    }
}
exports.AIModelManager = AIModelManager;
// 导出单例
exports.aiModelManager = new AIModelManager();
// 导出 OpenAI 客户端创建函数
const createAIClient = (provider) => {
    return exports.aiModelManager.createClient(provider);
};
exports.createAIClient = createAIClient;
exports.AIBAK_FREE_MODELS = [
    { id: 'hy3', label: '混元 hy3（文本大模型）', kind: 'text', capabilities: { reasoning: true, vision: false, image: false } },
    { id: 'hy3-preview', label: '混元 hy3-preview（文本大模型）', kind: 'text', capabilities: { reasoning: true, vision: false, image: false } },
    { id: 'HY-Image-3.0-Plus-4090-Tob-v1.0', label: '文生图 HY-Image-3.0-Plus', kind: 'image', capabilities: { reasoning: false, vision: true, image: true } },
    { id: 'HY-Image-v3.0-I2I-ToB-v1.0.1', label: '图生图 HY-Image-v3.0-I2I', kind: 'image', capabilities: { reasoning: false, vision: true, image: true } },
];
//# sourceMappingURL=ai-models.js.map