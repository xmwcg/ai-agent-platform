import { MediaUserKey } from '../../../models/MediaUserKey';
import { decryptSecret } from '../../../lib/crypto';
import { getPreferredAgnesTextModel } from '../../../config/ai-models';
import { route } from '../../../gateway/ai-gateway.service';

export interface ScriptResult {
  script: string;
}

/** 解析用户自带 DeepSeek Key（BYOK）；未配置时使用平台 Agnes 2.5。 */
async function resolveDeepseekKey(userId: string): Promise<string | null> {
  const rec = await MediaUserKey.findOne({ userId, provider: 'deepseek', enabled: true }).lean();
  if (rec?.secretKeyEnc) {
    try {
      return decryptSecret(rec.secretKeyEnc);
    } catch {
      /* 解密失败时回退平台 Agnes 2.5 */
    }
  }
  return null;
}

const STYLE_GUIDE: Record<string, string> = {
  种草带货: '强钩子开头、突出卖点与使用场景、结尾引导下单',
  知识科普: '结构清晰、分点易懂、权威可信',
  情感共鸣: '讲故事、引发情绪、自然带入产品',
  搞笑段子: '反转节奏、口语梗、轻松记忆点',
  测评对比: '客观参数对比、结论明确、打消顾虑',
};

export async function generateScript(
  topic: string,
  opts: { style?: string; length?: string; userId: string }
): Promise<ScriptResult> {
  const apiKey = await resolveDeepseekKey(opts.userId);
  const styleHint = STYLE_GUIDE[opts.style || ''] || '口语化、节奏紧凑、有钩子与转化引导';
  const sys =
    '你是一名资深短视频带货脚本编剧。输出可直接口播的脚本：语言口语化、节奏紧凑、有钩子与转化引导，不要使用括号动作描写，不要解释。';
  const user = `主题/商品：${topic}
风格要求：${styleHint}
篇幅：${opts.length || '约 200 字'}
请直接输出脚本正文。`;

  // 平台统一先调用 Agnes 2.5；只有网关全部不可用时，才使用用户自带 DeepSeek Key 兜底。
  try {
    const result = await route({
      model: getPreferredAgnesTextModel(),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      maxTokens: 1200,
      timeoutMs: 30_000,
      totalTimeoutMs: 60_000,
    });
    const agnesScript = result.reply?.trim() || '';
    if (agnesScript) return { script: agnesScript };
  } catch (agnesError) {
    if (!apiKey) throw agnesError;
  }

  if (!apiKey) throw new Error('Agnes 2.5 返回为空');
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.8,
      max_tokens: 1200,
    }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`Agnes 2.5 与 DeepSeek BYOK 均不可用(${resp.status}): ${text.slice(0, 200)}`);
  }
  const data: any = await resp.json();
  const fallbackScript = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!fallbackScript) throw new Error('DeepSeek BYOK 兜底返回为空');
  return { script: fallbackScript };
}
