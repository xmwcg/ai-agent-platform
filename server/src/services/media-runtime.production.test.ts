jest.mock('axios');

import axios from 'axios';
import { MoneyPrinterTurboProvider } from './media-providers/moneyprinterturbo.provider';
import { persistTask, retrieveTask, type MediaGenResult } from './media-gen.shared';

const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('媒体运行期生产 fail-closed', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      MONEY_PRINTER_TURBO_URL: 'https://sandbox.internal.example',
    };
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('MoneyPrinterTurbo 提交失败时拒绝服务，不返回虚假 processing 任务', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('connection refused'));
    const provider = new MoneyPrinterTurboProvider();

    await expect(provider.generate({ type: 'text2video', prompt: '真实视频' }))
      .rejects.toMatchObject({ code: 'MEDIA_PROVIDER_UNAVAILABLE', statusCode: 503 });
  });

  it('MoneyPrinterTurbo 查询失败时拒绝服务，不伪装为仍在处理', async () => {
    mockedAxios.get.mockRejectedValueOnce(new Error('timeout'));
    const provider = new MoneyPrinterTurboProvider();

    await expect(provider.queryTask('real-task-id'))
      .rejects.toMatchObject({ code: 'MEDIA_PROVIDER_UNAVAILABLE', statusCode: 503 });
  });

  it('MoneyPrinterTurbo 已完成但无结果地址时拒绝无效结果', async () => {
    mockedAxios.get.mockResolvedValueOnce({ data: { status: 'completed' } });
    const provider = new MoneyPrinterTurboProvider();

    await expect(provider.queryTask('real-task-id'))
      .rejects.toMatchObject({ code: 'MEDIA_PROVIDER_INVALID_RESPONSE', statusCode: 502 });
  });

  it('MongoDB 未连接时生产任务写入不降级内存', async () => {
    const result: MediaGenResult = {
      type: 'text2video',
      taskId: 'production-task',
      status: 'processing',
      prompt: '真实视频',
      outputUrl: '',
      provider: 'moneyprinterturbo',
      note: 'submitted',
    };

    await expect(persistTask(result.taskId, result))
      .rejects.toMatchObject({ code: 'MEDIA_TASK_STORE_UNAVAILABLE', statusCode: 503 });
  });

  it('MongoDB 未连接时生产任务查询不读取进程内缓存', async () => {
    await expect(retrieveTask('missing-production-task'))
      .rejects.toMatchObject({ code: 'MEDIA_TASK_STORE_UNAVAILABLE', statusCode: 503 });
  });
});
