/**
 * notify.service 单元测试
 * 验证：控制台渠道可发送、cost 告警不抛异常（旁路）
 */
import { notify, notifyCostAlert, resolveChannel } from './notify.service';

describe('notify.service', () => {
  const orig = process.env.NOTIFY_CHANNEL;
  afterEach(() => {
    process.env.NOTIFY_CHANNEL = orig;
  });

  it('默认渠道为 console', () => {
    delete process.env.NOTIFY_CHANNEL;
    expect(resolveChannel()).toBe('console');
  });

  it('console 渠道发送不抛异常', async () => {
    process.env.NOTIFY_CHANNEL = 'console';
    await expect(
      notify({ to: '', title: '测试', content: 'hello' })
    ).resolves.toBeUndefined();
  });

  it('notifyCostAlert 为旁路，任何渠道不抛异常', async () => {
    process.env.NOTIFY_CHANNEL = 'wechat'; // 故意触发降级（缺配置）
    await expect(
      notifyCostAlert('openid_x', 'pro', 300, 500)
    ).resolves.toBeUndefined();
  });
});
