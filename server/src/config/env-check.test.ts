/**
 * env-check 单测（L4）
 * 注意：validateStartupEnv 在 NODE_ENV==='test' 时直接放行，不会调用 process.exit。
 */
import { validateStartupEnv } from './env-check';

describe('validateStartupEnv - JWT_SECRET 弱值检测（L4）', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  it('test 环境下即使弱值也不拦截（CI 单测可用固定密钥）', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'test', JWT_SECRET: 'dev-secret-key-change-in-production' };
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    expect(() => validateStartupEnv()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('production 环境使用弱值会被拦截并退出', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', JWT_SECRET: 'dev-secret-key-change-in-production' };
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    validateStartupEnv();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('development 环境空密钥仅告警不退出', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development', JWT_SECRET: '' };
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    validateStartupEnv();
    expect(exitSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('production 环境使用强密钥不拦截', () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production', JWT_SECRET: 'a-strong-random-secret-'.padEnd(48, 'x') };
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation((() => undefined) as any);
    expect(() => validateStartupEnv()).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
