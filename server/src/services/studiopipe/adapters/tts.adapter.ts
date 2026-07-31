import { MediaUserKey } from '../../../models/MediaUserKey';
import { decryptSecret } from '../../../lib/crypto';

export interface TtsResult {
  audioBuffer: Buffer;
  durationSec: number;
}

const VOICE_MAP: Record<string, string> = {
  清脆女声: 'zh_female_qingxin',
  知性女声: 'zh_female_chengshu',
  沉稳男声: 'zh_male_dongfang',
  活力男声: 'zh_male_tianqing',
};

/** 解析用户自带火山 Ark Key（BYOK），未配置则回落平台 ARK_API_KEY */
async function resolveArkKey(userId: string): Promise<string | null> {
  const rec = await MediaUserKey.findOne({ userId, provider: 'ark', enabled: true }).lean();
  if (rec?.secretKeyEnc) {
    try {
      return decryptSecret(rec.secretKeyEnc);
    } catch {
      /* 回落平台 Key */
    }
  }
  return process.env.ARK_API_KEY || null;
}

/**
 * 火山引擎 Ark 大模型语音合成（TTS）
 * 文档：POST https://ark.cn-beijing.volces.com/api/v3/tts
 * 返回 data.audio（base64 mp3）。语音类型与模型名通过环境变量可配。
 */
export async function synthesizeSpeech(
  text: string,
  opts: { voiceType?: string; userId: string }
): Promise<TtsResult> {
  const apiKey = await resolveArkKey(opts.userId);
  if (!apiKey) {
    throw new Error('未配置火山 Ark Key（请在「我的密钥」中填写，或联系平台管理员）');
  }

  const model = process.env.ARK_TTS_MODEL || 'volcano_tts';
  const voiceType = VOICE_MAP[opts.voiceType || ''] || process.env.ARK_TTS_VOICE || 'zh_female_qingxin';

  const resp = await fetch('https://ark.cn-beijing.volces.com/api/v3/tts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      voice_type: voiceType,
      text,
      response_format: 'mp3',
    }),
  });

  if (!resp.ok) {
    const t = await resp.text().catch(() => '');
    throw new Error(`Ark TTS 调用失败(${resp.status}): ${t.slice(0, 200)}`);
  }
  const data: any = await resp.json();
  const b64 = data?.data?.audio;
  if (!b64) throw new Error('Ark TTS 未返回音频数据');

  const audioBuffer = Buffer.from(b64, 'base64');
  // 中文约 4.5 字/秒，估算时长用于管线与计费
  const durationSec = Math.max(3, Math.ceil(text.length / 4.5));
  return { audioBuffer, durationSec };
}
