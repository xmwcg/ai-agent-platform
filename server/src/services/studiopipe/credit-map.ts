import { StudioJobInput, StudioSceneId } from './types';

/**
 * 积分成本表（平台积分，运营定价建议 1 积分 ≈ 0.01 元）
 * 仅作「生产即扣积分」的依据，计费/支付/会员由平台既有 billing 体系负责，
 * 本模块只管扣减与退回，不重复造支付。
 */
export const CREDIT_COSTS = {
  scriptPer1kChars: 2, // DeepSeek 文案：每 1000 输出字符
  ttsPerSecond: 0.5, // 火山 Ark 配音：每配音秒
  asrPerMinute: 1, // 语音识别：每音频分钟
  subtitle: 0, // 字幕烧录（计算型，不计费）
  bgm: 1, // 配乐混音
  export: 2, // 竖屏合成 + 对象存储上传
  digitalHumanPer10s: 8, // 数字人：每 10 秒口播
  ecommerceVision: 3, // 商品图理解（视觉）
  ecommerceText: 2, // 详情页文案（LLM）
  ecommerceImageEach: 6, // 每张生成图（Seedream）
};

function roundUp(n: number): number {
  return Math.max(1, Math.ceil(n));
}

export interface CostEstimate {
  total: number;
  breakdown: Record<string, number>;
}

/** 根据场景与输入预估积分成本 */
export function estimateCost(input: StudioJobInput): CostEstimate {
  const b: Record<string, number> = {};
  const f = input.fields || {};

  if (input.sceneId === 'short-video' || input.sceneId === 'digital-human') {
    const chars =
      (typeof f.script === 'string' && f.script.length) ||
      Math.max(50, (typeof f.topic === 'string' ? f.topic.length : 0) * 8);
    b.script = roundUp((CREDIT_COSTS.scriptPer1kChars * chars) / 1000);
    const durSec = Number(f.durationSec) || 30;
    b.tts = roundUp(CREDIT_COSTS.ttsPerSecond * durSec);
    b.asr = roundUp((CREDIT_COSTS.asrPerMinute * durSec) / 60);
    b.bgm = CREDIT_COSTS.bgm;
    b.export = CREDIT_COSTS.export;
    if (input.sceneId === 'digital-human') {
      b.digitalHuman = roundUp((CREDIT_COSTS.digitalHumanPer10s * durSec) / 10);
    }
  } else if (input.sceneId === 'ecommerce') {
    const imgCount = Math.max(1, Number(f.imageCount) || 4);
    b.ecommerceVision = CREDIT_COSTS.ecommerceVision;
    b.ecommerceText = CREDIT_COSTS.ecommerceText;
    b.ecommerceImage = CREDIT_COSTS.ecommerceImageEach * imgCount;
  }

  const total = Object.values(b).reduce((a, c) => a + c, 0);
  return { total, breakdown: b };
}
