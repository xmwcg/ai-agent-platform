import { buildHelmetOptions } from './security-headers';

describe('security-headers (L7)', () => {
  it('production：开启 HSTS（1 年 + 子域 + preload）', () => {
    const opts = buildHelmetOptions('production');
    expect(opts.hsts).toEqual({ maxAge: 31536000, includeSubDomains: true, preload: true });
  });

  it('development：关闭 HSTS，避免本地 http 被强升', () => {
    const opts = buildHelmetOptions('development');
    expect(opts.hsts).toBe(false);
  });

  it('test：关闭 HSTS', () => {
    const opts = buildHelmetOptions('test');
    expect(opts.hsts).toBe(false);
  });

  it('统一收紧：no-referrer、隐藏 X-Powered-By、禁止 iframe 嵌套', () => {
    const opts = buildHelmetOptions('production');
    expect(opts.referrerPolicy).toEqual({ policy: 'no-referrer' });
    expect(opts.hidePoweredBy).toBe(true);
    expect(opts.frameguard).toEqual({ action: 'deny' });
  });
});
