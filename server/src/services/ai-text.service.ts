import { aiModelManager, createAIClient, type AIProvider } from '../config/ai-models';
import { callCloudbaseChat } from './cloudbase-ai.service';
import { logger } from '../lib/logger';

export interface GenerateTextOptions {
  system?: string;
  user: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 统一的真实文本生成入口：
 * 1) 优先使用平台已配置的第三方模型 Provider（用户自带 Key 或平台 Key）；
 * 2) 若未配置或调用失败，自动回退到 CloudBase 免费云函数（hy3-preview），
 *    保证始终产出真实内容、绝不返回模拟/假数据。
 */
export async function generateText(
  opts: GenerateTextOptions
): Promise<{ text: string; provider: string; model: string }> {
  const { system, user, temperature = 0.7, maxTokens } = opts;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const provider =
    opts.provider || (aiModelManager.getDefaultProvider()?.name.toLowerCase() as AIProvider | undefined);

  if (provider && provider !== 'mock') {
    try {
      const cfg = aiModelManager.getProvider(provider);
      if (cfg && cfg.apiKey && cfg.apiKey !== 'mock-key') {
        const client = createAIClient(provider);
        const completion = await client.chat.completions.create({
          model: opts.model || cfg.defaultModel,
          messages,
          temperature,
          ...(maxTokens ? { max_tokens: maxTokens } : {}),
        });
        const text = completion.choices[0]?.message?.content?.trim() || '';
        if (text) return { text, provider, model: opts.model || cfg.defaultModel };
      }
    } catch (err: any) {
      logger.warn('ai-text', `provider ${provider} 调用失败，回退免费云函数: ${err?.message}`);
    }
  }

  // 回退到 CloudBase 免费云函数（消耗小程序成长计划免费额度）
  const text = await callCloudbaseChat(messages, 'hy3-preview');
  return { text, provider: 'cloudbase-free', model: 'hy3-preview' };
}
