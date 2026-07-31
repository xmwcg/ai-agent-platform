import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';
import { AppError } from '../lib/http-error';
import {
  DEFAULT_TEXT_AI_MODEL_ID,
  DEFAULT_TEXT_AI_PROVIDER,
} from './default-ai-model';

export {
  DEFAULT_TEXT_AI_MODEL,
  DEFAULT_TEXT_AI_MODEL_ID,
  DEFAULT_TEXT_AI_PROVIDER,
  getPreferredAgnesTextModel,
} from './default-ai-model';

dotenv.config();

// 导出 API Key（供其他 service 使用）
// 混元采用腾讯云 TC3 签名，凭据为 SECRET_ID / SECRET_KEY（兼容旧名 HUNYUAN_API_KEY 退化）。
export const HUNYUAN_SECRET_ID = process.env.HUNYUAN_SECRET_ID || process.env.HUNYUAN_API_KEY || '';
export const HUNYUAN_SECRET_KEY =
  process.env.HUNYUAN_SECRET_KEY || process.env.HUNYUAN_API_KEY || '';
export const HUNYUAN_API_KEY = process.env.HUNYUAN_API_KEY || '';
export const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
export const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
export const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || '';
// 国内主流模型 API（低成本、合规、中文友好，直接拉高毛利）
export const ZHIPU_API_KEY = process.env.ZHIPU_API_KEY || '';
export const QWEN_API_KEY = process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY || '';
export const DOUBAO_API_KEY = process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY || '';
export const MOONSHOT_API_KEY = process.env.MOONSHOT_API_KEY || process.env.KIMI_API_KEY || '';
export const BAICHUAN_API_KEY = process.env.BAICHUAN_API_KEY || '';
export const YI_API_KEY = process.env.YI_API_KEY || process.env.LINGYIWANWU_API_KEY || '';
export const STEPFUN_API_KEY = process.env.STEPFUN_API_KEY || '';
export const IFlyTEK_API_KEY = process.env.IFLYTEK_API_KEY || process.env.SPARK_API_KEY || '';
// Agnes AIHub 免费模型网关（apihub.agnes-ai.com，OpenAI 兼容：文本/图像/视频）
export const AGNES_API_KEY = process.env.AGNES_API_KEY || '';
export const AGNES_BASE_URL = process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1';
// Agnes AI 2.5 独立端点（保留旧 Agnes provider 与模型，新增 agnes-2.5-flash）
export const AGNES25_API_KEY = process.env.AGNES25_API_KEY || process.env.AGNES_25_API_KEY || '';
export const AGNES25_BASE_URL =
  process.env.AGNES25_BASE_URL || process.env.AGNES_25_BASE_URL || 'https://api.agnes-ai.cn/v1';

// AI Provider 类型定义
export type AIProvider =
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'hunyuan'
  | 'zhipu' // 智谱 GLM
  | 'qwen' // 通义千问（阿里云 DashScope）
  | 'doubao' // 豆包（火山方舟）
  | 'moonshot' // Moonshot Kimi（月之暗面）
  | 'baichuan' // 百川智能
  | 'yi' // 零一万物 Yi
  | 'stepfun' // 阶跃星辰 Step
  | 'iflytek' // 讯飞星火
  | 'cloudbase' // 腾讯云 CloudBase 小程序免费计划额度（OpenAI 兼容，腾讯混元 hy3）
  | 'agnes' // Agnes AIHub 免费模型网关（apihub.agnes-ai.com，文本/图像/视频）
  | 'agnes25' // Agnes AI 2.5 独立端点（api.agnes-ai.cn，文本对话）
  | 'siliconflow' // 硅基流动 SiliconFlow（免费引流层：9B 以下开源模型永久免费）
  | 'openrouter' // OpenRouter（批发层：400+ 模型 pass-through 计费）
  | 'groq' // Groq（Llama 系免费层，高速推理）
  | 'gemini' // Google Gemini（2.5 Flash 免费层）
  | 'custom'
  | 'mock';


// Provider 配置接口
export interface ProviderConfig {
  name: string;
  baseURL?: string;
  apiKey: string;
  models: string[];
  defaultModel: string;
  enabled: boolean;
}

// AI 模型配置管理类
export class AIModelManager {
  private providers: Map<AIProvider, ProviderConfig> = new Map();
  private defaultProvider: AIProvider = 'openai';

  constructor() {
    this.initializeProviders();
  }

  // 初始化所有 Provider
  private initializeProviders(): void {
    const production = process.env.NODE_ENV === 'production';
    // Mock 仅允许在非生产环境启用。
    const mockMode = !production && process.env.ENABLE_MOCK_MODE === 'true';
    // 显式指定的默认 provider（平台配置 / 环境变量优先）
    const configuredDefault = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || undefined;
    // 运行时读取 Agnes 凭据，支持测试、热加载和进程内环境切换。
    const agnesApiKey = process.env.AGNES_API_KEY || AGNES_API_KEY;
    const agnesBaseUrl = process.env.AGNES_BASE_URL || AGNES_BASE_URL;
    const agnes25ApiKey = process.env.AGNES25_API_KEY || process.env.AGNES_25_API_KEY || AGNES25_API_KEY;
    const agnes25BaseUrl = process.env.AGNES25_BASE_URL || process.env.AGNES_25_BASE_URL || AGNES25_BASE_URL;

    if (mockMode) {
      logger.warn('ai-models', 'Mock mode enabled - AI responses will be simulated');
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
    if (ZHIPU_API_KEY) {
      this.providers.set('zhipu', {
        name: '智谱 GLM',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: ZHIPU_API_KEY,
        models: ['glm-4.7-flash', 'glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4-long'],
        defaultModel: 'glm-4.7-flash',
        enabled: true,
      });
    }

    // 通义千问（阿里云 DashScope，OpenAI 兼容）
    if (QWEN_API_KEY) {
      this.providers.set('qwen', {
        name: '通义千问',
        baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
        apiKey: QWEN_API_KEY,
        models: ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen-vl-max'],
        defaultModel: 'qwen-plus',
        enabled: true,
      });
    }

    // 豆包（火山方舟，OpenAI 兼容；model 用方舟 EndpointID 或通用名）
    if (DOUBAO_API_KEY) {
      this.providers.set('doubao', {
        name: '豆包',
        baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
        apiKey: DOUBAO_API_KEY,
        models: ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k'],
        defaultModel: 'doubao-pro-32k',
        enabled: true,
      });
    }

    // Moonshot Kimi（月之暗面，OpenAI 兼容，超长上下文 128K）
    if (MOONSHOT_API_KEY) {
      this.providers.set('moonshot', {
        name: 'Moonshot Kimi',
        baseURL: 'https://api.moonshot.cn/v1',
        apiKey: MOONSHOT_API_KEY,
        models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
        defaultModel: 'moonshot-v1-32k',
        enabled: true,
      });
    }

    // 百川智能（OpenAI 兼容，医疗/法律场景专业优化）
    if (BAICHUAN_API_KEY) {
      this.providers.set('baichuan', {
        name: '百川智能',
        baseURL: 'https://api.baichuan-ai.com/v1',
        apiKey: BAICHUAN_API_KEY,
        models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
        defaultModel: 'Baichuan3-Turbo',
        enabled: true,
      });
    }

    // 零一万物 Yi（OpenAI 兼容，视觉理解 + 超长上下文）
    if (YI_API_KEY) {
      this.providers.set('yi', {
        name: '零一万物 Yi',
        baseURL: 'https://api.lingyiwanwu.com/v1',
        apiKey: YI_API_KEY,
        models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-vision'],
        defaultModel: 'yi-medium',
        enabled: true,
      });
    }

    // 阶跃星辰 Step（OpenAI 兼容，多模态新势力）
    if (STEPFUN_API_KEY) {
      this.providers.set('stepfun', {
        name: '阶跃星辰',
        baseURL: 'https://api.stepfun.com/v1',
        apiKey: STEPFUN_API_KEY,
        models: ['step-2-16k', 'step-1-8k', 'step-1v-32k'],
        defaultModel: 'step-1-8k',
        enabled: true,
      });
    }

    // 讯飞星火（OpenAI 兼容接口）
    if (IFlyTEK_API_KEY) {
      this.providers.set('iflytek', {
        name: '讯飞星火',
        baseURL: 'https://spark-api-open.xf-yun.com/v1',
        apiKey: IFlyTEK_API_KEY,
        models: ['spark-lite', 'spark-pro', 'spark-max', 'spark-4.0-ultra'],
        defaultModel: 'spark-pro',
        enabled: true,
      });
    }

    // Agnes AI 2.5：全平台默认免费文本模型，优先注册以统一模型选择器顺序。
    if (agnes25ApiKey) {
      this.providers.set('agnes25', {
        name: 'agnes25',
        baseURL: agnes25BaseUrl,
        apiKey: agnes25ApiKey,
        models: [DEFAULT_TEXT_AI_MODEL_ID],
        defaultModel: DEFAULT_TEXT_AI_MODEL_ID,
        enabled: true,
      });
    }

    // 旧 Agnes AIHub 继续保留，提供旧文本、图像和视频模型供手动选择与媒体任务使用。
    if (agnesApiKey) {
      this.providers.set('agnes', {
        name: 'agnes',
        baseURL: agnesBaseUrl,
        apiKey: agnesApiKey,
        models: ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0'],
        defaultModel: 'agnes-2.0-flash',
        enabled: true,
      });
    }

    // CloudBase AI Gateway（OpenAI 兼容）优先直连；未配置 API Key 时兼容旧 ai-chat 云函数回退。
    if (
      (process.env.CLOUDBASE_FREE_BASE_URL && process.env.CLOUDBASE_FREE_API_KEY)
      || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL
    ) {
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
    if (HUNYUAN_SECRET_ID && HUNYUAN_SECRET_KEY) {
      this.providers.set('hunyuan', {
        name: '腾讯混元',
        baseURL: 'https://hunyuan.tencentcloudapi.com',
        apiKey: HUNYUAN_SECRET_KEY,
        models: ['hunyuan-pro', 'hunyuan-std', 'hunyuan-lite'],
        defaultModel: 'hunyuan-pro',
        enabled: true,
        // 记录 secretId 供 TC3 签名使用
        ...(HUNYUAN_SECRET_ID ? { secretId: HUNYUAN_SECRET_ID } : {}),
        } as ProviderConfig & { secretId?: string });
    }

    // 硅基流动 SiliconFlow（免费引流层：9B 以下开源模型永久免费，OpenAI 兼容，国产直连）
    if (process.env.SILICONFLOW_API_KEY) {
      this.providers.set('siliconflow', {
        name: '硅基流动',
        baseURL: 'https://api.siliconflow.cn/v1',
        apiKey: process.env.SILICONFLOW_API_KEY,
        models: ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen3-8B'],
        defaultModel: 'Qwen/Qwen2.5-7B-Instruct',
        enabled: true,
      });
    }
    // OpenRouter（批发层：400+ 模型 pass-through 计费，仅 5.5% 信用费，企业协议可谈量价）
    if (process.env.OPENROUTER_API_KEY) {
      this.providers.set('openrouter', {
        name: 'OpenRouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        models: ['deepseek/deepseek-v4-flash', 'qwen/qwen3-235b-a22b', 'google/gemini-2.5-flash', 'anthropic/claude-3.5-haiku'],
        defaultModel: 'deepseek/deepseek-v4-flash',
        enabled: true,
      });
    }
    // Groq（免费层：Llama 系高速推理，OpenAI 兼容）
    if (process.env.GROQ_API_KEY) {
      this.providers.set('groq', {
        name: 'Groq',
        baseURL: 'https://api.groq.com/openai/v1',
        apiKey: process.env.GROQ_API_KEY,
        models: ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama-3.2-11b-vision-preview'],
        defaultModel: 'llama-3.1-8b-instant',
        enabled: true,
      });
    }
    // Google Gemini（2.5 Flash 免费层，OpenAI 兼容端点；国内需公网可达路由）
    if (process.env.GEMINI_API_KEY) {
      this.providers.set('gemini', {
        name: 'Gemini',
        baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai/',
        apiKey: process.env.GEMINI_API_KEY,
        models: ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro'],
        defaultModel: 'gemini-2.5-flash',
        enabled: true,
      });
    }

    // 默认 provider 决策（跟随平台配置）：
    //   1) 显式 DEFAULT_AI_PROVIDER 且已注册 → 优先采用；
    //   2) 非 Mock 模式 → 取第一个已注册的真实 provider；
    //   3) Mock 模式且未显式指定 → 保持 mock 兜底（零依赖可跑）。
    if (agnes25ApiKey && this.providers.has(DEFAULT_TEXT_AI_PROVIDER)) {
      // Agnes 2.5 是平台强制统一的免费文本默认模型；环境中的旧默认值不能覆盖它。
      this.defaultProvider = DEFAULT_TEXT_AI_PROVIDER;
    } else if (
      configuredDefault
      && this.providers.has(configuredDefault)
      && (!production || configuredDefault !== 'mock')
    ) {
      this.defaultProvider = configuredDefault;
    } else if (
      (process.env.SILICONFLOW_API_KEY || process.env.OPENROUTER_API_KEY)
      && (this.providers.has('siliconflow') || this.providers.has('openrouter'))
    ) {
      // 免费引流层 / 批发层优先：配置了硅基流动或 OpenRouter 时，未显式指定默认厂商则优先走它
      // （硅基流动 9B 以下模型永久免费，OpenRouter 透明 pass-through，成本可控且可商用）。
      this.defaultProvider = this.providers.has('siliconflow') ? 'siliconflow' : 'openrouter';
    } else if (
      (process.env.CLOUDBASE_FREE_BASE_URL || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL)
      && this.providers.has('cloudbase')
    ) {
      // 配置了 CloudBase AI Gateway 或兼容云函数时，未显式指定默认厂商则优先走它。
      this.defaultProvider = 'cloudbase';
    } else if (agnesApiKey && this.providers.has('agnes')) {
      this.defaultProvider = 'agnes';
    } else if (!mockMode) {
      const firstReal = Array.from(this.providers.entries())
        .find(([provider, config]) => provider !== 'mock' && config.enabled)?.[0];
      // 类型保持非空；若没有真实 Provider，getDefaultProvider() 会返回 undefined，生产启动校验会拒绝启动。
      this.defaultProvider = firstReal || 'openai';
    } else {
      this.defaultProvider = 'mock';
    }
  }

  private isProviderAllowed(provider: AIProvider): boolean {
    return process.env.NODE_ENV !== 'production' || provider !== 'mock';
  }

  // 获取 Provider 配置
  getProvider(provider: AIProvider): ProviderConfig | undefined {
    if (!this.isProviderAllowed(provider)) return undefined;
    const config = this.providers.get(provider);
    return config?.enabled ? config : undefined;
  }

  // 获取所有启用的 Providers
  getEnabledProviders(): ProviderConfig[] {
    return Array.from(this.providers.entries())
      .filter(([provider, config]) => config.enabled && this.isProviderAllowed(provider))
      .map(([, config]) => config);
  }

  // 获取默认 Provider
  getDefaultProvider(): ProviderConfig | undefined {
    return this.getProvider(this.defaultProvider);
  }

  // 设置默认 Provider
  setDefaultProvider(provider: AIProvider): void {
    if (!this.isProviderAllowed(provider)) {
      throw new AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
    }
    if (this.getProvider(provider)) {
      this.defaultProvider = provider;
    }
  }

  // 创建 OpenAI 客户端（支持多 Provider）
  createClient(provider?: AIProvider): OpenAI {
    if (provider && !this.isProviderAllowed(provider)) {
      throw new AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
    }
    const targetProvider = provider ? this.getProvider(provider) : this.getDefaultProvider();
    
    if (!targetProvider) {
      throw new Error(`Provider ${provider || this.defaultProvider} not configured`);
    }

    return new OpenAI({
      apiKey: targetProvider.apiKey,
      baseURL: targetProvider.baseURL
    });
  }

  // 获取可用模型列表
  getAvailableModels(): { provider: string; models: string[] }[] {
    const result: { provider: string; models: string[] }[] = [];
    
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
  async testConnection(provider: AIProvider): Promise<boolean> {
    const config = this.getProvider(provider);
    if (!config) return false;

    try {
      const client = this.createClient(provider);
      // 简单测试：调用 models.list
      await client.models.list();
      return true;
    } catch (error) {
      logger.error('ai-models', `Provider ${config.name} connection test failed`, error);
      return false;
    }
  }
}

// 导出单例
export const aiModelManager = new AIModelManager();

// 导出 OpenAI 客户端创建函数
export const createAIClient = (provider?: AIProvider): OpenAI => {
  return aiModelManager.createClient(provider);
};

/**
 * 平台免费额度：云函数 4 个免费模型（消耗小程序成长计划免费额度）
 * 全站已内置为统一推理兜底，此处作为「模型配置中心」的一等公民展示能力标签
 */
export interface FreeModelDef {
  id: string;
  label: string;
  kind: 'text' | 'image';
  capabilities: { reasoning: boolean; vision: boolean; image: boolean };
}
export const AIBAK_FREE_MODELS: FreeModelDef[] = [
  { id: 'hy3', label: '混元 hy3（文本大模型）', kind: 'text', capabilities: { reasoning: true, vision: false, image: false } },
  { id: 'hy3-preview', label: '混元 hy3-preview（文本大模型）', kind: 'text', capabilities: { reasoning: true, vision: false, image: false } },
  { id: 'HY-Image-3.0-Plus-4090-Tob-v1.0', label: '文生图 HY-Image-3.0-Plus', kind: 'image', capabilities: { reasoning: false, vision: true, image: true } },
  { id: 'HY-Image-v3.0-I2I-ToB-v1.0.1', label: '图生图 HY-Image-v3.0-I2I', kind: 'image', capabilities: { reasoning: false, vision: true, image: true } },
];
