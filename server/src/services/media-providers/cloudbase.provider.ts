/** 云函数免费额度（HY-Image 文生图 / 图生图）Provider */
import { callCloudbaseImage } from '../cloudbase-ai.service';
import {
  genTaskId,
  persistTask,
  retrieveTask,
  type MediaGenParams,
  type MediaGenResult,
  type MediaCredentials,
  type MediaProvider,
  type MediaTaskType,
  type StoredTask,
} from '../media-gen.shared';

/** Cloudbase 任务持久化时额外携带的参考图字段 */
export interface CloudbaseStoredTask extends StoredTask {
  imageBase64?: string;
  imageUrl?: string;
}

export class CloudbaseImageProvider implements MediaProvider {
  name = 'cloudbase-free' as const;
  label = 'AIbak 免费额度（HY-Image）';
  supportedTypes: MediaTaskType[] = ['text2img', 'image2image'];
  isConfigured() {
    return true; // 免费额度默认可用，无需密钥
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const isImage2Image = params.type === 'image2image';
    const model = isImage2Image
      ? 'HY-Image-v3.0-I2I-ToB-v1.0.1'
      : 'HY-Image-3.0-Plus-4090-Tob-v1.0';
    const taskId = genTaskId();
    const result: MediaGenResult & { imageBase64?: string; imageUrl?: string } = {
      type: params.type,
      taskId,
      status: 'processing',
      prompt: params.prompt,
      outputUrl: '',
      provider: 'cloudbase-free',
      note: '正在调用云函数 HY-Image 免费额度生成图像……',
      // 图生图参考图随任务持久化，供 queryTask 回源
      ...(isImage2Image && params.imageBase64 ? { imageBase64: params.imageBase64 } : {}),
      ...(isImage2Image && params.imageUrl ? { imageUrl: params.imageUrl } : {}),
    };
    await persistTask(taskId, result);
    return result as MediaGenResult;
  }
  async queryTask(taskId: string, _credentials?: MediaCredentials): Promise<MediaGenResult> {
    const task = (await retrieveTask(taskId)) as CloudbaseStoredTask | null;
    if (!task) throw new Error('任务不存在或已过期');
    if (task.status === 'completed') return task;
    const isImage2Image = task.type === 'image2image';
    const model = isImage2Image
      ? 'HY-Image-v3.0-I2I-ToB-v1.0.1'
      : 'HY-Image-3.0-Plus-4090-Tob-v1.0';
    const images = await callCloudbaseImage(model, task.prompt, {
      size: '1024x1024',
      ...(isImage2Image && task.imageBase64 ? { imageBase64: task.imageBase64 } : {}),
      ...(isImage2Image && task.imageUrl ? { imageUrl: task.imageUrl } : {}),
    });
    const completed: MediaGenResult = {
      ...task,
      status: 'completed',
      outputUrl: images[0] || '',
      images,
      provider: 'cloudbase-free',
      note: '云函数 HY-Image 免费额度生成完成。',
    };
    await persistTask(taskId, completed);
    return completed;
  }
}
