import { mediaGenService, listMediaProviders } from './media-gen.service';

describe('媒体生成 - 异步任务与厂商抽象', () => {
  beforeEach(() => {
    delete process.env.HUNYUAN_SECRET_ID;
    delete process.env.HUNYUAN_SECRET_KEY;
    delete process.env.KELING_API_TOKEN;
    delete process.env.JIMENG_API_TOKEN;
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });

  it('listMediaProviders 含 6 个厂商，Mock 与免费额度可用、其余真实厂商默认未配置', () => {
    const list = listMediaProviders();
    expect(list.length).toBe(6);
    expect(list.find((p) => p.name === 'mock')!.configured).toBe(true);
    // cloudbase-free 为平台免费额度，默认可用
    expect(list.find((p) => p.name === 'cloudbase-free')!.configured).toBe(true);
    // 其余真实厂商（混元/可灵/即梦/MPT）默认无密钥，应未配置
    expect(
      list.filter((p) => p.name !== 'mock' && p.name !== 'cloudbase-free').every((p) => p.configured === false)
    ).toBe(true);
  });

  it('Mock 生成后约 2 秒轮询转为已完成', async () => {
    const r = await mediaGenService.generate({ type: 'text2video', prompt: '一只奔跑的猫' });
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
