import { MediaUserKey } from '../../../models/MediaUserKey';
import { decryptSecret } from '../../../lib/crypto';
import { getPreferredAgnesTextModel } from '../../../config/ai-models';
import { route } from '../../../gateway/ai-gateway.service';

export interface EcommerceResult {
  attributes: Record<string, any>;
  copy: string;
  images: string[];
}

async function resolveArkKey(userId: string): Promise<string | null> {
  const rec = await MediaUserKey.findOne({ userId, provider: 'ark', enabled: true }).lean();
  if (rec?.secretKeyEnc) {
    try {
      return decryptSecret(rec.secretKeyEnc);
    } catch {
      /* 回落平台 */
    }
  }
  return process.env.ARK_API_KEY || null;
}

async function resolveDeepseekKey(userId: string): Promise<string | null> {
  const rec = await MediaUserKey.findOne({ userId, provider: 'deepseek', enabled: true }).lean();
  if (rec?.secretKeyEnc) {
    try {
      return decryptSecret(rec.secretKeyEnc);
    } catch {
      /* 回落平台 */
    }
  }
  return null;
}

/** 视觉理解：用 Ark 视觉模型从商品图抽取结构化卖点 */
export async function analyzeProduct(
  arkKey: string,
  imageUrls: string[]
): Promise<Record<string, any>> {
  const model = process.env.ARK_VISION_MODEL || 'doubao-vision-pro-32k';
  const content: any[] = [
    {
      type: 'text',
      text: '请分析这张商品图，输出 JSON：{name, category, sellingPoints:[], material, scene, audience, color, style, priceHint}。只输出 JSON。',
    },
  ];
  for (const u of imageUrls.slice(0, 4)) {
    content.push({ type: 'image_url', image_url: { url: u } });
  }
  const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${arkKey}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content }],
      temperature: 0.3,
      response_format: { type: 'json_object' },
    }),
  });
  if (!resp.ok) throw new Error(`视觉理解失败(${resp.status})`);
  const data: any = await resp.json();
  const txt = data?.choices?.[0]?.message?.content || '{}';
  try {
    return JSON.parse(txt);
  } catch {
    return {};
  }
}

/** 文案生成：基于卖点写详情页（Markdown） */
export async function writeProductCopy(
  dsKey: string | null,
  attrs: Record<string, any>,
  opts: { platform?: string; tone?: string }
): Promise<string> {
  const sys =
    '你是电商详情页文案专家，输出结构清晰的 Markdown：标题、副标题、卖点列表、场景化描述、规格参数表、转化引导。不要使用括号动作描写。';
  const user = `商品信息：${JSON.stringify(attrs)}\n目标平台：${opts.platform || '通用'}\n调性：${
    opts.tone || '专业可信'
  }\n请直接输出 Markdown 详情页文案。`;
  try {
    const result = await route({
      model: getPreferredAgnesTextModel(),
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      maxTokens: 1500,
      timeoutMs: 30_000,
      totalTimeoutMs: 60_000,
    });
    const agnesCopy = result.reply?.trim() || '';
    if (agnesCopy) return agnesCopy;
  } catch (agnesError) {
    if (!dsKey) throw agnesError;
  }

  if (!dsKey) throw new Error('Agnes 2.5 返回为空');
  const resp = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${dsKey}` },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: [
        { role: 'system', content: sys },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      max_tokens: 1500,
    }),
  });
  if (!resp.ok) throw new Error(`Agnes 2.5 与 DeepSeek BYOK 均不可用(${resp.status})`);
  const data: any = await resp.json();
  const fallbackCopy = data?.choices?.[0]?.message?.content?.trim() || '';
  if (!fallbackCopy) throw new Error('DeepSeek BYOK 兜底返回为空');
  return fallbackCopy;
}

/** 图像生成：用 Ark Seedream 生成主图/场景图 */
export async function generateProductImages(
  arkKey: string,
  attrs: Record<string, any>,
  opts: { count?: number; platform?: string }
): Promise<string[]> {
  const model = process.env.ARK_IMAGE_MODEL || 'seedream-3.0';
  const name = attrs?.name || '商品';
  const points = Array.isArray(attrs?.sellingPoints) ? attrs.sellingPoints.slice(0, 3).join('、') : '';
  const prompt = `${name}，${points}，电商${opts.platform || ''}风格主图与场景图，高清、干净背景、商业摄影质感、居中构图`;
  const n = Math.min(8, Math.max(1, Number(opts.count) || 4));
  const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${arkKey}` },
    body: JSON.stringify({ model, prompt, n }),
  });
  if (!resp.ok) throw new Error(`图像生成失败(${resp.status})`);
  const data: any = await resp.json();
  const arr = data?.data?.images || data?.images || [];
  return arr.map((it: any) => it?.url).filter(Boolean);
}

/** 一站式：视觉理解 + 文案 + 图像，单步失败不影响其余 */
export async function generateEcommerce(opts: {
  productImages: string[];
  platform?: string;
  tone?: string;
  imageCount?: number;
  userId: string;
}): Promise<EcommerceResult> {
  const arkKey = await resolveArkKey(opts.userId);
  const dsKey = await resolveDeepseekKey(opts.userId);

  let attributes: Record<string, any> = {};
  if (arkKey) {
    try {
      attributes = await analyzeProduct(arkKey, opts.productImages);
    } catch {
      attributes = {};
    }
  }

  let copy = '';
  try {
    copy = await writeProductCopy(dsKey, attributes, { platform: opts.platform, tone: opts.tone });
  } catch {
    copy = '';
  }

  let images: string[] = [];
  if (arkKey) {
    try {
      images = await generateProductImages(arkKey, attributes, {
        count: opts.imageCount,
        platform: opts.platform,
      });
    } catch {
      images = [];
    }
  }

  return { attributes, copy, images };
}
