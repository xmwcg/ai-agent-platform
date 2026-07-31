import {
  listMediaProviders,
  mediaGenService,
  selectMediaProvider,
} from './media-gen.service';

describe('媒体生成生产安全门禁', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      ENABLE_MOCK_MODE: 'true',
    };
    delete process.env.HUNYUAN_SECRET_ID;
    delete process.env.HUNYUAN_SECRET_KEY;
    delete process.env.KELING_API_TOKEN;
    delete process.env.JIMENG_API_TOKEN;
    delete process.env.MONEY_PRINTER_TURBO_URL;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('生产 Provider 列表明确标记 Mock 不可用', () => {
    const mock = listMediaProviders().find((provider) => provider.name === 'mock');
    expect(mock?.configured).toBe(false);
  });

  it('生产显式请求 Mock 生成被拒绝', async () => {
    await expect(mediaGenService.generate({
      type: 'text2img',
      prompt: '不能返回占位图',
      provider: 'mock',
    })).rejects.toMatchObject({ code: 'MEDIA_MOCK_DISABLED', statusCode: 503 });
  });

  it('生产查询 Mock 任务被拒绝', async () => {
    await expect(mediaGenService.queryTask('mock', 'mock-task'))
      .rejects.toMatchObject({ code: 'MEDIA_MOCK_DISABLED', statusCode: 503 });
  });

  it('生产视频无真实厂商时拒绝服务，不回退 Mock', () => {
    expect(() => selectMediaProvider(undefined, 'text2video'))
      .toThrow(expect.objectContaining({ code: 'MEDIA_PROVIDER_UNAVAILABLE' }));
  });

  it('生产 BYOK 凭据可选择真实混元，不要求平台环境变量', () => {
    const provider = selectMediaProvider(
      'hunyuan',
      'text2video',
      { secretId: 'AKID_BYOK', secretKey: 'BYOK_SECRET' }
    );
    expect(provider.name).toBe('hunyuan');
  });

  it('非生产环境仍保留 Mock 作为开发测试兜底', () => {
    process.env.NODE_ENV = 'test';
    process.env.ENABLE_MOCK_MODE = 'false';
    expect(selectMediaProvider(undefined, 'text2video').name).toBe('mock');
  });
});
