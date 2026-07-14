/**
 * 媒体生成服务 - 共享层
 * 类型定义、常量、任务存储，以及与具体厂商无关的辅助函数。
 * Provider 实现见 ./media-providers/*，编排层见 ./media-gen.service.ts
 */
import { randomBytes } from 'crypto';
import { MediaTask } from '../models/MediaTask';

export type MediaTaskType = 'text2img' | 'image2image' | 'text2video' | 'image2video';
export type MediaProviderName = 'mock' | 'hunyuan' | 'keling' | 'jimeng' | 'moneyprinterturbo' | 'cloudbase-free';

/**
 * BYOK 凭据（用户自带 Key）。随调用注入，绝不污染单例 provider 实例，避免并发竞态。
 * - 混元（TC3）：secretId + secretKey 一对
 * - 可灵 / 即梦：仅 secretKey（即 Bearer Token）
 */
export interface MediaCredentials {
  secretId?: string;
  secretKey?: string;
}

export interface MediaGenParams {
  type: MediaTaskType;
  prompt: string;
  imageBase64?: string;
  imageUrl?: string;
  negativePrompt?: string;
  duration?: number;
  size?: string;
  style?: string;
  /** 生成数量（文生图，1-4） */
  n?: number;
  /** 显式指定厂商 */
  provider?: MediaProviderName;
  /** BYOK：随调用传入的用户凭据，优先于环境变量（平台级 Key） */
  credentials?: MediaCredentials;
}

export interface MediaGenResult {
  type: MediaTaskType;
  taskId: string;
  status: 'completed' | 'processing';
  prompt: string;
  outputUrl: string;
  /** 多图结果（如混元一次生成多张），outputUrl 为其中主图 */
  images?: string[];
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
  queryTask?(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}

const PLACEHOLDER_IMAGE =
  'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJkMzU0OCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWkgUHJvZHVjdGlvbiBSZXN1bHQ8L3RleHQ+PC9zdmc+';

export function genTaskId(): string {
  return `media_${Date.now()}_${randomBytes(3).toString('hex')}`;
}

/* ------------------------------ 异步任务存储（MongoDB 持久化，服务重启不丢失） ------------------------------ */

export interface StoredTask extends MediaGenResult {
  createdAt: number;
}

/** 内存降级存储（MongoDB 不可用时使用） */
const fallbackStore = new Map<string, StoredTask>();

/** 持久化存储任务状态，MongoDB 不可用时自动降级内存 */
export async function persistTask(taskId: string, result: MediaGenResult): Promise<void> {
  try {
    if (MediaTask.db.readyState === 1) {
      await MediaTask.findOneAndUpdate(
        { taskId },
        {
          taskId,
          type: result.type,
          status: result.status,
          prompt: result.prompt,
          outputUrl: result.outputUrl,
          thumbnailUrl: result.thumbnailUrl,
          duration: result.duration,
          provider: result.provider,
          note: result.note,
        },
        { upsert: true, new: true }
      );
      return;
    }
  } catch { /* MongoDB 不可用时降级 */ }
  fallbackStore.set(taskId, { ...result, createdAt: Date.now() });
}

/** 从持久化存储检索任务，MongoDB 不可用时回退内存 */
export async function retrieveTask(taskId: string): Promise<StoredTask | null> {
  try {
    if (MediaTask.db.readyState === 1) {
      const doc = await MediaTask.findOne({ taskId }).lean();
      if (doc) {
        return {
          type: doc.type,
          taskId: doc.taskId,
          status: doc.status,
          prompt: doc.prompt,
          outputUrl: doc.outputUrl,
          thumbnailUrl: doc.thumbnailUrl,
          duration: doc.duration,
          provider: doc.provider,
          note: doc.note,
          createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
        };
      }
      return null;
    }
  } catch { /* MongoDB 不可用时降级 */ }
  return fallbackStore.get(taskId) || null;
}

/** 从任务状态对象推断媒体类型（缺省文生视频） */
export function params_type_from_status(d: unknown): MediaTaskType {
  if (d && typeof d === 'object') {
    const o = d as Record<string, unknown>;
    if (o['type'] === 'image' || (typeof o['req_key'] === 'string' && o['req_key'].includes('image'))) {
      return 'image2image';
    }
  }
  return 'text2video';
}

export { PLACEHOLDER_IMAGE };
