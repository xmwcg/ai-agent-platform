/**
 * 媒体生成服务 - 内容生产工具矩阵
 * 文生图（已有 text2img） / 图生图 / 文生视频 / 图生视频
 *
 * 差异化设计（避免同质化）：
 * - 多厂商 Provider 抽象（混元 / 可灵 / 即梦 / Mock），统一接口、可插拔、无密钥自动降级演示。
 * - 自动厂商选择：显式指定 > 已配置厂商 > Mock，保证任何环境都能跑通。
 * - 异步任务：视频/图像生成是异步的，统一返回 taskId，并提供 queryTask 轮询接口；
 *   Mock 模拟"提交后 2s 完成"，真实厂商走签名请求（混元 TC3、可灵/即梦 Bearer）。
 */
import axios from 'axios';
import { randomBytes } from 'crypto';
import { signTencentTC3, type TC3SignOptions } from '../lib/tc3';

export type MediaTaskType = 'image2image' | 'text2video' | 'image2video';
export type MediaProviderName = 'mock' | 'hunyuan' | 'keling' | 'jimeng' | 'moneyprinterturbo';

export interface MediaGenParams {
  type: MediaTaskType;
  prompt: string;
  imageBase64?: string;
  negativePrompt?: string;
  duration?: number;
  size?: string;
  style?: string;
  /** 显式指定厂商 */
  provider?: MediaProviderName;
}

export interface MediaGenResult {
  type: MediaTaskType;
  taskId: string;
  status: 'completed' | 'processing';
  prompt: string;
  outputUrl: string;
  thumbnailUrl?: string;
  duration?: number;
  provider: string;
  note: string;
}

export interface MediaProvider {
  name: MediaProviderName;
  label: string;
  supportedTypes: MediaTaskType[];
  isConfigured(): boolean;
  generate(params: MediaGenParams): Promise<MediaGenResult>;
  queryTask?(taskId: string): Promise<MediaGenResult>;
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJkMzU0OCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWkgUHJvZHVjdGlvbiBSZXN1bHQ8L3RleHQ+PC9zdmc+';

function genTaskId(): string {
  return `media_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

/* --------------------------- 腾讯云 TC3-HMAC-SHA256 签名（可单测） --------------------------- */
// 签名算法已抽到 `lib/tc3.ts` 共用（混元对话 / 媒体生成一致），此处仅引用。

/* ------------------------------ 异步任务存储（用于轮询/演示） ------------------------------ */

interface StoredTask extends MediaGenResult {
  createdAt: number;
}
const taskStore = new Map<string, StoredTask>();

/* ------------------------------ Mock ------------------------------ */
class MockProvider implements MediaProvider {
  name = 'mock' as const;
  label = '演示模式（Mock）';
  supportedTypes: MediaTaskType[] = ['image2image', 'text2video', 'image2video'];
  isConfigured() {
    return true;
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const taskId = genTaskId();
    const result: MediaGenResult = {
      type: params.type,
      taskId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      thumbnailUrl: PLACEHOLDER_IMAGE,
      duration: params.type.includes('video') ? params.duration || 5 : undefined,
      provider: 'mock',
      note: 'Mock 模式：任务已提交，约 2 秒后完成（演示异步轮询）。配置对应厂商 API Key 后将生成真实媒体文件。',
    };
    taskStore.set(taskId, { ...result, createdAt: Date.now() });
    return result;
  }
  /** 模拟异步：提交 2 秒后转为已完成并返回占位图 */
  async queryTask(taskId: string): Promise<MediaGenResult> {
    const task = taskStore.get(taskId);
    if (!task) throw new Error('任务不存在或已过期');
    if (Date.now() - task.createdAt > 2000) {
      task.status = 'completed';
      task.outputUrl = PLACEHOLDER_IMAGE;
      task.note = 'Mock 模式：生成完成（占位图）。';
    }
    return task;
  }
}

/* --------------------------- 腾讯混元 / 智绘 --------------------------- */
const HUNYUAN_HOST = 'hunyuan.tencentcloudapi.com';
const HUNYUAN_VERSION = '2023-09-01';

class HunyuanProvider implements MediaProvider {
  name = 'hunyuan' as const;
  label = '腾讯混元 / 智绘';
  supportedTypes: MediaTaskType[] = ['image2image', 'text2video', 'image2video'];
  private get secretId() {
    return process.env.HUNYUAN_SECRET_ID || '';
  }
  private get secretKey() {
    return process.env.HUNYUAN_SECRET_KEY || '';
  }
  isConfigured() {
    return !!this.secretId && !!this.secretKey;
  }
  private buildHeaders(action: string, payload: string): Record<string, string> {
    const timestamp = Math.floor(Date.now() / 1000);
    const { authorization } = signTencentTC3({
      secretId: this.secretId,
      secretKey: this.secretKey,
      service: 'hunyuan',
      host: HUNYUAN_HOST,
      action,
      version: HUNYUAN_VERSION,
      region: 'ap-guangzhou',
      payload,
      timestamp,
    });
    return {
      'Content-Type': 'application/json; charset=utf-8',
      Host: HUNYUAN_HOST,
      'X-TC-Action': action,
      'X-TC-Version': HUNYUAN_VERSION,
      'X-TC-Region': 'ap-guangzhou',
      'X-TC-Timestamp': String(timestamp),
      Authorization: authorization,
    };
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('混元未配置：请在 .env 设置 HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY');
    const isVideo = params.type.includes('video');
    const action = isVideo ? 'SubmitVideoGenerationJob' : 'SubmitImageGenerationJob';
    const body: Record<string, any> = {
      Prompt: params.prompt,
      ...(params.imageBase64 ? { ImageBase64: params.imageBase64 } : {}),
      ...(params.duration ? { Duration: params.duration } : {}),
      ...(params.style ? { Style: params.style } : {}),
    };
    const payload = JSON.stringify(body);
    const resp = await axios.post(`https://${HUNYUAN_HOST}/`, payload, { headers: this.buildHeaders(action, payload) });
    const respData = resp.data?.Response || {};
    if (respData.Error) throw new Error(`混元错误：${respData.Error.Code} ${respData.Error.Message}`);
    const vendorTaskId = String(respData.JobId || respData.TaskId || genTaskId());
    const result: MediaGenResult = {
      type: params.type,
      taskId: vendorTaskId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      provider: 'hunyuan',
      note: `已提交混元任务（Action=${action}），可调用 queryTask 轮询结果。`,
    };
    taskStore.set(vendorTaskId, { ...result, createdAt: Date.now() });
    return result;
  }
  async queryTask(taskId: string): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('混元未配置');
    const isVideo = taskId.toLowerCase().includes('video');
    const action = isVideo ? 'DescribeVideoGenerationJob' : 'DescribeImageGenerationJob';
    const payload = JSON.stringify({ JobId: taskId });
    const resp = await axios.post(`https://${HUNYUAN_HOST}/`, payload, { headers: this.buildHeaders(action, payload) });
    const d = resp.data?.Response || {};
    if (d.Error) throw new Error(`混元查询错误：${d.Error.Code}`);
    const status = (d.Status || d.JobStatus || '').toLowerCase();
    const completed = status === 'succeeded' || status === 'success' || status === 'completed';
    return {
      type: isVideo ? 'text2video' : 'image2image',
      taskId,
      status: completed ? 'completed' : 'processing',
      prompt: '',
      outputUrl: completed ? d.ResultImage || d.ResultVideo || '' : '',
      provider: 'hunyuan',
      note: completed ? '混元任务完成。' : '混元任务处理中……',
    };
  }
}

/* ------------------------------ 可灵 (Kling) ------------------------------ */
class KelingProvider implements MediaProvider {
  name = 'keling' as const;
  label = '可灵 Kling（快手）';
  supportedTypes: MediaTaskType[] = ['text2video', 'image2video'];
  private get apiToken() {
    return process.env.KELING_API_TOKEN || '';
  }
  isConfigured() {
    return !!this.apiToken;
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('可灵未配置：请在 .env 设置 KELING_API_TOKEN');
    const endpoint =
      params.type === 'image2video'
        ? 'https://api.klingai.com/v1/images2videos'
        : 'https://api.klingai.com/v1/text2videos';
    const body = {
      prompt: params.prompt,
      mode: 'std',
      duration: params.duration || 5,
      ...(params.imageBase64 ? { image: params.imageBase64 } : {}),
    };
    const resp = await axios.post(endpoint, body, { headers: { Authorization: `Bearer ${this.apiToken}` } });
    const vendorTaskId = String(resp.data?.data?.task_id || resp.data?.task_id || genTaskId());
    const result: MediaGenResult = {
      type: params.type,
      taskId: vendorTaskId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      provider: 'keling',
      note: '已提交可灵任务，可调用 queryTask 轮询结果。',
    };
    taskStore.set(vendorTaskId, { ...result, createdAt: Date.now() });
    return result;
  }
  async queryTask(taskId: string): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('可灵未配置');
    const resp = await axios.get(`https://api.klingai.com/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${this.apiToken}` },
    });
    const d = resp.data?.data || {};
    const completed = d.task_status === 'succeed' || d.task_status === 'completed';
    return {
      type: params_type_from_status(d),
      taskId,
      status: completed ? 'completed' : 'processing',
      prompt: '',
      outputUrl: completed ? d.task_result?.videos?.[0]?.url || '' : '',
      provider: 'keling',
      note: completed ? '可灵任务完成。' : '可灵任务处理中……',
    };
  }
}

/* ------------------------------ 即梦 (Jimeng) ------------------------------ */
class JimengProvider implements MediaProvider {
  name = 'jimeng' as const;
  label = '即梦 Jimeng（字节）';
  supportedTypes: MediaTaskType[] = ['image2image', 'text2video', 'image2video'];
  private get apiToken() {
    return process.env.JIMENG_API_TOKEN || '';
  }
  isConfigured() {
    return !!this.apiToken;
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('即梦未配置：请在 .env 设置 JIMENG_API_TOKEN');
    const endpoint = 'https://visual.volcengineapi.com/api/v3/visual/media_generation';
    const body = {
      req_key: params.type === 'image2image' ? 'jimeng_image_edit' : 'jimeng_video_gen',
      prompt: params.prompt,
      ...(params.imageBase64 ? { image_base64: params.imageBase64 } : {}),
    };
    const resp = await axios.post(endpoint, body, { headers: { Authorization: `Bearer ${this.apiToken}` } });
    const vendorTaskId = String(resp.data?.data?.task_id || resp.data?.task_id || genTaskId());
    const result: MediaGenResult = {
      type: params.type,
      taskId: vendorTaskId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      provider: 'jimeng',
      note: '已提交即梦任务，可调用 queryTask 轮询结果。',
    };
    taskStore.set(vendorTaskId, { ...result, createdAt: Date.now() });
    return result;
  }
  async queryTask(taskId: string): Promise<MediaGenResult> {
    if (!this.isConfigured()) throw new Error('即梦未配置');
    const endpoint = 'https://visual.volcengineapi.com/api/v3/visual/media_generation/tasks';
    const resp = await axios.post(
      endpoint,
      { task_id: taskId },
      { headers: { Authorization: `Bearer ${this.apiToken}` } }
    );
    const d = resp.data?.data || {};
    const completed = d.status === 'done' || d.status === 'SUCCESS';
    return {
      type: params_type_from_status(d),
      taskId,
      status: completed ? 'completed' : 'processing',
      prompt: '',
      outputUrl: completed ? d.image_urls?.[0] || d.video_url || '' : '',
      provider: 'jimeng',
      note: completed ? '即梦任务完成。' : '即梦任务处理中……',
    };
  }
}

/** 从任务状态对象推断媒体类型（缺省文生视频） */
function params_type_from_status(d: any): MediaTaskType {
  if (d?.type === 'image' || d?.req_key?.includes('image')) return 'image2image';
  return 'text2video';
}

/* ------------------------------ MoneyPrinterTurbo（外部视频工厂） ------------------------------ */
/**
 * 对接 harry0703/MoneyPrinterTurbo（FastAPI 服务，默认 http://127.0.0.1:8080）。
 * 它补齐了「文生视频」从文案→素材→配音→字幕→合成成片的完整链路，
 * 与本项目单帧/单任务式媒体生成形成互补。本项目作为编排方调用其 HTTP API。
 * 仅支持 text2video（整片生成），image2image / image2video 仍走原有厂商。
 */
class MoneyPrinterTurboProvider implements MediaProvider {
  name = 'moneyprinterturbo' as const;
  label = 'MoneyPrinterTurbo（视频工厂）';
  supportedTypes: MediaTaskType[] = ['text2video'];
  private get baseURL() {
    return process.env.MONEY_PRINTER_TURBO_URL || 'http://127.0.0.1:8080';
  }
  isConfigured() {
    // 仅当显式配置了地址时才视为「已配置」，避免干扰自动厂商选择与测试断言
    return !!process.env.MONEY_PRINTER_TURBO_URL;
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const taskId = genTaskId();
    try {
      // MoneyPrinterTurbo 的 /api/start_video_generation 接受 video_subject 等字段
      const resp = await axios.post(
        `${this.baseURL}/api/start_video_generation`,
        {
          video_subject: params.prompt,
          ...(params.duration ? { video_duration: params.duration } : {}),
          ...(params.style ? { voice_name: params.style } : {}),
        },
        { timeout: 8000 }
      );
      const jobId = String(resp.data?.task_id || resp.data?.video_id || taskId);
      const result: MediaGenResult = {
        type: 'text2video',
        taskId: jobId,
        status: 'processing',
        prompt: params.prompt,
        outputUrl: '',
        provider: 'moneyprinterturbo',
        note: '已提交 MoneyPrinterTurbo（整片生成：文案→素材→配音→字幕→合成）。轮询 queryTask 获取成片。',
      };
      taskStore.set(jobId, { ...result, createdAt: Date.now() });
      return result;
    } catch (e: any) {
      // 外部服务不可用：回退为本地 processing 占位，仍走 Mock 式轮询告知用户
      const result: MediaGenResult = {
        type: 'text2video',
        taskId,
        status: 'processing',
        prompt: params.prompt,
        outputUrl: '',
        provider: 'moneyprinterturbo',
        note: `MoneyPrinterTurbo 未连接（${this.baseURL}）：${e.message}。请确认其 FastAPI 服务已启动。`,
      };
      taskStore.set(taskId, { ...result, createdAt: Date.now() });
      return result;
    }
  }
  async queryTask(taskId: string): Promise<MediaGenResult> {
    try {
      const resp = await axios.get(`${this.baseURL}/api/video_status/${taskId}`, { timeout: 8000 });
      const d = resp.data || {};
      const completed = d.status === 'completed' || d.state === 'completed';
      return {
        type: 'text2video',
        taskId,
        status: completed ? 'completed' : 'processing',
        prompt: '',
        outputUrl: completed ? d.video_url || d.file_path || '' : '',
        provider: 'moneyprinterturbo',
        note: completed ? 'MoneyPrinterTurbo 成片已生成。' : 'MoneyPrinterTurbo 制作中……',
      };
    } catch {
      return {
        type: 'text2video',
        taskId,
        status: 'processing',
        prompt: '',
        outputUrl: '',
        provider: 'moneyprinterturbo',
        note: 'MoneyPrinterTurbo 状态查询失败，请检查服务。',
      };
    }
  }
}

const PROVIDERS: Record<MediaProviderName, MediaProvider> = {
  mock: new MockProvider(),
  hunyuan: new HunyuanProvider(),
  keling: new KelingProvider(),
  jimeng: new JimengProvider(),
  moneyprinterturbo: new MoneyPrinterTurboProvider(),
};

export function listMediaProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name,
    label: p.label,
    supportedTypes: p.supportedTypes,
    configured: p.isConfigured(),
  }));
}

/** 厂商选择：显式指定(已配置) > 自动已配置厂商 > Mock */
export function selectMediaProvider(preferred?: MediaProviderName): MediaProvider {
  if (preferred && PROVIDERS[preferred]?.isConfigured()) return PROVIDERS[preferred];
  for (const name of ['hunyuan', 'keling', 'jimeng', 'moneyprinterturbo'] as MediaProviderName[]) {
    if (PROVIDERS[name].isConfigured()) return PROVIDERS[name];
  }
  return PROVIDERS.mock;
}

class MediaGenService {
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!params?.prompt?.trim()) throw new Error('提示词不能为空');
    const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
    const provider = mockMode ? PROVIDERS.mock : selectMediaProvider(params.provider);
    return provider.generate(params);
  }

  /** 轮询异步任务状态（视频/图像生成） */
  async queryTask(providerName: MediaProviderName, taskId: string): Promise<MediaGenResult> {
    const p = PROVIDERS[providerName];
    if (!p) throw new Error('未知厂商');
    if (!p.queryTask) throw new Error('该厂商不支持任务查询');
    return p.queryTask(taskId);
  }
}

export const mediaGenService = new MediaGenService();
