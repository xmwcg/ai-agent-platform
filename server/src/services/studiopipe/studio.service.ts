import fs from 'fs/promises';
import { StudioJob, IStudioStep } from '../../models/StudioJob';
import { User } from '../../models/User';
import { estimateCost } from './credit-map';
import { StudioSceneId, StudioJobInput, SubtitleStyle } from './types';
import { tmpFile, uploadBuffer, downloadToTmp } from './adapters/_util';
import { generateScript } from './adapters/script.adapter';
import { synthesizeSpeech } from './adapters/tts.adapter';
import { transcribe } from './adapters/asr.adapter';
import { buildAss } from './adapters/subtitle.ffmpeg';
import { selectBgm } from './adapters/bgm.ffmpeg';
import { compose } from './adapters/export.ffmpeg';
import { generateDigitalHuman } from './adapters/digitalhuman.adapter';
import {
  analyzeProduct,
  writeProductCopy,
  generateProductImages,
} from './adapters/ecommerce.adapter';
import {
  deductCredits,
  grantCredits,
  InsufficientCreditsError,
} from '../credit-ledger.service';

// 直接 import JSON（resolveJsonModule 已开启），编译期内联，开发/生产均可读
import manifest from './studio-templates/manifest.json';
const MANIFEST = manifest as { scenes: any[]; templates: any[] };

const STEP_LABELS: Record<string, string> = {
  script: '生成脚本',
  tts: 'AI 配音',
  asr: '语音识别',
  digitalhuman: '数字人合成',
  subtitle: '字幕烧录',
  bgm: '配乐混音',
  export: '竖屏合成导出',
  vision: '商品图理解',
  text: '详情页文案',
  image: '生成商品图',
};

export function listScenes() {
  return MANIFEST.scenes;
}
export function getTemplates() {
  return MANIFEST.templates;
}
export function getScene(id: string) {
  return MANIFEST.scenes.find((s: any) => s.id === id);
}

export async function getBalance(userId: string) {
  const u = await User.findById(userId).select('credits plan').lean();
  return { credits: u?.credits || 0, plan: u?.plan || 'free' };
}

export async function getJob(jobId: string, userId: string) {
  const job = await StudioJob.findOne({ _id: jobId, userId }).lean();
  return job;
}

export async function createJob(input: StudioJobInput, userId: string) {
  const scene = getScene(input.sceneId);
  if (!scene) {
    const e: any = new Error('未知场景: ' + input.sceneId);
    e.status = 400;
    throw e;
  }
  const est = estimateCost(input);
  const user = await User.findById(userId).select('credits plan');
  if (!user) {
    const e: any = new Error('用户不存在');
    e.status = 401;
    throw e;
  }
  if (user.credits < est.total) {
    const e: any = new Error('积分不足，请先充值或绑定自有 API Key 免算力');
    e.code = 'INSUFFICIENT_CREDITS';
    e.status = 402;
    throw e;
  }

  const steps: IStudioStep[] = scene.steps.map((k: string) => ({
    key: k,
    label: STEP_LABELS[k] || k,
    status: 'pending',
    progress: 0,
  }));

  const job = await StudioJob.create({
    userId,
    sceneId: input.sceneId,
    templateId: input.templateId,
    status: 'queued',
    inputs: { fields: input.fields || {} },
    steps,
    creditsCost: est.total,
    outputs: {},
  });

  // 异步执行，不阻塞 HTTP 响应
  runJob(job._id.toString(), userId, input, est.total).catch(() => {});
  return {
    jobId: job._id.toString(),
    creditsCost: est.total,
    balanceAfter: user.credits - est.total,
  };
}

async function runJob(jobId: string, userId: string, input: StudioJobInput, estimatedCost: number) {
  const job: any = await StudioJob.findById(jobId);
  if (!job) return;
  job.status = 'running';
  await job.save();

  // 通过 credit-ledger 统一扣积分（CreditLot 分批扣减 + CreditsTransaction 审计 + 幂等去重）
  const idempotencyKey = `studio:${jobId}`;
  try {
    await deductCredits({
      userId,
      amount: estimatedCost,
      idempotencyKey,
      businessType: 'studio_gen',
      businessId: jobId,
      description: `创作工坊 - ${input.sceneId}`,
      resource: `studio:${input.sceneId}`,
    });
    job.creditsDeducted = true;
  } catch (e: any) {
    job.status = 'failed';
    job.error = e instanceof InsufficientCreditsError
      ? '积分余额不足，请先充值或绑定自有 API Key 免算力'
      : `积分扣费失败: ${e?.message || e}`;
    job.creditsDeducted = false;
    await job.save();
    return;
  }

  try {
    if (input.sceneId === 'ecommerce') {
      await runEcommerce(job, input, userId);
    } else {
      await runVideoPipeline(job, input, userId, input.sceneId === 'digital-human');
    }
    job.status = 'success';
  } catch (e: any) {
    job.status = 'failed';
    job.error = String(e?.message || e);
    // 任务失败 → 自动退回积分（参考 tools.ts 模式）
    try {
      await grantCredits({
        userId,
        amount: estimatedCost,
        sourceType: 'refund',
        transactionType: 'refund',
        idempotencyKey: `studio-refund:${jobId}`,
        businessType: 'studio_gen_refund',
        businessId: jobId,
        description: `创作工坊任务失败，自动退回积分 - ${input.sceneId}`,
        resource: `studio:${input.sceneId}`,
      });
      job.creditsDeducted = false;
    } catch (refundErr: any) {
      job.error = (job.error || '') + `; 退款失败: ${refundErr?.message || refundErr}`;
    }
  }
  await job.save();
}

/** 单步包装：更新进度、记录错误 */
async function step<T>(job: any, key: string, fn: () => Promise<T>): Promise<T> {
  const s = job.steps.find((x: any) => x.key === key);
  if (s) {
    s.status = 'running';
    s.progress = 10;
    await job.save();
  }
  try {
    const r = await fn();
    if (s) {
      s.status = 'done';
      s.progress = 100;
      await job.save();
    }
    return r;
  } catch (e: any) {
    if (s) {
      s.status = 'error';
      s.message = String(e?.message || e);
      await job.save();
    }
    throw e;
  }
}

function defaultSubtitleStyle(templateId?: string): SubtitleStyle {
  const tpl = MANIFEST.templates?.find((t: any) => t.id === templateId);
  if (tpl?.subtitleStyle) return tpl.subtitleStyle as SubtitleStyle;
  return {
    font: 'Microsoft YaHei',
    size: 14,
    color: '&H00FFFFFF',
    outline: '&H00000000',
    position: 'bottom',
  };
}

async function runVideoPipeline(
  job: any,
  input: StudioJobInput,
  userId: string,
  isDigitalHuman: boolean
) {
  const f = input.fields || {};

  const script =
    f.script ||
    (await step(job, 'script', () =>
      generateScript(f.topic || '', { style: f.style, userId })
    ));

  const tts = await step(job, 'tts', () =>
    synthesizeSpeech(script, { voiceType: f.voiceType, userId })
  );

  const audioPath = await tmpFile('mp3');
  await fs.writeFile(audioPath, tts.audioBuffer);
  const audioUrl = await uploadBuffer(tts.audioBuffer, 'audio/mpeg', 'studio/audio');

  let segments = [{ text: script, start: 0, end: tts.durationSec } as any];
  let videoBasePath: string | undefined;

  if (isDigitalHuman) {
    const dh = await step(job, 'digitalhuman', () =>
      generateDigitalHuman({ audioUrl, portraitUrl: f.portraitUrl, userId })
    );
    videoBasePath = await downloadToTmp(dh.videoUrl, 'mp4');
  } else {
    if (f.mediaUrl) videoBasePath = f.mediaUrl;
    const asr = await step(job, 'asr', () => transcribe(audioUrl));
    if (!asr.fallback && asr.segments?.[0]?.text) segments = asr.segments;
  }

  const assPath = await step(job, 'subtitle', () =>
    buildAss(segments, defaultSubtitleStyle(input.templateId))
  );
  const bgmPath = await step(job, 'bgm', () => selectBgm(f.bgmMood || f.bgmStyle));
  const outPath = await tmpFile('mp4');

  await step(job, 'export', async () => {
    await compose({
      videoBasePath,
      audioPath,
      assPath,
      bgmPath,
      watermarkPath: process.env.STUDIO_WATERMARK_PATH,
      durationSec: tts.durationSec,
      outPath,
    });
    const buf = await fs.readFile(outPath);
    const finalUrl = await uploadBuffer(buf, 'video/mp4', 'studio/video');
    job.outputs = { videoUrl: finalUrl, creditsCost: job.creditsCost };
  });
}

async function runEcommerce(job: any, input: StudioJobInput, userId: string) {
  const f = input.fields || {};
  const productImages = String(f.productImages || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const attrs = await step(job, 'vision', async () => {
    const arkKey = await resolveArk(userId, 'ark');
    if (!arkKey) return {};
    return analyzeProduct(arkKey, productImages);
  });

  const copy = await step(job, 'text', async () => {
    const dsKey = await resolveArk(userId, 'deepseek');
    if (!dsKey) return '';
    return writeProductCopy(dsKey, attrs, { platform: f.platform, tone: f.tone });
  });

  const images = await step(job, 'image', async () => {
    const arkKey = await resolveArk(userId, 'ark');
    if (!arkKey) return [];
    return generateProductImages(arkKey, attrs, {
      count: Number(f.imageCount) || 4,
      platform: f.platform,
    });
  });

  job.outputs = { attributes: attrs, copy, images, creditsCost: job.creditsCost };
}

// 复用 ecommerce.adapter 内的 Key 解析逻辑（避免重复实现）
import { MediaUserKey } from '../../models/MediaUserKey';
import { decryptSecret } from '../../lib/crypto';
async function resolveArk(userId: string, provider: 'ark' | 'deepseek'): Promise<string | null> {
  const rec = await MediaUserKey.findOne({ userId, provider, enabled: true }).lean();
  if (rec?.secretKeyEnc) {
    try {
      return decryptSecret(rec.secretKeyEnc);
    } catch {
      /* 回落平台 */
    }
  }
  return provider === 'ark' ? process.env.ARK_API_KEY || null : process.env.DEEPSEEK_API_KEY || null;
}
// ── 抖音链接提取 ──
export { extractDouyinVideo as extractDouyin } from './adapters/douyin.adapter';

// ── 多平台发布调度 ──
import type { PublishDispatchInput, PublishDispatchResult } from './adapters/publish.adapter';

export async function dispatchPublish(input: PublishDispatchInput): Promise<PublishDispatchResult> {
  const { dispatchPublish: doDispatch } = await import('./adapters/publish.adapter');
  return doDispatch(input);
}

// ── 混剪视频 ──
export { composeMixCut } from './adapters/mixcut.adapter';

// ── 商品详情页文章 ──
export { generateProductArticle } from './adapters/product-article.adapter';
