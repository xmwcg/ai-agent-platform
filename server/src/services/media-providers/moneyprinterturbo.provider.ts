/** MoneyPrinterTurbo（外部视频工厂）Provider */
import axios from 'axios';
import {
  genTaskId,
  persistTask,
  type MediaGenParams,
  type MediaGenResult,
  type MediaProvider,
  type MediaTaskType,
} from '../media-gen.shared';

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
      await persistTask(jobId, result);
      return result;
    } catch (e: unknown) {
      // 外部服务不可用：回退为本地 processing 占位，仍走 Mock 式轮询告知用户
      const em = e instanceof Error ? e.message : String(e);
      const result: MediaGenResult = {
        type: 'text2video',
        taskId,
        status: 'processing',
        prompt: params.prompt,
        outputUrl: '',
        provider: 'moneyprinterturbo',
        note: `MoneyPrinterTurbo 未连接（${this.baseURL}）：${em}。请确认其 FastAPI 服务已启动。`,
      };
      await persistTask(taskId, result);
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

export { MoneyPrinterTurboProvider };
