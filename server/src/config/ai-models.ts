import OpenAI from 'openai';
import dotenv from 'dotenv';
import { logger } from '../lib/logger';

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
class AIModelManager {
  private providers: Map<AIProvider, ProviderConfig> = new Map();
  private defaultProvider: AIProvider = 'openai';

  constructor() {
    this.initializeProviders();
  }

  // 初始化所有 Provider
  private initializeProviders(): void {
    // 检查是否启用模拟模式
    const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
    // 显式指定的默认 provider（平台配置 / 环境变量优先）
    const configuredDefault = (process.env.DEFAULT_AI_PROVIDER as AIProvider) || undefined;

    if (mockMode) {
      logger.warn('ai-models', 'Mock mode enabled - AI responses will be simulated');
    }

    // 始终注册模拟 Provider（作为可用兜底，不强制为默认）
    this.providers.set('mock', {
      name: 'Mock AI',
      apiKey: 'mock-key',
      models: ['mock-gpt-4', 'mock-claude'],
      defaultModel: 'mock-gpt-4',
      enabled: true
    });

    // OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.providers.set('openai', {
        name: 'OpenAI',
        baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
        apiKey: process.env.OPENAI_API_KEY,
        models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'],
        defaultModel: 'gpt-4o',
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

    // DeepSeek
    if (process.env.DEEPSEEK_API_KEY) {
      this.providers.set('deepseek', {
        name: 'DeepSeek',
        baseURL: 'https://api.deepseek.com/v1',
        apiKey: process.env.DEEPSEEK_API_KEY,
        models: ['deepseek-chat', 'deepseek-coder'],
        defaultModel: 'deepseek-chat',
        enabled: true
      });
    }

    // 智谱 GLM（OpenAI 兼容，低成本中文强模型）
    if (ZHIPU_API_KEY) {
      this.providers.set('zhipu', {
        name: '智谱 GLM',
        baseURL: 'https://open.bigmodel.cn/api/paas/v4',
        apiKey: ZHIPU_API_KEY,
        models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long'],
        defaultModel: 'glm-4-air',
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

    // 默认 provider 决策（跟随平台配置）：
    //   1) 显式 DEFAULT_AI_PROVIDER 且已注册 → 优先采用；
    //   2) 非 Mock 模式 → 取第一个已注册的真实 provider；
    //   3) Mock 模式且未显式指定 → 保持 mock 兜底（零依赖可跑）。
    if (configuredDefault && this.providers.has(configuredDefault)) {
      this.defaultProvider = configuredDefault;
    } else if (!mockMode) {
      const firstReal = Array.from(this.providers.keys()).find((p) => p !== 'mock');
      this.defaultProvider = firstReal || 'mock';
    } else {
      this.defaultProvider = 'mock';
    }
  }

  // 获取 Provider 配置
  getProvider(provider: AIProvider): ProviderConfig | undefined {
    return this.providers.get(provider);
  }

  // 获取所有启用的 Providers
  getEnabledProviders(): ProviderConfig[] {
    return Array.from(this.providers.values()).filter(p => p.enabled);
  }

  // 获取默认 Provider
  getDefaultProvider(): ProviderConfig | undefined {
    return this.providers.get(this.defaultProvider);
  }

  // 设置默认 Provider
  setDefaultProvider(provider: AIProvider): void {
    if (this.providers.has(provider)) {
      this.defaultProvider = provider;
    }
  }

  // 创建 OpenAI 客户端（支持多 Provider）
  createClient(provider?: AIProvider): OpenAI {
    const targetProvider = provider ? this.providers.get(provider) : this.getDefaultProvider();
    
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
    
    this.providers.forEach((config, key) => {
      if (config.enabled) {
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
    const config = this.providers.get(provider);
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
