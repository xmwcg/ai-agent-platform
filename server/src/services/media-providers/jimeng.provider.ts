/** 即梦 Jimeng（字节）Provider */
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

export class JimengProvider implements MediaProvider {
  name = 'jimeng' as const;
  label = '即梦 Jimeng（字节）';
  supportedTypes: MediaTaskType[] = ['image2image', 'text2video', 'image2video'];
  private get envToken() {
    return process.env.JIMENG_API_TOKEN || '';
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
    if (!token) throw new Error('即梦未配置：请在 .env 设置 JIMENG_API_TOKEN，或配置自带 Key（BYOK）');
    const endpoint = 'https://visual.volcengineapi.com/api/v3/visual/media_generation';
    const body = {
      req_key: params.type === 'image2image' ? 'jimeng_image_edit' : 'jimeng_video_gen',
      prompt: params.prompt,
      ...(params.imageBase64 ? { image_base64: params.imageBase64 } : {}),
    };
    const resp = await axios.post(endpoint, body, { headers: { Authorization: `Bearer ${token}` } });
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
    await persistTask(vendorTaskId, result);
    return result;
  }
  async queryTask(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult> {
    const token = this.resolveToken(credentials);
    if (!token) throw new Error('即梦未配置');
    const endpoint = 'https://visual.volcengineapi.com/api/v3/visual/media_generation/tasks';
    const resp = await axios.post(
      endpoint,
      { task_id: taskId },
      { headers: { Authorization: `Bearer ${token}` } }
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
