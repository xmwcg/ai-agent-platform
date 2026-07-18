/**
 * Agnes AIHub 媒体生成 Provider（免费模型网关，OpenAI 兼容）
 * baseURL 来自 AGNES_BASE_URL，密钥来自 AGNES_API_KEY（与对话类 agnes provider 同源）。
 * 模型（GET /v1/models 实测，全小写）：
 *   - 文生图 / 图生图：agnes-image-2.0-flash、agnes-image-2.1-flash
 *   - 视频：agnes-video-v2.0
 * 所有模型 supported_endpoint_types 均为 ["openai"]，故文本/图像走标准 OpenAI 兼容接口，
 * 视频在此经 /v1/chat/completions（model=agnes-video-v2.0）调用并 best-effort 提取直链。
 */
import axios from 'axios';
import {
  genTaskId,
  persistTask,
  retrieveTask,
  type MediaGenParams,
  type MediaGenResult,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

const AGNES_BASE_URL = (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, '');
const AGNES_API_KEY = process.env.AGNES_API_KEY || '';

const IMAGE_MODEL = 'agnes-image-2.0-flash';
const VIDEO_MODEL = 'agnes-video-v2.0';

/** 从返回文本中提取音视频直链（Agnes 视频模型可能以 URL 形式回传） */
function extractMediaUrl(text: string): string {
  const m = text.match(/https?:\/\/[^\s"'<>()]+\.(?:mp4|webm|mov|m3u8)/i);
  return m ? m[0] : '';
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

    // 视频：agnes-video-v2.0 经 OpenAI 兼容 /v1/chat/completions（best-effort 提取直链）
    const resp = await axios.post(
      `${AGNES_BASE_URL}/chat/completions`,
      {
        model: VIDEO_MODEL,
        messages: [{ role: 'user', content: params.prompt }],
        max_tokens: 1024,
      },
      { headers, timeout: 180000 }
    );
    const content: string = resp.data?.choices?.[0]?.message?.content || '';
    const url = extractMediaUrl(content);
    const result: MediaGenResult = {
      type,
      taskId,
      status: 'completed',
      prompt: params.prompt,
      outputUrl: url,
      provider: 'agnes',
      duration: params.duration || 3,
      note: url ? 'Agnes 视频生成完成。' : 'Agnes 视频模型已返回，但未解析到视频直链，请检查返回内容。',
    };
    await persistTask(taskId, result);
    return result;
  }

  /** 轮询任务结果（同步生成已直接落库 completed，这里回读持久化结果） */
  async queryTask(taskId: string): Promise<MediaGenResult> {
    const task = await retrieveTask(taskId);
    if (!task) throw new Error('任务不存在或已过期');
    return task;
  }
}
