/** Mock Provider（演示模式，默认可用、永不失败） */
import {
  genTaskId,
  persistTask,
  retrieveTask,
  PLACEHOLDER_IMAGE,
  type MediaGenParams,
  type MediaGenResult,
  type MediaCredentials,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

class MockProvider implements MediaProvider {
  name = 'mock' as const;
  label = '演示模式（Mock）';
  supportedTypes: MediaTaskType[] = ['text2img', 'image2image', 'text2video', 'image2video'];
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
    await persistTask(taskId, result);
    return result;
  }
  /** 模拟异步：提交 2 秒后转为已完成并返回占位图 */
  async queryTask(taskId: string, _credentials?: MediaCredentials): Promise<MediaGenResult> {
    const task = await retrieveTask(taskId);
    if (!task) throw new Error('任务不存在或已过期');
    if (Date.now() - task.createdAt > 2000) {
      task.status = 'completed';
      task.outputUrl = PLACEHOLDER_IMAGE;
      task.note = 'Mock 模式：生成完成（占位图）。';
    }
    return task;
  }
}

export { MockProvider };
