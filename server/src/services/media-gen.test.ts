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

  it('列出 5 个厂商，真实厂商默认未配置、Mock 始终可用', () => {
    const list = listMediaProviders();
    expect(list.length).toBe(5);
    const real = list.filter((p) => p.name !== 'mock');
    expect(real.every((p) => p.configured === false)).toBe(true);
    expect(list.find((p) => p.name === 'mock')!.configured).toBe(true);
  });

  it('无配置时自动选择 Mock', () => {
    expect(selectMediaProvider().name).toBe('mock');
  });

  it('配置混元后优先选中混元', () => {
    process.env.HUNYUAN_SECRET_ID = 'id';
    process.env.HUNYUAN_SECRET_KEY = 'key';
    const p = selectMediaProvider();
    expect(p.name).toBe('hunyuan');
    expect(p.isConfigured()).toBe(true);
  });
});
