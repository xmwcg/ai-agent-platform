/** 统一 AI 服务：默认使用 Agnes 2.5，供幻灯片等遗留模块复用。 */
import { getPreferredAgnesTextModel } from '../config/ai-models';
import { listGatewayModels, route } from '../gateway/ai-gateway.service';

interface CallAIParams {
  system?: string;
  user?: string;
  temperature?: number;
  maxTokens?: number;
  model?: string;
}

export async function callAI(params: CallAIParams): Promise<{ content: string }> {
  const result = await route({
    model: params.model || getPreferredAgnesTextModel(),
    messages: [
      ...(params.system ? [{ role: 'system' as const, content: params.system }] : []),
      { role: 'user' as const, content: params.user || '' },
    ],
    temperature: params.temperature ?? 0.7,
    maxTokens: params.maxTokens ?? 3000,
    timeoutMs: 30_000,
    totalTimeoutMs: 60_000,
  });
  return { content: result.reply };
}

export async function checkAIAvailability(): Promise<{ available: boolean; model?: string }> {
  const preferred = getPreferredAgnesTextModel();
  const [provider, model] = preferred.split('/', 2);
  const available = listGatewayModels().some(
    (group) => group.provider === provider && group.models.includes(model)
  );
  return { available, model: preferred };
}
