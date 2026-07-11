/**
 * BYOK 凭据注入测试：验证 provider 优先使用随调用传入的 credentials，
 * 而非平台环境变量，且环境变量缺失时凭据注入仍能使生成成功（平台零垫付闭环）。
 */
jest.mock('axios');
import axios from 'axios';
import { HunyuanProvider, KelingProvider, JimengProvider } from './media-gen.service';

const mockedAxios = axios as jest.Mocked<typeof axios>;

beforeEach(() => {
  mockedAxios.post.mockReset();
  mockedAxios.get.mockReset();
  // 默认：混元返回带 JobId 的成功响应
  mockedAxios.post.mockResolvedValue({ data: { Response: { JobId: 'job_test_1' } } });
  mockedAxios.get.mockResolvedValue({ data: { data: { task_status: 'succeed' } } });
  // 清除可能污染测试的平台环境变量
  delete process.env.HUNYUAN_SECRET_ID;
  delete process.env.HUNYUAN_SECRET_KEY;
  delete process.env.KELING_API_TOKEN;
  delete process.env.JIMENG_API_TOKEN;
});

describe('BYOK 凭据注入', () => {
  it('混元：无 env 但传入 credentials 时仍成功生成（证明 BYOK 生效）', async () => {
    const p = new HunyuanProvider();
    const r = await p.generate({
      type: 'text2img',
      prompt: '一只猫',
      credentials: { secretId: 'AKID_BYOK_TEST', secretKey: 'SECRET_BYOK_TEST' },
    });
    expect(r.provider).toBe('hunyuan');
    expect(mockedAxios.post).toHaveBeenCalled();
  });

  it('混元：无 env 且无 credentials 时抛出未配置错误', async () => {
    const p = new HunyuanProvider();
    await expect(p.generate({ type: 'text2img', prompt: 'x' })).rejects.toThrow(/未配置|BYOK/);
  });

  it('可灵：注入的 Bearer Token 直接进入请求头（强断言凭据被使用）', async () => {
    const p = new KelingProvider();
    await p.generate({ type: 'text2video', prompt: 'x', credentials: { secretKey: 'KL_TOKEN_BYOK' } });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('klingai.com'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer KL_TOKEN_BYOK' }),
      })
    );
  });

  it('即梦：注入的 Bearer Token 直接进入请求头', async () => {
    const p = new JimengProvider();
    await p.generate({ type: 'text2video', prompt: 'x', credentials: { secretKey: 'JM_TOKEN_BYOK' } });
    expect(mockedAxios.post).toHaveBeenCalledWith(
      expect.stringContaining('volcengineapi.com'),
      expect.anything(),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer JM_TOKEN_BYOK' }),
      })
    );
  });

  it('可灵：无 env 且无 credentials 时抛出未配置错误', async () => {
    const p = new KelingProvider();
    await expect(p.generate({ type: 'text2video', prompt: 'x' })).rejects.toThrow(/未配置|BYOK/);
  });
});
