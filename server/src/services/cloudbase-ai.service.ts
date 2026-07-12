import axios from 'axios';
import { logger } from '../lib/logger';

// CloudBase ai-chat 云函数 HTTP 地址（消耗小程序成长计划免费额度）
const CLOUDBASE_CHAT_URL =
  process.env.CLOUDBASE_CHAT_URL ||
  'https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat';

// 免费额度下支持的 4 个模型（2 文本 + 2 图像）
export const AIBAK_MODELS = {
  text: ['hy3', 'hy3-preview'],
  image: ['HY-Image-3.0-Plus-4090-Tob-v1.0', 'HY-Image-v3.0-I2I-ToB-v1.0.1'],
};

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
