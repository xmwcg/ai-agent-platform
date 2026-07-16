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
    const r = await mediaGenService.generate({ type: 'text2video', prompt: '一只猫', duration: 5 });
    expect(r.status).toBe('processing');
    expect(r.duration).toBe(5);
    expect(r.provider).toBe('mock');
  });

  it('空提示词抛错', async () => {
    await expect(mediaGenService.generate({ type: 'image2image', prompt: '' })).rejects.toThrow();
  });

  it('text2img（文生图）在 Mock 下异步返回 processing，轮询后 completed', async () => {
    const gen = await mediaGenService.generate({ type: 'text2img', prompt: '一只猫', size: '1024x1024', n: 1 });
    expect(gen.type).toBe('text2img');
    expect(gen.status).toBe('processing');
    expect(gen.provider).toBe('mock');
    // 轮询：Mock 约 2 秒后完成
    await new Promise((r) => setTimeout(r, 2200));
    const q = await mediaGenService.queryTask('mock', gen.taskId);
    expect(q.status).toBe('completed');
    expect(q.outputUrl).toContain('data:image/svg+xml'); // Mock 占位图
  });

  it('列出 6 个厂商，免费额度可用、其余真实厂商默认未配置、Mock 始终可用', () => {
    const list = listMediaProviders();
    expect(list.length).toBe(6);
    // cloudbase-free 为平台免费额度，默认可用（无需密钥），故 configured=true
    expect(list.find((p) => p.name === 'cloudbase-free')!.configured).toBe(true);
    // 其余真实厂商（混元/可灵/即梦/MPT）默认无密钥，应未配置
    const real = list.filter((p) => p.name !== 'mock' && p.name !== 'cloudbase-free');
    expect(real.every((p) => p.configured === false)).toBe(true);
    expect(list.find((p) => p.name === 'mock')!.configured).toBe(true);
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
