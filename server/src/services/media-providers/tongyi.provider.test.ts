import { TongyiProvider } from './tongyi.provider';
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('TongyiProvider', () => {
  const p = new TongyiProvider();

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.TONGYI_API_KEY = 'test-key';
  });
  afterEach(() => {
    delete process.env.TONGYI_API_KEY;
  });

  it('声明仅支持 text2img', () => {
    expect(p.name).toBe('tongyi');
    expect(p.supportedTypes).toEqual(['text2img']);
  });

  it('isConfigured 依赖环境变量', () => {
    expect(p.isConfigured()).toBe(true);
    delete process.env.TONGYI_API_KEY;
    expect(p.isConfigured()).toBe(false);
  });

  it('generate 提交异步任务并返回 processing（含 Bearer 鉴权 + 尺寸换算）', async () => {
    mockedAxios.post.mockResolvedValue({ data: { output: { task_id: 'task_abc' } } });
    const res = await p.generate({ type: 'text2img', prompt: '一只猫', size: '1024x1024', n: 1 });
    expect(res.status).toBe('processing');
    expect(res.provider).toBe('tongyi');
    expect(res.taskId).toBe('task_abc');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('/image-synthesis'),
      expect.objectContaining({
        model: 'wanx2.1-t2i-turbo',
        input: { prompt: '一只猫' },
        parameters: expect.objectContaining({ size: '1024*1024', n: 1 }),
      }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) })
    );
  });

  it('generate 未配置抛错', async () => {
    delete process.env.TONGYI_API_KEY;
    await expect(p.generate({ type: 'text2img', prompt: 'x' })).rejects.toThrow(/未配置/);
  });

  it('queryTask 轮询到 SUCCEEDED 返回图片 URL', async () => {
    mockedAxios.get.mockResolvedValue({
      data: { output: { task_status: 'SUCCEEDED', results: [{ url: 'https://img/1.png' }] } },
    });
    const res = await p.queryTask('task_abc');
    expect(res.status).toBe('completed');
    expect(res.outputUrl).toBe('https://img/1.png');
    expect(res.images).toEqual(['https://img/1.png']);
  });

  it('queryTask PENDING 返回 processing', async () => {
    mockedAxios.get.mockResolvedValue({ data: { output: { task_status: 'PENDING' } } });
    const res = await p.queryTask('task_abc');
    expect(res.status).toBe('processing');
  });

  it('queryTask FAILED 抛错', async () => {
    mockedAxios.get.mockResolvedValue({ data: { output: { task_status: 'FAILED', message: 'bad' } } });
    await expect(p.queryTask('task_abc')).rejects.toThrow(/失败/);
  });
});
