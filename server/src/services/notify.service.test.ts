import axios from 'axios';
import { notify, notifyCostAlert, resolveChannel } from './notify.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('notify.service 生产真实性门禁', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv, NODE_ENV: 'test' };
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('开发/测试未配置时默认 console，生产未配置时默认 disabled', () => {
    delete process.env.NOTIFY_CHANNEL;
    process.env.NODE_ENV = 'test';
    expect(resolveChannel()).toBe('console');
    process.env.NODE_ENV = 'production';
    expect(resolveChannel()).toBe('disabled');
  });

  it('console 仅在非生产环境标记为真实发送', async () => {
    process.env.NOTIFY_CHANNEL = 'console';
    process.env.NODE_ENV = 'test';
    await expect(notify({ to: '', title: '测试', content: 'hello' }))
      .resolves.toMatchObject({ sent: true, channel: 'console' });

    process.env.NODE_ENV = 'production';
    await expect(notify({ to: '', title: '测试', content: 'hello' }))
      .resolves.toMatchObject({ sent: false, channel: 'console' });
  });

  it('未实现短信渠道不得把日志打印冒充发送成功', async () => {
    process.env.NOTIFY_CHANNEL = 'sms';
    const result = await notify({ to: '13800000000', title: '测试', content: 'hello' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('尚未接入真实供应商');
  });

  it('微信配置缺失时明确返回未送达，不降级 console', async () => {
    process.env.NOTIFY_CHANNEL = 'wechat';
    delete process.env.WECHAT_OPEN_APPID;
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_OPEN_SECRET;
    delete process.env.WECHAT_NOTIFY_TEMPLATE_ID;
    const result = await notifyCostAlert('openid_x', 'pro', 300, 500);
    expect(result).toMatchObject({ sent: false, channel: 'wechat' });
    expect(result.error).toContain('配置不完整');
    expect(mockedAxios.get).not.toHaveBeenCalled();
  });

  it('仅微信接口确认成功后才返回 sent=true', async () => {
    process.env.NOTIFY_CHANNEL = 'wechat';
    process.env.WECHAT_OPEN_APPID = 'wx-open-app';
    process.env.WECHAT_OPEN_SECRET = 'secret';
    process.env.WECHAT_NOTIFY_TEMPLATE_ID = 'template';
    mockedAxios.get.mockResolvedValue({ data: { access_token: 'token' } } as any);
    mockedAxios.post.mockResolvedValue({ data: { errcode: 0, msgid: 12345 } } as any);

    const result = await notify({ to: 'openid_x', title: '测试', content: 'hello' });
    expect(result).toEqual({ sent: true, channel: 'wechat', providerMessageId: '12345' });
  });

  it('微信业务错误码返回未送达', async () => {
    process.env.NOTIFY_CHANNEL = 'wechat';
    process.env.WECHAT_OPEN_APPID = 'wx-open-app';
    process.env.WECHAT_OPEN_SECRET = 'secret';
    process.env.WECHAT_NOTIFY_TEMPLATE_ID = 'template';
    mockedAxios.get.mockResolvedValue({ data: { access_token: 'token' } } as any);
    mockedAxios.post.mockResolvedValue({ data: { errcode: 40003, errmsg: 'invalid openid' } } as any);

    const result = await notify({ to: 'bad-openid', title: '测试', content: 'hello' });
    expect(result.sent).toBe(false);
    expect(result.error).toContain('invalid openid');
  });
});