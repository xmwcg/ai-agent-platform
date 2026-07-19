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

import axios from 'axios';
import OpenAI from 'openai';
import { aiModelManager } from '../config/ai-models';
import { signTencentTC3 } from '../lib/tc3';
import { logger } from '../lib/logger';
import { AppError } from '../lib/http-error';

/* ------------------------------ 类型定义 ------------------------------ */

export type GatewayProviderName =
  | 'mock'
  | 'openai'
  | 'anthropic'
  | 'deepseek'
  | 'hunyuan'
  | 'zhipu'
  | 'qwen'
  | 'doubao'
  | 'agnes';

export interface ChatRouteRequest {
  /** 支持前缀寻址，如 "hunyuan/hunyuan-pro" 或 "deepseek/deepseek-v4-flash"；缺省走策略选择 */
  model?: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
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

/* ------------------------------ 腾讯云 TC3 签名（与 media-gen 共用 lib/tc3） ------------------------------ */
// 腾讯云 API 3.0 签名已抽到 `lib/tc3.ts`（混元大模型对话与媒体生成复用同一算法），此处直接引用。

/* ------------------------------ Provider 抽象 ------------------------------ */

interface GatewayProvider {
  name: GatewayProviderName;
  label: string;
  /** 该 provider 是否可用（有 key 且非 mock 模式要求配置） */
  isConfigured(): boolean;
  /** 是否能服务给定模型前缀 */
  owns(model: string): boolean;
  /** 该 provider 提供的模型列表（供前端选择器） */
  models(): string[];
  /** 执行对话 */
  chat(req: ChatRouteRequest, model: string): Promise<ChatRouteResult>;
}

/* ------------------------------ Mock Provider ------------------------------ */
class MockGatewayProvider implements GatewayProvider {
  name = 'mock' as const;
  label = '演示模式（Mock）';
  isConfigured() {
    return true;
  }
  owns(model: string) {
    // mock 仅作为显式指定或兜底，不贪婪匹配任意模型，避免抢占真实/自定义 provider 路由
    return model === 'mock';
  }
  models() {
    return [];
  }
  async chat(req: ChatRouteRequest): Promise<ChatRouteResult> {
    const last = req.messages[req.messages.length - 1]?.content || '';
    return {
      reply: `[Mock] 已收到你的消息：「${last.slice(0, 40)}」。在 .env 中配置厂商 API Key 后可获得真实回复。`,
      provider: 'mock',
      model: 'mock-gpt-4',
      usage: { prompt_tokens: 0, completion_tokens: 0 },
    };
  }
}

/* ------------------------------ OpenAI 兼容 Provider ------------------------------ */
class OpenAICompatibleProvider implements GatewayProvider {
  constructor(
    public name: GatewayProviderName,
    public label: string,
    private baseURL: string,
    private apiKey: string,
    private modelPrefix: string,
    private modelList: string[] = []
  ) {}
  isConfigured() {
    return !!this.apiKey;
  }
  owns(model: string) {
    return model.startsWith(this.modelPrefix + "/") || model === this.modelPrefix || this.modelList.includes(model);
  }
  models() {
    return this.modelList;
  }
  async chat(req: ChatRouteRequest, model: string): Promise<ChatRouteResult> {
    const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
    const rawModel = model.includes('/') ? model.split('/').slice(1).join('/') : model;
    // Model names are passed through directly (DeepSeek API now supports v4-flash/v4-pro natively)
    const resolved = rawModel;
    const completion = await client.chat.completions.create({
      model: resolved,
      messages: req.messages as any,
      temperature: req.temperature ?? 0.7,
      max_tokens: req.maxTokens ?? 2000,
    });
    return {
      reply: completion.choices[0]?.message?.content || '',
      provider: this.name,
      model: resolved, // display name (not api model)
      usage: completion.usage,
    };
  }
}

/* ------------------------------ 腾讯混元（TC3 签名） ------------------------------ */
const HUNYUAN_HOST = 'hunyuan.tencentcloudapi.com';
const HUNYUAN_VERSION = '2023-09-01';
class HunyuanGatewayProvider implements GatewayProvider {
  name = 'hunyuan' as const;
  label = '腾讯混元';
  private get secretId() {
    return process.env.HUNYUAN_SECRET_ID || process.env.HUNYUAN_API_KEY || '';
  }
  private get secretKey() {
    return process.env.HUNYUAN_SECRET_KEY || '';
  }
  isConfigured() {
    return !!this.secretId && !!this.secretKey;
  }
  owns(model: string) {
    return model.startsWith('hunyuan/') || model === 'hunyuan';
  }
  models() {
    return ['hunyuan-pro', 'hunyuan-std', 'hunyuan-lite'];
  }
  async chat(req: ChatRouteRequest, model: string): Promise<ChatRouteResult> {
    if (!this.isConfigured()) throw new Error('混元未配置：设置 HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY');
    const resolved = model.includes('/') ? model.split('/')[1] : 'hunyuan-pro';
    const payload = JSON.stringify({
      Model: resolved,
      Messages: req.messages.map((m) => ({ Role: m.role, Content: m.content })),
      ...(req.temperature != null ? { Temperature: req.temperature } : {}),
      ...(req.maxTokens != null ? { MaxTokens: req.maxTokens } : {}),
    });
    const timestamp = Math.floor(Date.now() / 1000);
    const { authorization } = signTencentTC3({
      secretId: this.secretId,
      secretKey: this.secretKey,
      service: 'hunyuan',
      host: HUNYUAN_HOST,
      action: 'ChatCompletions',
      version: HUNYUAN_VERSION,
      region: 'ap-guangzhou',
      payload,
      timestamp,
    });
    const resp = await axios.post(
      `https://${HUNYUAN_HOST}/`,
      payload,
      {
        headers: {
          'Content-Type': 'application/json; charset=utf-8',
          Host: HUNYUAN_HOST,
          'X-TC-Action': 'ChatCompletions',
          'X-TC-Version': HUNYUAN_VERSION,
          'X-TC-Region': 'ap-guangzhou',
          'X-TC-Timestamp': String(timestamp),
          Authorization: authorization,
        },
      }
    );
    const d = resp.data?.Response || {};
    if (d.Error) throw new Error(`混元错误：${d.Error.Code} ${d.Error.Message}`);
    return {
      reply: d.Choices?.[0]?.Message?.Content || d.Reply || '',
      provider: 'hunyuan',
      model: resolved,
      usage: d.Usage,
    };
  }
}

/* ------------------------------ 注册表 ------------------------------ */
function buildProviders(): GatewayProvider[] {
  const production = process.env.NODE_ENV === 'production';
  const mockMode = !production && process.env.ENABLE_MOCK_MODE === 'true';
  const list: GatewayProvider[] = [];
  if (mockMode) {
    list.push(new MockGatewayProvider());
    return list;
  }
  // Agnes AIHub（免费模型网关，OpenAI 兼容：文本/图像/视频）
  if (process.env.AGNES_API_KEY)
    list.push(
      new OpenAICompatibleProvider(
        'agnes',
        'Agnes AIHub',
        process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1',
        process.env.AGNES_API_KEY,
        'agnes',
        ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0']
      )
    );
  if (process.env.OPENAI_API_KEY)
    list.push(
      new OpenAICompatibleProvider('openai', 'OpenAI', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY, 'openai', ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'])
    );
  if (process.env.ANTHROPIC_API_KEY)
    list.push(new OpenAICompatibleProvider('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', process.env.ANTHROPIC_API_KEY, 'anthropic', ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']));
  if (process.env.DEEPSEEK_API_KEY)
    list.push(new OpenAICompatibleProvider('deepseek', 'DeepSeek', 'https://api.deepseek.com/v1', process.env.DEEPSEEK_API_KEY, 'deepseek', ['deepseek-v4-pro', 'deepseek-v4-flash']));
  // 智谱 GLM（OpenAI 兼容）
  if (process.env.ZHIPU_API_KEY)
    list.push(new OpenAICompatibleProvider('zhipu', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', process.env.ZHIPU_API_KEY, 'zhipu', ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long']));
  // 通义千问（阿里云 DashScope，OpenAI 兼容）
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY)
    list.push(new OpenAICompatibleProvider('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY!, 'qwen', ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen-vl-max']));
  // 豆包（火山方舟，OpenAI 兼容）
  if (process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY)
    list.push(new OpenAICompatibleProvider('doubao', '豆包', 'https://ark.cn-beijing.volces.com/api/v3', process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY!, 'doubao', ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k']));
  if (process.env.HUNYUAN_SECRET_ID && process.env.HUNYUAN_SECRET_KEY)
    list.push(new HunyuanGatewayProvider());
  return list;
}

let PROVIDERS = buildProviders();

/**
 * 第三方自定义模型（用户 ModelConfig）注入网关。
 * 这是「接入第三方模型 API」闭环的关键：用户在前端保存的 OpenAI 兼容端点
 * 会被加载为独立 provider，前缀为 `mc_<configId>`，聊天路由据此寻址。
 */
import { ModelConfig } from '../models/ModelConfig';
import { decryptSecret } from '../lib/crypto';

let CUSTOM_PROVIDERS: GatewayProvider[] = [];

/**
 * 从数据库加载启用的 ModelConfig 作为自定义 provider。
 * 单测可传入 injected（不触库）以验证路由行为。
 */
export async function reloadCustomProviders(injected?: any[]): Promise<void> {
  let cfgs = injected;
  if (!cfgs) {
    try {
      cfgs = await ModelConfig.find({ enabled: true }).lean();
    } catch {
      cfgs = [];
    }
  }
  CUSTOM_PROVIDERS = (cfgs || []).map((c: any) => {
    const id = String(c._id);
    const prefix = `mc_${id}`;
    // 安全：apiKey 密文落库，加载到网关时解密为明文使用
    const apiKey = decryptSecret(c.apiKey || '');
    return new OpenAICompatibleProvider(
      prefix as GatewayProviderName,
      c.name || `自定义(${c.provider})`,
      c.baseURL,
      apiKey,
      prefix,
      (c.models && c.models.length > 0 ? c.models : [c.defaultModel])
    );
  });
}

/** 热重载 provider 注册表（配置变更后调用） */
export function reloadGatewayProviders(): void {
  PROVIDERS = buildProviders();
}

/** 全部可用 provider（内置 + 第三方自定义），供路由与列表使用 */
function allProviders(): GatewayProvider[] {
  return [...PROVIDERS, ...CUSTOM_PROVIDERS];
}

export function listGatewayProviders() {
  return allProviders().map((p) => ({ name: p.name, label: p.label, configured: p.isConfigured() }));
}

/** 列出全部可选模型（内置 + 第三方自定义），供前端模型选择器 */
export function listGatewayModels() {
  const out: { provider: string; label: string; models: string[]; custom?: boolean }[] = [];
  for (const p of PROVIDERS) {
    if (p.name === 'mock') continue;
    out.push({ provider: p.name, label: p.label, models: p.models ? p.models() : [] });
  }
  for (const p of CUSTOM_PROVIDERS) {
    out.push({ provider: p.name, label: p.label, models: p.models ? p.models() : [], custom: true });
  }
  return out;
}

/* ------------------------------ 路由策略 ------------------------------ */
/**
 * priority fallback 策略：按注册顺序尝试，第一个 configured 且能服务的 provider 先上；
 * 调用失败则依次降级到下一个。与 OmniRoute 的 priority combo 一致。
 */
export async function route(req: ChatRouteRequest): Promise<ChatRouteResult> {
  if (
    process.env.NODE_ENV === 'production'
    && (req.provider === 'mock' || req.model === 'mock' || req.model?.startsWith('mock/'))
  ) {
    throw new AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
  }
  const ALL = allProviders();
  let target: GatewayProvider | undefined;

  // 1. 显式 provider 优先（含第三方自定义 mc_xxx）
  if (req.provider) {
    target = ALL.find((p) => p.name === req.provider && p.isConfigured());
  }

  // 2. 前缀寻址（如 "deepseek/deepseek-v4-flash" 或 "mc_abc/glm-4"）
  if (!target && req.model) {
    target = ALL.find((p) => p.isConfigured() && p.owns(req.model!));
  }

  // 3. 默认策略：走 aiModelManager 默认 provider；否则第一个 configured
  if (!target) {
    const def = aiModelManager.getDefaultProvider();
    const defName = def?.name.toLowerCase() as GatewayProviderName;
    target = ALL.find((p) => p.name === defName && p.isConfigured()) || ALL.find((p) => p.isConfigured());
  }

  if (!target) throw new Error('没有可用的真实 AI provider（生产环境禁止 Mock，请配置厂商 Key）');

  // fallback：从该 provider 起，依次尝试后续 configured provider（内置 + 自定义）
  const startIdx = ALL.indexOf(target);
  const order = [...ALL.slice(startIdx), ...ALL.slice(0, startIdx)].filter((p) => p.isConfigured());
  let lastErr: any;
  for (const p of order) {
    try {
      const fallbackModel = p.owns(req.model || '') ? (req.model || '') : (p.models()?.[0] || ''); return await p.chat(req, fallbackModel);
    } catch (e) {
      lastErr = e;
      logger.warn('ai-gateway', `provider ${p.name} 失败，尝试降级：${(e as Error).message}`);
    }
  }
  throw lastErr || new Error('所有 provider 均不可用');
}
