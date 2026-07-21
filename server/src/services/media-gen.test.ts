import { mediaGenService, listMediaProviders, selectMediaProvider } from './media-gen.service';

describe('媒体生成 - 多厂商 Provider 抽象', () => {
  beforeEach(() => {
    delete process.env.HUNYUAN_SECRET_ID;
    delete process.env.HUNYUAN_SECRET_KEY;
    delete process.env.KELING_API_TOKEN;
    delete process.env.JIMENG_API_TOKEN;
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });
  afterEach(() => {
    delete process.env.HUNYUAN_SECRET_ID;
    delete process.env.HUNYUAN_SECRET_KEY;
    delete process.env.KELING_API_TOKEN;
    delete process.env.JIMENG_API_TOKEN;
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });

  it('Mock 模式提交任务返回 processing（异步，需轮询 queryTask）', async () => {
    const r = await mediaGenService.generate({ type: 'text2video', prompt: '一只猫', duration: 5, provider: 'mock' });
    expect(r.status).toBe('processing');
    expect(r.duration).toBe(5);
    expect(r.provider).toBe('mock');
  });

  it('空提示词抛错', async () => {
    await expect(mediaGenService.generate({ type: 'image2image', prompt: '' })).rejects.toThrow();
  });

  it('text2img（文生图）在 Mock 下异步返回 processing，轮询后 completed', async () => {
    const gen = await mediaGenService.generate({ type: 'text2img', prompt: '一只猫', size: '1024x1024', n: 1, provider: 'mock' });
    expect(gen.type).toBe('text2img');
    expect(gen.status).toBe('processing');
    expect(gen.provider).toBe('mock');
    // 轮询：Mock 约 2 秒后完成
    await new Promise((r) => setTimeout(r, 2200));
    const q = await mediaGenService.queryTask('mock', gen.taskId);
    expect(q.status).toBe('completed');
    expect(q.outputUrl).toContain('data:image/svg+xml'); // Mock 占位图
  });

  it('列出完整 8 厂商注册表，Mock 与免费额度始终可用', () => {
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
    expect(list.find((p) => p.name === 'cloudbase-free')!.configured).toBe(true);
    expect(list.find((p) => p.name === 'mock')!.configured).toBe(true);
    // 环境变量型厂商在本测试清空密钥后应保持未配置；Agnes 允许由数据库动态加载。
    for (const name of ['hunyuan', 'keling', 'jimeng', 'moneyprinterturbo', 'tongyi']) {
      expect(list.find((p) => p.name === name)!.configured).toBe(false);
    }
  });

  it('无配置的文生图优先选择真实 CloudBase 免费额度', () => {
    expect(selectMediaProvider().name).toBe('cloudbase-free');
  });

  it('配置混元后优先选中混元', () => {
    process.env.HUNYUAN_SECRET_ID = 'id';
    process.env.HUNYUAN_SECRET_KEY = 'key';
    const p = selectMediaProvider();
    expect(p.name).toBe('hunyuan');
    expect(p.isConfigured()).toBe(true);
  });
});
