import axios from 'axios';
const tcb = require('@cloudbase/node-sdk');
import { logger } from '../lib/logger';

// ================================================================
//  CloudBase 双通道 AI 配置
//  通道1：jymkjtools-study 云函数代理 → 跨环境消耗 jymkj-knowlage 额度
//  通道2：jymkj-knowlage @cloudbase/node-sdk 直调 → 直接消耗本环境额度
//         （小程序成长计划只允许 SDK 调用，不允许网关直调）
// ================================================================

// ── 通道1：jymkjtools-study 云函数（现有 AI客服/免费体验 不动） ──
const CLOUDBASE_CHAT_URL =
  process.env.CLOUDBASE_CHAT_URL ||
  'https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat';

// ── 通道2：jymkj-knowlage SDK 直调（新增给左侧AI对话） ──
const KNOWLEDGE_ENV_ID = 'jymkj-knowlage-d8gmhvqyq1051579d';
const KNOWLEDGE_SECRET_ID = process.env.CLOUDBASE_KNOWLEDGE_SECRET_ID || '';
const KNOWLEDGE_SECRET_KEY = process.env.CLOUDBASE_KNOWLEDGE_SECRET_KEY || '';

// 短模型名到完整模型 ID 的映射
const SDK_MODEL_MAP: Record<string, string> = {
  'hy3': 'hunyuan-2.0-instruct-20251111',
  'hy3-preview': 'hunyuan-turbos-latest',
  'deepseek-v4': 'deepseek-v4-flash',
  'deepseek-v3': 'deepseek-v3.2',
  'kimi-k2': 'kimi-k2.6',
  'glm-5': 'glm-5',
};

/** 延迟初始化 jymkj-knowlage SDK 实例（避免启动时阻塞） */
let _knowledgeApp: any = null;
function getKnowledgeApp() {
  if (_knowledgeApp) return _knowledgeApp;
  if (!KNOWLEDGE_SECRET_ID || !KNOWLEDGE_SECRET_KEY) return null;
  _knowledgeApp = tcb.init({
    env: KNOWLEDGE_ENV_ID,
    secretId: KNOWLEDGE_SECRET_ID,
    secretKey: KNOWLEDGE_SECRET_KEY,
    timeout: 60000,
  });
  logger.info('cloudbase-sdk', `jymkj-knowlage SDK 已初始化, env=${KNOWLEDGE_ENV_ID}`);
  return _knowledgeApp;
}

// 免费额度下支持的 4 个模型（2 文本 + 2 图像）
export const AIBAK_MODELS = {
  text: ['hy3', 'hy3-preview'],
  image: ['HY-Image-3.0-Plus-4090-Tob-v1.0', 'HY-Image-v3.0-I2I-ToB-v1.0.1'],
};

// 图像生成云函数地址（默认由 chat 云函数 URL 推导同名 ai-image 函数，jymkjtools-study 免费额度）
const CLOUDBASE_IMAGE_URL =
  process.env.CLOUDBASE_IMAGE_URL ||
  CLOUDBASE_CHAT_URL.replace(/\/ai-chat$/, '/ai-image');

/**
 * 调用 CloudBase ai-chat 云函数（小程序成长计划免费额度）生成文本。
 * 抽离为独立服务，供知识库 RAG、翻译、方案生成、开放 API 市场等模块统一复用。
 * @returns 模型返回的文本
 * @throws 当云函数不可用或返回失败时
 */
export async function callCloudbaseChat(
  chatMessages: Array<{ role: string; content: string }>,
  model = 'hy3'
): Promise<string> {
  const response = await axios.post(
    CLOUDBASE_CHAT_URL,
    { messages: chatMessages, model, stream: false },
    { headers: { 'Content-Type': 'application/json' }, timeout: 60000 }
  );
  if (response.data?.success) return response.data.text as string;
  throw new Error(response.data?.error || 'CLOUDBASE_ERROR');
}

export interface CloudbaseImageOptions {
  size?: string;
  imageBase64?: string;
  imageUrl?: string;
}

/**
 * 调用 CloudBase ai-image 云函数（小程序成长计划免费额度）生成图像。
 * 支持文生图（HY-Image-3.0-Plus）与图生图（HY-Image-v3.0-I2I）。
 * @returns 图像 URL 数组（主图在前）
 * @throws 当云函数不可用或返回失败时
 */
export async function callCloudbaseImage(
  model: string,
  prompt: string,
  opts: CloudbaseImageOptions = {}
): Promise<string[]> {
  const isImage2Image = model.includes('I2I');
  const body: Record<string, any> = { model, prompt, size: opts.size || '1024x1024' };
  if (isImage2Image) {
    if (opts.imageBase64) body.imageBase64 = opts.imageBase64;
    else if (opts.imageUrl) body.image_urls = [opts.imageUrl];
  }
  const response = await axios.post(CLOUDBASE_IMAGE_URL, body, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 170000, // 图像生成可能较长，需小于云函数 180s 超时
  });
  if (!response.data?.success) throw new Error(response.data?.error || 'CLOUDBASE_IMAGE_ERROR');
  const images =
    response.data.data ||
    response.data.images ||
    (response.data.url ? [{ url: response.data.url }] : []) ||
    [];
  return images.map((i: any) => i?.url || i).filter(Boolean);
}

// ================================================================
//  jymkj-knowlage @cloudbase/node-sdk 直调（新增）
//   左侧 AI 对话主通道：用 SDK 直接消耗 jymkj-knowlage 免费额度
//   原因：小程序成长计划仅允许 SDK/小程序调用，不允许网关直调
// ================================================================

/** 检查 jymkj-knowlage SDK 是否已配置 */
export function isKnowledgeGatewayAvailable(): boolean {
  return !!(KNOWLEDGE_SECRET_ID && KNOWLEDGE_SECRET_KEY);
}

/** 获取 SDK 状态信息（供 status 路由使用） */
export function getKnowledgeGatewayInfo() {
  return {
    available: isKnowledgeGatewayAvailable(),
    method: '@cloudbase/node-sdk',
    env: KNOWLEDGE_ENV_ID,
    models: Object.keys(SDK_MODEL_MAP),
  };
}

/**
 * 通过 jymkj-knowlage @cloudbase/node-sdk 直接生成文本
 * 合规：小程序成长计划允许 SDK 调用（不允许 HTTP 网关直调）
 *
 * @param messages  对话消息数组
 * @param model     短模型名 (hy3, hy3-preview 等)，自动映射为完整 ID
 * @returns         模型生成的文本
 * @throws          SDK 未配置 / 模型返回错误 / 免费额度频控
 */
export async function callKnowledgeGatewayChat(
  messages: Array<{ role: string; content: string }>,
  model = 'hy3'
): Promise<string> {
  const app = getKnowledgeApp();
  if (!app) {
    throw new Error('JYMKJ_KNOWLEDGE_SDK_NOT_CONFIGURED');
  }

  const fullModel = SDK_MODEL_MAP[model] || model;

  try {
    const ai = app.ai();
    const chatModel = ai.createModel('hunyuan-exp');  // 小程序成长计划额度分组

    const res = await chatModel.generateText({
      model: fullModel,
      messages,
    });

    if (res.text) return res.text;

    if (res.error) {
      logger.error('knowledge-sdk', `SDK error: ${res.error.message || res.error}`);
      throw new Error(`SDK_ERROR: ${res.error.message || '未知错误'}`);
    }

    throw new Error('SDK_EMPTY_RESPONSE');
  } catch (err: any) {
    // 如果是我们抛出的已知错误，直接往上抛
    if (err.message?.startsWith('JYMKJ_KNOWLEDGE_SDK') ||
        err.message?.startsWith('SDK_')) {
      throw err;
    }

    // 频率限制
    if (err.code === 'FREQ_LIMIT' || err.message?.includes('freq') || err.message?.includes('limit')) {
      throw new Error('SDK_RATE_LIMIT: jymkj-knowlage 免费额度频控，请稍后重试');
    }

    // 配额耗尽
    if (err.code === 'INSUFFICIENT_QUOTA' || err.message?.includes('quota')) {
      throw new Error('SDK_QUOTA_EXHAUSTED: jymkj-knowlage 免费额度已用完');
    }

    // 鉴权错误
    if (err.code === 'SIGN_PARAM_INVALID' || err.code === 'INVALID_CREDENTIALS') {
      throw new Error('SDK_AUTH_ERROR: jymkj-knowlage SecretId/SecretKey 错误');
    }

    // SDK 其他错误
    logger.error('knowledge-sdk', `异常: ${err.message} (code=${err.code})`);
    throw new Error(`SDK_UNEXPECTED: ${err.message}`);
  }
}
