/**
 * Agnes（apihub.agnes-ai.com）统一媒体 Provider
 * 一个 Provider 覆盖三类能力，全部走用户「模型配置」里的 Agnes 第三方自定义模型：
 *   - 文生图 / 图生图：POST {baseURL}/images/generations（同步返回图片 URL）
 *   - 文生视频：POST {baseURL}/videos（异步，返回 task_id）→ GET {baseURL}/videos/{task_id} 轮询成片
 * 凭据（baseURL + apiKey）与模型清单统一从 ModelConfig（provider=custom、baseURL 含 agnès）读取，
 * 与 AI 网关共用同一份配置，避免重复维护。apiKey 以密文落库，此处运行时解密。
 */
import axios from 'axios';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { AppError } from '../../lib/http-error';
import { decryptSecret } from '../../lib/crypto';
import { ModelConfig } from '../../models/ModelConfig';
import { getObjectStorage, LOCAL_STORAGE_DIR } from '../../lib/object-storage';
import {
  genTaskId,
  persistTask,
  retrieveTask,
  type MediaCredentials,
  type MediaGenParams,
  type MediaGenResult,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

interface AgnesConfig {
  baseURL: string;
  apiKey: string;
  models: string[];
}

const execFileAsync = promisify(execFile);
const MAX_FRAMES_PER_SEGMENT = 441;
const DEFAULT_FRAME_RATE = 24;
const DEFAULT_VIDEO_SIZE = '1152x768';
const VIDEO_RATE_LIMIT_DELAY_MS = 61_000;
const VIDEO_SUBMIT_RETRIES = 5;

export class AgnesProvider implements MediaProvider {
  name = 'agnes' as const;
  label = 'Agnes（文生图 / 文生视频）';
  supportedTypes: MediaTaskType[] = ['text2img', 'image2image', 'text2video'];

  private cached: AgnesConfig | null = null;

  /** 从 ModelConfig 加载 Agnes 媒体配置，结果缓存。文本专用的 Agnes 2.5 配置不应抢占媒体 Provider。 */
  async reload(): Promise<void> {
    try {
      const docs = await ModelConfig.find({
        enabled: true,
        baseURL: /agnes/i,
      }).sort({ pinned: -1, createdAt: -1 }).lean();
      const doc = (docs as any[]).find((candidate) => {
        const models = Array.isArray(candidate.models)
          ? candidate.models as string[]
          : [String(candidate.defaultModel || '')];
        return models.some((model) => /image|video/i.test(model));
      });
      if (doc) {
        const models = Array.isArray((doc as any).models)
          ? ((doc as any).models as string[])
          : [String((doc as any).defaultModel || '')];
        this.cached = {
          baseURL: String((doc as any).baseURL || '').replace(/\/$/, ''),
          apiKey: decryptSecret((doc as any).apiKey || ''),
          models: models.filter(Boolean),
        };
        return;
      }
      // 数据库未配置自定义 Agnes 模型 → 回退到环境变量（AGNES_API_KEY / AGNES_BASE_URL），
      // 避免强依赖后台手工在「模型配置」中添加，保证默认即可出图/出片。
      this.cached = this.fromEnv();
    } catch {
      // 加载失败不致命：回退环境变量，再不行下次 generate / reload 再试
      this.cached = this.fromEnv();
    }
  }

  /** 从环境变量构造 Agnes 配置（兜底路径）。 */
  private fromEnv(): AgnesConfig | null {
    const key = process.env.AGNES_API_KEY;
    if (!key) return null;
    return {
      baseURL: (process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1').replace(/\/$/, ''),
      apiKey: key,
      models: ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0'],
    };
  }

  private async ensureLoaded(): Promise<AgnesConfig> {
    if (this.cached) return this.cached;
    await this.reload();
    if (!this.cached) {
      throw new AppError(
        503,
        'Agnes 模型未配置：请在「模型配置」中添加 Agnes（apihub.agnes-ai.com）自定义模型',
        'MEDIA_PROVIDER_UNAVAILABLE'
      );
    }
    return this.cached;
  }

  isConfigured(): boolean {
    return !!this.cached;
  }

  private pickModel(cfg: AgnesConfig, kind: 'image' | 'video'): string {
    if (kind === 'video') {
      return (
        cfg.models.find((m) => /video/i.test(m)) || 'agnes-video-v2.0'
      );
    }
    // 文生图：优先 2.1（更高画质），回退 2.0
    return (
      cfg.models.find((m) => /image-2\.1/i.test(m)) ||
      cfg.models.find((m) => /image/i.test(m)) ||
      'agnes-image-2.0-flash'
    );
  }

  private headers(cfg: AgnesConfig): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`,
    };
  }

  /** 清洗文本：去换行/回车、合并空白、按上限截断，避免超长脚本触发上游 400。 */
  private cleanText(s: string, max = 800): string {
    return String(s || '')
      .replace(/\n+/g, ' ')
      .replace(/\r+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max);
  }

  /** Agnes 视频模型帧数遵循 8n+1 规则，上限 441 帧。 */
  private toValidFrames(durationSec: number, frameRate: number): number {
    const raw = Math.max(1, Math.round(durationSec * frameRate));
    const n = Math.max(0, Math.round((raw - 1) / 8));
    return Math.min(8 * n + 1, 441);
  }

  private splitDuration(durationSec: number, frameRate: number): number[] {
    const segments: number[] = [];
    const maxSegmentSeconds = MAX_FRAMES_PER_SEGMENT / frameRate;
    let remaining = Math.max(1 / frameRate, Number(durationSec));
    while (remaining > 1e-6) {
      const segment = Math.min(remaining, maxSegmentSeconds);
      segments.push(segment);
      remaining -= segment;
    }
    return segments;
  }

  private isRetryableSubmitError(error: any): boolean {
    const status = Number(error?.response?.status);
    const code = String(error?.response?.data?.error?.code || '').toLowerCase();
    return status === 429 || code === 'rate_limit_exceeded'
      || status === 503 || code === 'video_queue_full';
  }

  private async submitVideo(
    cfg: AgnesConfig,
    params: MediaGenParams,
    durationSec: number,
    promptSuffix?: string,
  ): Promise<MediaGenResult> {
    const model = this.pickModel(cfg, 'video');
    const frameRate = Math.min(Math.max(Math.round(Number(params.frameRate) || DEFAULT_FRAME_RATE), 1), 60);
    const [requestedWidth, requestedHeight] = String(params.size || DEFAULT_VIDEO_SIZE)
      .toLowerCase()
      .split('x')
      .map((value) => Number(value));
    const width = Number.isFinite(requestedWidth) && requestedWidth > 0 ? requestedWidth : 1152;
    const height = Number.isFinite(requestedHeight) && requestedHeight > 0 ? requestedHeight : 768;
    const body: Record<string, unknown> = {
      model,
      prompt: `${this.cleanText(params.prompt)}${promptSuffix || ''}`,
      height,
      width,
      num_frames: this.toValidFrames(durationSec, frameRate),
      frame_rate: frameRate,
    };
    if (params.imageUrl) body.image = params.imageUrl;
    if (params.negativePrompt) body.negative_prompt = params.negativePrompt;
    if (params.size) body.size = params.size;

    let r;
    for (let attempt = 0; ; attempt += 1) {
      try {
        r = await axios.post(`${cfg.baseURL}/videos`, body, {
          headers: { Authorization: `Bearer ${cfg.apiKey}`, 'Content-Type': 'application/json' },
          timeout: 30_000,
        });
        break;
      } catch (error) {
        if (!this.isRetryableSubmitError(error) || attempt >= VIDEO_SUBMIT_RETRIES) throw error;
        await new Promise((resolve) => setTimeout(resolve, VIDEO_RATE_LIMIT_DELAY_MS));
      }
    }
    const upstream = r.data?.task_id || r.data?.id || r.data?.data?.task_id || r.data?.data?.id;
    if (!upstream) throw new AppError(502, `Agnes 视频提交未返回 task_id：${JSON.stringify(r.data).slice(0, 300)}`);
    return {
      type: 'text2video',
      taskId: genTaskId(),
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      upstreamTaskId: String(upstream),
      provider: this.name,
      note: `Agnes 视频正在生成（${durationSec} 秒片段）`,
    };
  }

  private async mergeSegmentVideos(urls: string[], parentTaskId: string): Promise<string> {
    const jobDir = path.join(LOCAL_STORAGE_DIR, 'videos', parentTaskId);
    await fs.mkdir(jobDir, { recursive: true });
    const files: string[] = [];
    try {
      for (let index = 0; index < urls.length; index += 1) {
        const filePath = path.join(jobDir, `segment-${index}.mp4`);
        const source = urls[index];
        if (source.startsWith('/generated/')) {
          const relativePath = source.replace(/^\/generated\//, '');
          const sourcePath = path.resolve(LOCAL_STORAGE_DIR, relativePath);
          const storageRoot = `${path.resolve(LOCAL_STORAGE_DIR)}${path.sep}`;
          if (!sourcePath.startsWith(storageRoot)) {
            throw new Error('Invalid local segment path');
          }
          await fs.copyFile(sourcePath, filePath);
        } else {
          const response = await axios.get<ArrayBuffer>(source, { responseType: 'arraybuffer', timeout: 120_000 });
          await fs.writeFile(filePath, Buffer.from(response.data));
        }
        files.push(filePath);
      }
      const listPath = path.join(jobDir, 'concat.txt');
      await fs.writeFile(listPath, files.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join('\n'));
      const outputPath = path.join(LOCAL_STORAGE_DIR, 'videos', `${parentTaskId}.mp4`);
      await execFileAsync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', listPath, '-c', 'copy', outputPath], { timeout: 120_000 });
      return `/generated/videos/${parentTaskId}.mp4`;
    } finally {
      await fs.rm(jobDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** 把 axios 错误转成可读详情（带上游响应体），便于诊断。 */
  private errDetail(e: unknown): string {
    const em = e instanceof Error ? e.message : String(e);
    const resp = (e as any)?.response?.data;
    const detail = resp ? ` | upstream=${JSON.stringify(resp).slice(0, 300)}` : '';
    return `${em}${detail}`;
  }

  /** 已落盘任务缓存，避免同一任务跨轮询重复下载（进程内有效，重启后由磁盘存在性兜底）。 */
  private localizedTasks = new Set<string>();

  /**
   * 把上游视频落盘到本地 /generated 目录，返回稳定可公开访问的 URL。
   * - 落盘用对象存储抽象（默认 LocalStorage 写 uploads/generated，由 /generated 静态路由对外提供；
   *   COS 已配置时自动落到云存储，返回云 URL）。
   * - 落盘失败不致命：回退返回上游地址，保证成片始终可访问。
   */
  private async localizeVideo(taskId: string, upstreamUrl: string): Promise<string> {
    const key = `agnes-video/${taskId}.mp4`;
    const localUrl = `/generated/${key}`;
    // 进程内已处理 或 本地磁盘已存在 → 直接返回，避免重复下载（重启后仍命中）
    if (this.localizedTasks.has(taskId)) return localUrl;
    try {
      await fs.access(path.join(LOCAL_STORAGE_DIR, key));
      this.localizedTasks.add(taskId);
      return localUrl;
    } catch {
      /* 尚未落盘，继续下载 */
    }
    // 上游偶发抖动会导致下载失败，进而回退返回「跨域原始 URL」，浏览器无法用 download 属性保存。
    // 改为带退避重试，确保成片稳定落盘到自托管 /generated 路径（同源，download 生效）。
    const MAX_RETRY = 3;
    let lastErr: unknown;
    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
      try {
        const resp = await axios.get<Buffer>(upstreamUrl, {
          responseType: 'arraybuffer',
          timeout: 60000,
          headers: { 'User-Agent': 'AIBAK-Platform' },
        });
        const buf = Buffer.from(resp.data);
        if (!buf.length) throw new Error('上游返回空内容');
        const url = await getObjectStorage().put(key, buf, 'video/mp4');
        this.localizedTasks.add(taskId);
        return url;
      } catch (e: unknown) {
        lastErr = e;
        console.warn(`[agnes] 视频落盘第 ${attempt + 1}/${MAX_RETRY} 次失败 task=${taskId}:`, (e as Error)?.message || e);
        if (attempt < MAX_RETRY - 1) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
      }
    }
    console.warn(`[agnes] 视频落盘最终失败 task=${taskId}，回退原始 URL:`, (lastErr as Error)?.message || lastErr);
    return upstreamUrl;
  }

  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const cfg = await this.ensureLoaded();
    const isVideo = params.type === 'text2video' || params.type === 'image2video';

    if (!isVideo) {
      // —— 文生图 / 图生图：同步返回 ——
      const model = this.pickModel(cfg, 'image');
      const n = Math.min(Math.max(Number(params.n) || 1, 1), 4);
      const body: Record<string, unknown> = { model, prompt: params.prompt, n };
      if (params.size) body.size = params.size;
      if (params.imageBase64) body.image_base64 = params.imageBase64;
      if (params.imageUrl) body.image_url = params.imageUrl;
      try {
        const resp = await axios.post(
          `${cfg.baseURL}/images/generations`,
          body,
          { headers: this.headers(cfg), timeout: 90000 }
        );
        const data: any[] = (resp.data && resp.data.data) || [];
        const urls: string[] = data.map((x) => x?.url).filter(Boolean);
        if (!urls.length) {
          throw new AppError(
            502,
            'Agnes 文生图未返回有效图片',
            'MEDIA_PROVIDER_INVALID_RESPONSE'
          );
        }
        const taskId = genTaskId();
        const result: MediaGenResult = {
          type: params.type,
          taskId,
          status: 'completed',
          prompt: params.prompt,
          outputUrl: urls[0],
          images: urls,
          provider: 'agnes',
          note: 'Agnes 文生图完成。',
        };
        await persistTask(taskId, result);
        // 统一异步轮询约定：先返回 processing，前端轮询即拿到 completed
        return { ...result, status: 'processing' };
      } catch (e: unknown) {
        if (e instanceof AppError) throw e;
        const em = e instanceof Error ? e.message : String(e);
        if (isProduction()) {
          throw new AppError(
            503,
            'Agnes 文生图暂时不可用，请稍后重试',
            'MEDIA_PROVIDER_UNAVAILABLE',
            `Agnes image failed: ${em}`
          );
        }
        throw e;
      }
    }

    // —— 文生视频：长视频自动分段，所有片段完成后由父任务合成 ——
    const durationSec = Math.max(Number(params.duration) || 5, 1);
    try {
      const frameRate = Math.min(Math.max(Math.round(Number(params.frameRate) || DEFAULT_FRAME_RATE), 1), 60);
      const segments = this.splitDuration(durationSec, frameRate);
      const submitted: MediaGenResult[] = [];
      for (let index = 0; index < segments.length; index += 1) {
        if (index > 0) await new Promise((resolve) => setTimeout(resolve, VIDEO_RATE_LIMIT_DELAY_MS));
        submitted.push(await this.submitVideo(
          cfg,
          params,
          segments[index],
          `\n镜头 ${index + 1}/${segments.length}，与前后镜头保持一致的主体、场景和视觉风格。`,
        ));
      }

      if (submitted.length === 1) {
        const upstreamTaskId = submitted[0].upstreamTaskId || submitted[0].taskId;
        const result: MediaGenResult = { ...submitted[0], taskId: upstreamTaskId, type: 'text2video', prompt: params.prompt };
        await persistTask(result.taskId, result);
        return result;
      }

      const taskId = genTaskId();
      const result: MediaGenResult = {
        type: 'text2video',
        taskId,
        status: 'processing',
        prompt: params.prompt,
        outputUrl: '',
        duration: durationSec,
        segmentTaskIds: submitted.map((item) => item.upstreamTaskId || item.taskId),
        provider: 'agnes',
        note: `已提交 ${submitted.length} 个 Agnes 视频片段，完成后将自动合成为 ${durationSec} 秒成片。`,
      };
      await persistTask(taskId, result, { segmentTaskIds: result.segmentTaskIds });
      return result;
    } catch (e: unknown) {
      if (e instanceof AppError) throw e;
      if (isProduction()) {
        throw new AppError(
          503,
          'Agnes 视频生成暂时不可用，请稍后重试',
          'MEDIA_PROVIDER_UNAVAILABLE',
          `Agnes video submit failed: ${this.errDetail(e)}`
        );
      }
      throw e;
    }
  }

  async queryTask(taskId: string, _creds?: MediaCredentials): Promise<MediaGenResult> {
    // 远端异步任务（Agnes 视频）：task_xxx 由 Agnes 返回
    if (/^task_/i.test(taskId)) {
      const cfg = await this.ensureLoaded();
      try {
        const resp = await axios.get(
          `${cfg.baseURL}/videos/${taskId}`,
          { headers: this.headers(cfg), timeout: 30000 }
        );
        const d = (resp.data || {}) as Record<string, unknown>;
        const status = String(d.status || '').toLowerCase();
        if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
          throw new AppError(502, 'Agnes 视频生成任务执行失败', 'MEDIA_TASK_FAILED');
        }
        const completed = status === 'completed' || status === 'success' || status === 'succeeded';
        const meta = (d.metadata || {}) as Record<string, unknown>;
        const dataObj = (d.data || {}) as Record<string, unknown>;
        const outputUrl = String(
          d.video_url ||
            d.url ||
            d.output_url ||
            d.download_url ||
            d.file_url ||
            d.result_url ||
            // Agnes 视频完成后 URL 位于 metadata.url（嵌套）
            meta.url ||
            meta.video_url ||
            meta.output_url ||
            dataObj.url ||
            dataObj.video_url ||
            ''
        );
        if (completed && !outputUrl) {
          throw new AppError(
            502,
            'Agnes 视频生成返回了无效结果',
            'MEDIA_PROVIDER_INVALID_RESPONSE'
          );
        }
        // 成片完成后落盘到本地 /generated（或云存储），返回稳定可访问 URL；失败回退上游地址。
        const finalUrl =
          completed && /^https?:\/\//i.test(outputUrl)
            ? await this.localizeVideo(taskId, outputUrl)
            : outputUrl;
        return {
          type: 'text2video',
          taskId,
          status: completed ? 'completed' : 'processing',
          prompt: '',
          outputUrl: finalUrl,
          provider: 'agnes',
          note: completed ? 'Agnes 成片已生成。' : 'Agnes 视频生成中……',
        };
      } catch (e: unknown) {
        if (e instanceof AppError) throw e;
        const em = e instanceof Error ? e.message : String(e);
        if (isProduction()) {
          throw new AppError(
            503,
            'Agnes 视频状态暂时无法查询，请稍后重试',
            'MEDIA_PROVIDER_UNAVAILABLE',
            `Agnes video query failed (task=${taskId}): ${em}`
          );
        }
        return {
          type: 'text2video',
          taskId,
          status: 'processing',
          prompt: '',
          outputUrl: '',
          provider: 'agnes',
          note: 'Agnes 视频状态查询失败，请检查服务。',
        };
      }
    }

    // 本地图片任务或长视频父任务：直接返回持久化结果，父任务会聚合片段状态。
    const stored = await retrieveTask(taskId);
    if (!stored) {
      throw new AppError(404, '媒体任务不存在或已过期', 'MEDIA_TASK_NOT_FOUND');
    }
    if (!stored.segmentTaskIds?.length) return stored;

    const segments = await Promise.all(stored.segmentTaskIds.map((segmentTaskId) => this.queryTask(segmentTaskId)));
    const failed = segments.find((segment) => segment.status === 'failed');
    if (failed) {
      const result: MediaGenResult = { ...stored, status: 'failed', note: failed.note || '一个视频片段生成失败。' };
      await persistTask(taskId, result, { segmentTaskIds: stored.segmentTaskIds });
      return result;
    }
    if (segments.some((segment) => segment.status !== 'completed' || !segment.outputUrl)) {
      return {
        ...stored,
        status: 'processing',
        note: `Agnes 正在生成 ${segments.filter((segment) => segment.status === 'completed').length}/${segments.length} 个视频片段……`,
      };
    }

    try {
      const outputUrl = await this.mergeSegmentVideos(segments.map((segment) => segment.outputUrl), taskId);
      const result: MediaGenResult = {
        ...stored,
        status: 'completed',
        outputUrl,
        note: `Agnes ${segments.length} 个视频片段已合成为 ${stored.duration || '目标'} 秒成片。`,
      };
      await persistTask(taskId, result, { segmentTaskIds: stored.segmentTaskIds });
      return result;
    } catch (e: unknown) {
      const message = `视频片段合成失败：${e instanceof Error ? e.message : String(e)}`;
      const result: MediaGenResult = { ...stored, status: 'failed', note: message };
      await persistTask(taskId, result, { segmentTaskIds: stored.segmentTaskIds });
      return result;
    }
  }
}

export const agnesProvider = new AgnesProvider();
