import { mediaGenService, listMediaProviders } from './media-gen.service';

describe('媒体生成 - 异步任务与厂商抽象', () => {
  beforeEach(() => {
    delete process.env.HUNYUAN_SECRET_ID;
    delete process.env.HUNYUAN_SECRET_KEY;
    delete process.env.KELING_API_TOKEN;
    delete process.env.JIMENG_API_TOKEN;
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });

  it('listMediaProviders 含完整 8 厂商注册表', () => {
    const list = listMediaProviders();
    expect(list.map((p) => p.name).sort()).toEqual([
      'agnes',
      'cloudbase-free',
      'hunyuan',
      'jimeng',
      'keling',
      'mock',
      'moneyprinterturbo',
      'tongyi',
    ].sort());
    expect(list.find((p) => p.name === 'mock')!.configured).toBe(true);
    expect(list.find((p) => p.name === 'cloudbase-free')!.configured).toBe(true);
  });

  it('Mock 生成后约 2 秒轮询转为已完成', async () => {
    const r = await mediaGenService.generate({ type: 'text2video', prompt: '一只奔跑的猫', provider: 'mock' });
    expect(r.status).toBe('processing');
    expect(r.taskId).toBeTruthy();

    const q1 = await mediaGenService.queryTask('mock', r.taskId);
    expect(q1.status).toBe('processing');

    await new Promise((resolve) => setTimeout(resolve, 2200));
    const q2 = await mediaGenService.queryTask('mock', r.taskId);
    expect(q2.status).toBe('completed');
    expect(q2.outputUrl).toBeTruthy();
  }, 10000);

  it('未知厂商 queryTask 抛错', async () => {
    await expect(mediaGenService.queryTask('unknown' as any, 'x')).rejects.toThrow();
  });
});
