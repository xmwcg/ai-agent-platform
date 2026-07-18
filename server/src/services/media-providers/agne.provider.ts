/**
 * Agnes AIHub 媒体生成 Provider（免费模型网关，OpenAI 兼容）
 * baseURL 来自 AGNES_BASE_URL，密钥来自 AGNES_API_KEY（与对话类 agnes provider 同源）。
 * 模型（GET /v1/models 实测，全小写）：
 *   - 文生图 / 图生图：agnes-image-2.0-flash、agnes-image-2.1-flash
 *   - 视频：agnes-video-v2.0
 * 文本/图像走标准 OpenAI 兼容接口；视频为「异步任务 API」（官方文档 agnes-video-v20）：
 *   - 创建任务：POST {baseURL}/videos，返回 video_id / task_id，status=queued
 *   - 轮询结果：GET {root}/agnesapi?video_id=<VIDEO_ID>（推荐）；status=completed 时读取 url
 * 与可灵一致：直接以厂商 video_id 作为本地 taskId，queryTask 用该 id 回查远端。
 */
import axios from 'axios';
import {
  genTaskId,
  persistTask,
  type MediaGenParams,
  type MediaGenResult,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

const AGNES_BASE_URL = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
/** 轮询端点 /agnesapi 位于根域名（不带 /v1） */
const AGNES_ROOT = AGNES_BASE_URL.replace(/\/v1$/, '');
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';

const IMAGE_MODEL = 'agnes-image-2.0-flash';
const VIDEO_MODEL = 'agnes-video-v2.0';

/** 将时长（秒）换算为满足 8n+1 规则且 ≤441 的帧数 */
function toValidFrames(durationSec: number, frameRate: number): number {
  const raw = Math.max(1, Math.round(durationSec * frameRate));
  // 取最接近的 8n+1
  const n = Math.max(0, Math.round((raw - 1) / 8));
  return Math.min(8 * n + 1, 441);
}

export class AgneProvider implements MediaProvider {
  name = 'agnes' as const;
  label = 'Agnes AIHub（免费）';
  supportedTypes: MediaTaskType[] = ['text2img', 'image2image', 'text2video', 'image2video'];

  isConfigured(): boolean {
    return !!AGNES_API_KEY;
  }

  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const taskId = genTaskId();
    const headers = {
      Authorization: `Bearer ${AGNES_API_KEY}`,
      'Content-Type': 'application/json',
    };
    const type = params.type;

    // 文生图 / 图生图：OpenAI 兼容 images/generations
    if (type === 'text2img' || type === 'image2image') {
      const model = params.style && params.style.startsWith('agnes-image') ? params.style : IMAGE_MODEL;
      const body: Record<string, unknown> = {
        model,
        prompt: params.prompt,
        n: Math.min(Math.max(params.n || 1, 1), 4),
        size: params.size || '1024x1024',
      };
      if (type === 'image2image' && params.imageUrl) body.image_url = params.imageUrl;
      const resp = await axios.post(`${AGNES_BASE_URL}/images/generations`, body, {
        headers,
        timeout: 120000,
      });
      const data: any[] = resp.data?.data || [];
      const images: string[] = data
        .map((d: any) => (d?.url ? d.url : d?.b64_json ? `data:image/png;base64,${d.b64_json}` : ''))
        .filter(Boolean);
      const result: MediaGenResult = {
        type,
        taskId,
        status: 'completed',
        prompt: params.prompt,
        outputUrl: images[0] || '',
        images,
        provider: 'agnes',
        note: 'Agnes 文生图生成完成。',
      };
      await persistTask(taskId, result);
      return result;
    }

    // 视频：agnes-video-v2.0 异步任务 —— 创建任务 POST /v1/videos，返回 video_id 供轮询
    const duration = params.duration || 5;
    const frameRate = 24;
    const body: Record<string, unknown> = {
      model: VIDEO_MODEL,
      prompt: params.prompt,
      height: 768,
      width: 1152,
      num_frames: toValidFrames(duration, frameRate),
      frame_rate: frameRate,
    };
    // 图生视频：传参考图 URL
    if (type === 'image2video' && params.imageUrl) body.image = params.imageUrl;
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;

    const resp = await axios.post(`${AGNES_BASE_URL}/videos`, body, { headers, timeout: 120000 });
    const d = resp.data || {};
    // 官方推荐用 video_id 轮询；缺省回退 task_id / id
    const vendorId = String(d.video_id || d.task_id || d.id || genTaskId());
    const result: MediaGenResult = {
      type,
      taskId: vendorId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      provider: 'agnes',
      duration,
      note: '已提交 Agnes 视频任务，可调用 queryTask 轮询结果。',
    };
    await persistTask(vendorId, result);
    return result;
  }

  /** 轮询任务结果：GET {root}/agnesapi?video_id=<taskId>；completed 时读取 url */
  async queryTask(taskId: string): Promise<MediaGenResult> {
    const headers = { Authorization: `Bearer ${AGNES_API_KEY}` };
    let d: any = {};
    try {
      const resp = await axios.get(`${AGNES_ROOT}/agnesapi`, {
        headers,
        params: { video_id: taskId },
        timeout: 30000,
      });
      d = resp.data || {};
    } catch {
      // 兼容旧版：GET /v1/videos/<TASK_ID>
      const resp = await axios.get(`${AGNES_BASE_URL}/videos/${encodeURIComponent(taskId)}`, {
        headers,
        timeout: 30000,
      });
      d = resp.data || {};
    }

    const status = String(d.status || '').toLowerCase();
    const completed = status === 'completed';
    const failed = status === 'failed';
    const url = completed ? String(d.url || '') : '';
    const result: MediaGenResult = {
      type: 'text2video',
      taskId,
      status: completed ? 'completed' : 'processing',
      prompt: '',
      outputUrl: url,
      provider: 'agnes',
      duration: d.seconds ? Number(d.seconds) : undefined,
      note: completed
        ? 'Agnes 视频生成完成。'
        : failed
          ? `Agnes 视频生成失败：${d.error || '未知错误'}`
          : `Agnes 视频处理中（${d.progress ?? 0}%）……`,
    };
    await persistTask(taskId, result);
    return result;
  }
}
