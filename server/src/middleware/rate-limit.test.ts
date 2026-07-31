import { apiLimiter, authLimiter } from './rate-limit';

/**
 * L5：限流中间件测试。
 * test 环境下两个 limiter 均应 skip（放行），保证集成测试不被误拦；
 * 且导出的必须是可用的 express 中间件（函数，arity 3）。
 */
describe('rate-limit middlewares', () => {
  it('apiLimiter 是 express 中间件函数', () => {
    expect(typeof apiLimiter).toBe('function');
    expect(apiLimiter.length).toBe(3);
  });

  it('authLimiter 是 express 中间件函数', () => {
    expect(typeof authLimiter).toBe('function');
    expect(authLimiter.length).toBe(3);
  });

  it('test 环境下 authLimiter 直接放行（skip），调用 next 且不设置 429', async () => {
    const req: any = { ip: '1.2.3.4', headers: {}, method: 'POST', app: {} };
    const res: any = {
      statusCode: 200,
      status(code: number) {
        this.statusCode = code;
        return this;
      },
      setHeader() {},
      getHeader() {},
      json() {},
      send() {},
      end() {},
    };
    const called = await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => resolve(false), 500);
      authLimiter(req, res, () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    expect(called).toBe(true);
    expect(res.statusCode).not.toBe(429);
  });
});
