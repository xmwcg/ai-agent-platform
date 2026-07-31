import { getPreferredAgnesTextModel, type AIProvider } from '../config/ai-models';
import { route, type GatewayProviderName } from '../gateway/ai-gateway.service';

export interface GenerateTextOptions {
  system?: string;
  user: string;
  provider?: AIProvider;
  model?: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * 全平台统一文本生成入口。
 * 未显式选择模型时固定使用 Agnes 2.5；网关统一负责厂商调用、超时与故障转移。
 */
export async function generateText(
  opts: GenerateTextOptions
): Promise<{ text: string; provider: string; model: string }> {
  const { system, user, temperature = 0.7, maxTokens } = opts;
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: user });

  const result = await route({
    model: opts.model || getPreferredAgnesTextModel(),
    provider: opts.provider as GatewayProviderName | undefined,
    messages,
    temperature,
    ...(maxTokens ? { maxTokens } : {}),
    timeoutMs: 30_000,
    totalTimeoutMs: 60_000,
  });

  return { text: result.reply, provider: result.provider, model: result.model };
}
