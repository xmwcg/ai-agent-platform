import {
  parseAllowedOrigins,
  isOriginAllowed,
  buildCorsOptions,
  FALLBACK_ORIGINS,
} from './cors-config';

describe('cors-config (L6)', () => {
  it('parseAllowedOrigins: 缺省返回兜底公网来源（锁死防护）', () => {
    expect(parseAllowedOrigins(undefined)).toEqual(FALLBACK_ORIGINS);
  });

  it('parseAllowedOrigins: 逗号分隔多来源并去空白，且并入兜底来源', () => {
    expect(parseAllowedOrigins('https://a.com, https://b.com ,https://c.com')).toEqual([
      'https://a.com',
      'https://b.com',
      'https://c.com',
      ...FALLBACK_ORIGINS,
    ]);
  });

  it('isOriginAllowed: 无 origin（同源/服务端）放行', () => {
    expect(isOriginAllowed(undefined, ['https://a.com'])).toBe(true);
  });

  it('isOriginAllowed: 白名单命中放行', () => {
    expect(isOriginAllowed('https://a.com', ['https://a.com', 'https://b.com'])).toBe(true);
  });

  it('isOriginAllowed: 非白名单拒绝', () => {
    expect(isOriginAllowed('https://evil.com', ['https://a.com'])).toBe(false);
  });

  it('buildCorsOptions: origin 回调对白名单放行、非白名单报错', () => {
    const opts = buildCorsOptions('https://a.com');
    const originFn = opts.origin as (
      origin: string | undefined,
      cb: (err: Error | null, allow?: boolean) => void
    ) => void;

    let allowed: boolean | undefined;
    originFn('https://a.com', (_e, a) => {
      allowed = a;
    });
    expect(allowed).toBe(true);

    let err: Error | null = null;
    originFn('https://evil.com', (e) => {
      err = e;
    });
    expect(err).toBeInstanceOf(Error);
  });

  it('buildCorsOptions: 限制方法与请求头、开启 credentials', () => {
    const opts = buildCorsOptions('https://a.com');
    expect(opts.credentials).toBe(true);
    expect(opts.methods).toContain('POST');
    expect(opts.allowedHeaders).toContain('Authorization');
  });
});
