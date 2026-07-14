/** 可灵 Kling（快手）Provider */
import axios from 'axios';
import {
  genTaskId,
  persistTask,
  params_type_from_status,
  type MediaGenParams,
  type MediaGenResult,
  type MediaCredentials,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

export class KelingProvider implements MediaProvider {
  name = 'keling' as const;
  label = '可灵 Kling（快手）';
  supportedTypes: MediaTaskType[] = ['text2video', 'image2video'];
  private get envToken() {
    return process.env.KELING_API_TOKEN || '';
  }
  /** BYOK 凭据（secretKey=Bearer Token）优先，否则回退平台环境变量 */
  private resolveToken(creds?: MediaCredentials) {
    return creds?.secretKey ?? this.envToken;
  }
  isConfigured() {
    return !!this.envToken;
  }
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    const token = this.resolveToken(params.credentials);
    if (!token) throw new Error('可灵未配置：请在 .env 设置 KELING_API_TOKEN，或配置自带 Key（BYOK）');
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
    const resp = await axios.post(endpoint, body, { headers: { Authorization: `Bearer ${token}` } });
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
    await persistTask(vendorTaskId, result);
    return result;
  }
  async queryTask(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult> {
    const token = this.resolveToken(credentials);
    if (!token) throw new Error('可灵未配置');
    const resp = await axios.get(`https://api.klingai.com/v1/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${token}` },
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
