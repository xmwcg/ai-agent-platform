/**
 * Token 计费服务 — NexMind 开放 API 市场按量计费引擎
 * 基于报告建议：在 AI Gateway 调用前后计数 token，按模型定价实时扣费
 * 定价数据来源：国内大模型API中转与批发渠道深度调研报告 第二节
 */

import { ApiKey, IApiKey } from '../models/ApiKey';
import { ApiUsageLog } from '../models/ApiUsageLog';
import { logger } from '../lib/logger';

// 模型定价（元/百万 token）— 数据来源 2026-07 各厂商官网
const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  // DeepSeek
  'deepseek-chat': { input: 1, output: 2 },
  'deepseek-reasoner': { input: 3, output: 6 },
  // 智谱 GLM（免费模型不计价）
  'glm-4-flash': { input: 0, output: 0 },
  'glm-4-air': { input: 1, output: 1 },
  // 通义千问（阿里百炼）
  'qwen-turbo': { input: 0.3, output: 0.6 },
  'qwen-plus': { input: 0.8, output: 2 },
  // 豆包（火山方舟）
  'doubao-lite': { input: 0.3, output: 0.6 },
  'doubao-pro': { input: 0.8, output: 2 },
  // OpenAI 兼容（批发价）
  'gpt-4o-mini': { input: 1.1, output: 4.4 },
  'gpt-4o': { input: 18, output: 54 },
  // Kimi
  'moonshot-v1': { input: 12, output: 12 },
  // 默认（未知模型按中位数计）
  'default': { input: 1, output: 2 },
};

export interface TokenChargeResult {
  /** 是否成功扣费 */
  success: boolean;
  /** 扣费金额（元） */
  cost: number;
  /** 扣费后余额（元） */
  remainingBalance: number;
  /** 模型名 */
  model: string;
  /** 失败原因 */
  reason?: string;
}

/**
 * 按模型和 token 用量计算费用
 */
export function calculateTokenCost(model: string, usage: { prompt_tokens?: number; completion_tokens?: number }): number {
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  const inputTokens = usage.prompt_tokens || 0;
  const outputTokens = usage.completion_tokens || 0;
  // 价格单位：元/百万token → 除以 1,000,000
  return (inputTokens * pricing.input + outputTokens * pricing.output) / 1_000_000;
}

/**
 * 对一次 API 调用进行计费
 *
 * @param apiKey - 用户的 API Key 文档
 * @param model - 请求的模型名
 * @param usage - 返回的 token 用量
 * @returns 计费结果
 */
export async function chargeApiCall(
  apiKey: IApiKey,
  model: string,
  usage: { prompt_tokens?: number; completion_tokens?: number },
): Promise<TokenChargeResult> {
  const cost = calculateTokenCost(model, usage);

  // 免费模型不计费
  const pricing = MODEL_PRICING[model] || MODEL_PRICING['default'];
  if (pricing.input === 0 && pricing.output === 0) {
    const log = new ApiUsageLog({
      apiKeyId: apiKey._id,
      ownerId: apiKey.ownerId,
      model,
      provider: model,
      status: 'free',
      tokensInput: usage.prompt_tokens || 0,
      tokensOutput: usage.completion_tokens || 0,
      cost: 0,
      ip: '',
      ua: '',
    });
    await log.save();
    return { success: true, cost: 0, remainingBalance: 0, model };
  }

  // 检查日配额
  const now = new Date();
  if (apiKey.lastReset && !isSameDay(apiKey.lastReset, now)) {
    apiKey.usedToday = 0;
    apiKey.lastReset = now;
  }
  if (apiKey.usedToday >= apiKey.quotaDaily) {
    return {
      success: false,
      cost: 0,
      remainingBalance: 0,
      model,
      reason: '日配额已耗尽',
    };
  }

  // 累加日用量
  apiKey.usedToday += 1;
  await (apiKey as any).save();

  // 记录用量日志
  const log = new ApiUsageLog({
    apiKeyId: apiKey._id,
    ownerId: apiKey.ownerId,
    model,
    provider: model,
    status: 'success',
    tokensInput: usage.prompt_tokens || 0,
    tokensOutput: usage.completion_tokens || 0,
    cost,
    ip: '',
    ua: '',
  });
  await log.save();

  logger.info('token-billing', `charged ¥${cost.toFixed(6)} for ${model}`, {
    keyId: apiKey._id,
    ownerId: apiKey.ownerId,
    tokens: (usage.prompt_tokens || 0) + (usage.completion_tokens || 0),
  });

  return {
    success: true,
    cost,
    remainingBalance: 0,
    model,
  };
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export default { calculateTokenCost, chargeApiCall };
