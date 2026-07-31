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
import { DEFAULT_TEXT_AI_MODEL } from '../config/default-ai-model';
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
  | 'cloudbase'
  | 'agnes'
  | 'agnes25'
  | 'siliconflow'
  | 'openrouter'
  | 'moonshot'
  | 'groq'
  | 'gemini';

export interface ChatRouteRequest {
  /** 支持前缀寻址，如 "hunyuan/hunyuan-pro" 或 "deepseek/deepseek-v4-flash"；缺省走策略选择 */
  model?: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  maxTokens?: number;
  /** 强制指定 provider（绕过策略与 fallback） */
  provider?: GatewayProviderName;
  /** 面向终端用户的公开调用必须排除服务端私有 Provider */
  publicOnly?: boolean;
  /**
   * 会员等级路由：
   *  - 'free'：仅允许落到「免费/近免费厂商池」（cloudbase / siliconflow / zhipu / gemini / groq / agnes），
   *            防止免费用户请求兜底时漏到 OpenRouter / 混元 / DeepSeek 等付费批发通道产生成本；
   *  - 'paid' 或 缺省：不限制，付费用户可使用全部已配置通道（含高端 GPT / 批发模型）。
   */
  tier?: 'free' | 'paid';
  /** 单 provider 调用超时 (ms)，默认 3500；代码解释等长耗时场景可调大到 12000 */
  timeoutMs?: number;
  /** 整条 fallback 链总耗时预算 (ms)；用于客服等交互接口防止多 provider 超时叠加 */
  totalTimeoutMs?: number;
}

export interface ChatRouteResult {
  reply: string;
  provider: GatewayProviderName;
  model: string;
  usage?: any;
}

export function getEffectiveProviderTimeout(
  providerTimeoutMs: number,
  totalTimeoutMs: number | undefined,
  elapsedMs: number
): number {
  if (!Number.isFinite(totalTimeoutMs) || (totalTimeoutMs as number) <= 0) return providerTimeoutMs;
  return Math.max(0, Math.min(providerTimeoutMs, (totalTimeoutMs as number) - elapsedMs));
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
    public baseURL: string,
    public apiKey: string,
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

/* ------------------------------ CloudBase AI Gateway Provider ------------------------------ */
// CloudBase AI Gateway 兼容 OpenAI Chat Completions。优先使用服务端 API Key 直连，
// 并保留 ai-chat 云函数作为旧环境或网关不可用时的兼容回退。
class CloudbaseChatProvider implements GatewayProvider {
  name = 'cloudbase' as const;
  label = 'CloudBase AI';
  private modelList = ['hunyuan-2.0-instruct-20251111'];
  private get baseURL() {
    return process.env.CLOUDBASE_FREE_BASE_URL || '';
  }
  private get apiKey() {
    return process.env.CLOUDBASE_FREE_API_KEY || '';
  }
  private get functionURL() {
    return process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL || '';
  }
  isConfigured() {
    return !!(this.baseURL && this.apiKey) || !!this.functionURL;
  }
  owns(model: string) {
    return model.startsWith('cloudbase/') || model === 'cloudbase' || this.modelList.includes(model);
  }
  models() {
    return this.modelList;
  }
  async chat(req: ChatRouteRequest, model: string): Promise<ChatRouteResult> {
    const rawModel = model.includes('/') ? model.split('/').slice(1).join('/') : model;
    if (this.baseURL && this.apiKey) {
      const client = new OpenAI({ apiKey: this.apiKey, baseURL: this.baseURL });
      const completion = await client.chat.completions.create({
        model: rawModel,
        messages: req.messages as any,
        temperature: req.temperature ?? 0.7,
        max_tokens: req.maxTokens ?? 2000,
      });
      return {
        reply: completion.choices[0]?.message?.content || '',
        provider: 'cloudbase',
        model: rawModel,
        usage: completion.usage,
      };
    }

    const resp = await axios.post(
      this.functionURL,
      { messages: req.messages, model: rawModel, stream: false },
      { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
    );
    if (resp.data?.success) {
      return {
        reply: resp.data.text || '',
        provider: 'cloudbase',
        model: rawModel,
        usage: resp.data.usage,
      };
    }
    throw new Error(resp.data?.error || 'CLOUDBASE_FN_ERROR');
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
  // Agnes AI 2.5：全平台默认免费文本模型，优先暴露给所有模型选择器。
  if (process.env.AGNES25_API_KEY || process.env.AGNES_25_API_KEY)
    list.push(
      new OpenAICompatibleProvider(
        'agnes25',
        'Agnes AI 2.5（默认免费）',
        process.env.AGNES25_BASE_URL || process.env.AGNES_25_BASE_URL || 'https://api.agnes-ai.cn/v1',
        process.env.AGNES25_API_KEY || process.env.AGNES_25_API_KEY || '',
        'agnes25',
        ['agnes-2.5-flash']
      )
    );
  // 旧 Agnes AIHub 保留文本/图像/视频能力，供手动选择和媒体任务使用。
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
  // 腾讯云 CloudBase「小程序免费计划」额度：支持 AI Gateway 直连或旧云函数中转。
  // 两种接入任一完整配置即可注册，避免已配置 BASE_URL + API_KEY 时被错误隐藏。
  const cloudbaseGatewayConfigured = !!(
    process.env.CLOUDBASE_FREE_BASE_URL && process.env.CLOUDBASE_FREE_API_KEY
  );
  if (cloudbaseGatewayConfigured || process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL)
    list.push(new CloudbaseChatProvider());
  if (process.env.OPENAI_API_KEY)
    list.push(
      new OpenAICompatibleProvider('openai', 'OpenAI', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY, 'openai', ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo'])
    );
  if (process.env.ANTHROPIC_API_KEY)
    list.push(new OpenAICompatibleProvider('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', process.env.ANTHROPIC_API_KEY, 'anthropic', ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']));
  // DeepSeek 自购接口仅供服务端内部调用，不会进入公开模型列表或公开 fallback。
  if (process.env.DEEPSEEK_API_KEY)
    list.push(
      new OpenAICompatibleProvider(
        'deepseek',
        'DeepSeek（私有）',
        process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1',
        process.env.DEEPSEEK_API_KEY,
        'deepseek',
        ['deepseek-v4-pro', 'deepseek-v4-flash']
      )
    );

  // 智谱 GLM（OpenAI 兼容）
  if (process.env.ZHIPU_API_KEY)
    list.push(new OpenAICompatibleProvider('zhipu', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', process.env.ZHIPU_API_KEY, 'zhipu', ['glm-4.7-flash', 'glm-4-flash', 'glm-4-air', 'glm-4-plus', 'glm-4-long']));
  // 通义千问（阿里云 DashScope，OpenAI 兼容）
  if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY)
    list.push(new OpenAICompatibleProvider('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY!, 'qwen', ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen-vl-max']));
  // 豆包（火山方舟，OpenAI 兼容）
  if (process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY)
    list.push(new OpenAICompatibleProvider('doubao', '豆包', 'https://ark.cn-beijing.volces.com/api/v3', process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY!, 'doubao', ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k']));
  if (process.env.HUNYUAN_SECRET_ID && process.env.HUNYUAN_SECRET_KEY)
    list.push(new HunyuanGatewayProvider());
  // ── 免费引流层（零/极低成本，可商用，适合免费用户与引流场景）──
  // 硅基流动 SiliconFlow：仅「9B 以下开源模型永久免费」（Qwen2.5-7B 等），国产直连，OpenAI 兼容。
  // 注意：DeepSeek-V4-Flash / V3 在 SiliconFlow 上为付费档，不属于免费层，故不列入。
  if (process.env.SILICONFLOW_API_KEY)
    list.push(new OpenAICompatibleProvider('siliconflow', '硅基流动', 'https://api.siliconflow.cn/v1', process.env.SILICONFLOW_API_KEY, 'siliconflow', ['Qwen/Qwen2.5-7B-Instruct', 'Qwen/Qwen3-8B']));
  // ── 批发层（透明 pass-through / 直连云厂，低成本可商用，适合付费用户）──
  // OpenRouter：400+ 模型 pass-through 计费（仅 5.5% 信用费，无 token 加价），企业协议可谈量价
  if (process.env.OPENROUTER_API_KEY)
    list.push(new OpenAICompatibleProvider('openrouter', 'OpenRouter', 'https://openrouter.ai/api/v1', process.env.OPENROUTER_API_KEY, 'openrouter', ['deepseek/deepseek-v4-flash', 'qwen/qwen3-235b-a22b', 'google/gemini-2.5-flash', 'anthropic/claude-3.5-haiku']));
  // 月之暗面 Kimi（Moonshot）：有免费额度，OpenAI 兼容
  if (process.env.MOONSHOT_API_KEY)
    list.push(new OpenAICompatibleProvider('moonshot', 'Kimi', 'https://api.moonshot.cn/v1', process.env.MOONSHOT_API_KEY, 'moonshot', ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k']));
  // Groq：Llama 系免费层（高速），OpenAI 兼容
  if (process.env.GROQ_API_KEY)
    list.push(new OpenAICompatibleProvider('groq', 'Groq', 'https://api.groq.com/openai/v1', process.env.GROQ_API_KEY, 'groq', ['llama-3.1-8b-instant', 'llama-3.3-70b-versatile', 'llama-3.2-11b-vision-preview']));
  // Google Gemini：2.5 Flash 免费层（需公网可达，国内建议走代理/专线路由），OpenAI 兼容端点
  if (process.env.GEMINI_API_KEY)
    list.push(new OpenAICompatibleProvider('gemini', 'Gemini', 'https://generativelanguage.googleapis.com/v1beta/openai/', process.env.GEMINI_API_KEY, 'gemini', ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-2.5-pro']));
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

/** 服务端私有 Provider 保留内部调用能力，但不允许公开枚举、显式寻址或 fallback。 */
const PRIVATE_PROVIDER_NAMES = new Set<GatewayProviderName>(['deepseek']);

/** 全部可用 provider（内置 + 第三方自定义），供内部路由使用 */
function allProviders(): GatewayProvider[] {
  return [...PROVIDERS, ...CUSTOM_PROVIDERS];
}

function publicProviders(): GatewayProvider[] {
  return allProviders().filter((p) => !PRIVATE_PROVIDER_NAMES.has(p.name));
}

export function listGatewayProviders() {
  return publicProviders().map((p) => ({ name: p.name, label: p.label, configured: p.isConfigured() }));
}

/** 列出全部可选模型（内置 + 第三方自定义），供前端模型选择器
 *  如果自定义 provider 与内置 provider 指向同一 API（同 baseURL + apiKey），
 *  则内置 provider 的模型列表会以自定义 provider 为主，避免重复。 */
export function listGatewayModels() {
  const out: { provider: string; label: string; models: string[]; custom?: boolean }[] = [];
  
  // 收集自定义 provider 的 baseURL 和 apiKey 用于去重
  const customDedup = new Map<string, string[]>();
  for (const p of CUSTOM_PROVIDERS) {
    if (p instanceof OpenAICompatibleProvider) {
      const key = p.baseURL + '|' + p.apiKey;
      customDedup.set(key, p.models());
    }
  }
  
  for (const p of PROVIDERS) {
    if (p.name === 'mock' || PRIVATE_PROVIDER_NAMES.has(p.name)) continue;
    const models = p.models ? p.models() : [];
    
    // 检查是否与自定义 provider 重复（同 baseURL + apiKey）
    if (p instanceof OpenAICompatibleProvider) {
      const key = p.baseURL + '|' + p.apiKey;
      if (customDedup.has(key)) {
        // 跳过：自定义 provider 已覆盖此 API
        continue;
      }
    }
    
    out.push({ provider: p.name, label: p.label, models });
  }
  
  for (const p of CUSTOM_PROVIDERS) {
    out.push({ provider: p.name, label: p.label, models: p.models ? p.models() : [], custom: true });
  }
  return out;
}

/* ------------------------------ 路由策略 ------------------------------ */
/**
 * 免费/近免费厂商池：免费用户（tier='free'）只允许落到这些 provider，避免兜底时漏到
 * OpenRouter / 混元 / DeepSeek 等付费批发通道产生成本。这些厂商均有免费层或免费额度：
 *  - cloudbase：小程序成长计划免费额度
 *  - siliconflow：9B 以下开源模型永久免费（Qwen2.5-7B 等）
 *  - zhipu：GLM-4.7-Flash / GLM-4-Flash 官方免费层
 *  - gemini：Gemini 2.5 Flash 免费层
 *  - groq：Llama 系免费层
 *  - agnes：Agnes AIHub 免费模型网关（旧模型保留）
 *  - agnes25：Agnes AI 2.5 独立端点（新增 agnes-2.5-flash）
 */
const FREE_TIER_PROVIDER_NAMES = new Set<GatewayProviderName>([
  'cloudbase', 'siliconflow', 'zhipu', 'gemini', 'groq', 'agnes', 'agnes25',
]);

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
  // reject deprecated model names at gateway level
  const effectiveModel = req.model || DEFAULT_TEXT_AI_MODEL;
  const DEPRECATED=new Set(["deepseek-chat","deepseek-coder","gpt-3.5-turbo","gpt-4"]);
  const mName=effectiveModel.split("/").pop()||"";
  if(DEPRECATED.has(mName)){throw new AppError(400,String.fromCharCode(34)+"Model "+JSON.stringify(mName)+" is deprecated"+String.fromCharCode(34),"DEPRECATED_MODEL");}
  const requestedProvider = req.provider || (effectiveModel.includes('/') ? effectiveModel.split('/')[0] as GatewayProviderName : undefined);
  if (req.publicOnly && requestedProvider && PRIVATE_PROVIDER_NAMES.has(requestedProvider)) {
    throw new AppError(403, '该模型不对外开放', 'AI_PROVIDER_PRIVATE');
  }

  const BASE = req.publicOnly ? publicProviders() : allProviders();
  // 会员等级路由：免费用户强制限定在免费厂商池，阻断漏到付费批发通道
  const ALL = req.tier === 'free'
    ? BASE.filter((p) => FREE_TIER_PROVIDER_NAMES.has(p.name as GatewayProviderName))
    : BASE;
  let target: GatewayProvider | undefined;

  // 1. 显式 provider 优先（含第三方自定义 mc_xxx）
  if (req.provider) {
    target = ALL.find((p) => p.name === req.provider && p.isConfigured());
  }

  // 2. 前缀寻址（如 "deepseek/deepseek-v4-flash" 或 "mc_abc/glm-4"）
  if (!target && effectiveModel) {
    target = ALL.find((p) => p.isConfigured() && p.owns(effectiveModel));
  }

  // 3. 默认策略：走 aiModelManager 默认 provider；否则第一个 configured
  if (!target) {
    const def = aiModelManager.getDefaultProvider();
    const defName = def?.name.toLowerCase() as GatewayProviderName;
    target = ALL.find((p) => p.name === defName && p.isConfigured()) || ALL.find((p) => p.isConfigured());
  }

  if (!target) throw new Error('没有可用的真实 AI provider（生产环境禁止 Mock，请配置厂商 Key）');

  // 单 provider 调用超时包装：避免下游 AI 服务挂起（如 cloudbase 云函数偶发卡死）拖垮整体请求
  const withTimeout = <T>(promise: Promise<T>, ms: number, msg: string): Promise<T> => {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(msg)), ms);
      promise.then(
        (v) => { clearTimeout(timer); resolve(v); },
        (err) => { clearTimeout(timer); reject(err); }
      );
    });
  };

  // fallback：从默认 provider 起依次尝试；每个调用加超时，防止下游挂起拖垮整体（前端 10s 超时）
  const startIdx = ALL.indexOf(target);
  const order = [...ALL.slice(startIdx), ...ALL.slice(0, startIdx)].filter((p) => p.isConfigured());
  let lastErr: any;
  let emptyResult: ChatRouteResult | undefined; // 记录「成功但空内容」的结果，作为所有 provider 都空时的兜底返回
  const routeStartedAt = Date.now();
  const configuredTotalTimeout = Number(req.totalTimeoutMs);
  const totalTimeout = Number.isFinite(configuredTotalTimeout) && configuredTotalTimeout > 0
    ? configuredTotalTimeout
    : undefined;
  for (const p of order) {
    try {
      const fallbackModel = p.owns(effectiveModel) ? effectiveModel : (p.models()?.[0] || '');
      // 单 provider 超时不能简单累加；若调用方给出总预算，每次只使用剩余时间。
      const providerTimeout = req.timeoutMs || 3500;
      const remainingMs = getEffectiveProviderTimeout(
        providerTimeout,
        totalTimeout,
        Date.now() - routeStartedAt
      );
      if (remainingMs <= 0) {
        lastErr = new AppError(504, 'AI 服务响应超时，请稍后重试', 'AI_GATEWAY_TIMEOUT');
        break;
      }
      const r = await withTimeout(p.chat(req, fallbackModel), remainingMs, `provider ${p.name} 调用超时`);
      // 关键：空内容视为「本 provider 失败」并降级到下一个。
      // 免费通道（如 agnes 免费层）偶发 HTTP 200 但 content 为空，若当成功返回会导致
      // 上层（如视频流水线调研阶段）拿到空串直接失败。改为继续尝试下一个可用 provider。
      if (r?.reply && r.reply.trim()) return r;
      emptyResult = r;
      lastErr = new Error(`provider ${p.name} 返回空内容`);
      logger.warn('ai-gateway', `provider ${p.name} 返回空内容，尝试降级到下一个 provider`);
    } catch (e) {
      lastErr = e;
      logger.warn('ai-gateway', `provider ${p.name} 失败，尝试降级：${(e as Error).message}`);
    }
  }
  // 所有 provider 均返回空内容（无异常）：返回最后一个空结果，交由上层决定如何处理，
  // 避免把「全部空返回」误报成通用异常，保留真实 provider 元数据。
  if (emptyResult) return emptyResult;
  // 收集所有 provider 失败原因，返回有帮助的诊断信息
  const providerErrors = order.map(p => `${p.name}: ${p.isConfigured() ? '已配置但调用失败' : '未配置'}`).join('; ');
  const errMsg = `所有 AI 模型暂时不可用（${providerErrors}）。请检查 AI 厂商 API Key 配置或稍后重试。`;
  if (lastErr instanceof AppError) throw lastErr;
  throw new AppError(502, errMsg, 'AI_ALL_PROVIDERS_DOWN');
}
