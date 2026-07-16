import {
  assertStartupEnv,
  collectStartupEnvErrors,
  validateStartupEnv,
} from './env-check';

const validProductionEnv: Record<string, string> = {
  NODE_ENV: 'production',
  ENABLE_MOCK_MODE: 'false',
  MOCK_MODE: 'false',
  DEFAULT_PAY_PROVIDER: 'wechat',
  SANDBOX_MODE: 'remote',
  SANDBOX_REMOTE_URL: 'https://sandbox.internal.example.com',
  SANDBOX_REMOTE_TOKEN: 'sandbox-token-value',
  MONGODB_URI: 'mongodb+srv://user:pass@cluster.example.com/aibak',
  REDIS_URL: 'rediss://default:pass@redis.example.com:6380',
  PUBLIC_BASE_URL: 'https://aibak.site',
  JWT_SECRET: 'x'.repeat(64),
  ENCRYPTION_KEY: 'a'.repeat(64),
  DEEPSEEK_API_KEY: 'real-provider-key',
  WECHAT_MCH_ID: '1900000001',
  WECHAT_APP_ID: 'wx-app-id',
  WECHAT_API_V3_KEY: '12345678901234567890123456789012',
  WECHAT_CERT_SERIAL: 'CERT-SERIAL',
  WECHAT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
  WECHAT_PLATFORM_CERT: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
  NOTIFY_CHANNEL: 'disabled',
};

describe('生产启动环境校验', () => {
  it('完整真实生产配置通过', () => {
    expect(collectStartupEnvErrors(validProductionEnv)).toEqual([]);
    expect(() => assertStartupEnv(validProductionEnv)).not.toThrow();
  });

  it.each([
    'MONGODB_URI',
    'REDIS_URL',
    'ENCRYPTION_KEY',
    'SANDBOX_REMOTE_URL',
    'SANDBOX_REMOTE_TOKEN',
    'WECHAT_MCH_ID',
    'WECHAT_APP_ID',
    'WECHAT_API_V3_KEY',
    'WECHAT_CERT_SERIAL',
    'WECHAT_PRIVATE_KEY',
    'WECHAT_PLATFORM_CERT',
  ])('缺少 %s 时拒绝生产启动', (key) => {
    const env = { ...validProductionEnv };
    delete env[key];
    expect(() => assertStartupEnv(env)).toThrow(key);
  });

  it('生产启用任一 Mock 开关时拒绝启动', () => {
    expect(() => assertStartupEnv({ ...validProductionEnv, ENABLE_MOCK_MODE: 'true' }))
      .toThrow('ENABLE_MOCK_MODE');
    expect(() => assertStartupEnv({ ...validProductionEnv, MOCK_MODE: 'true' }))
      .toThrow('MOCK_MODE');
  });

  it('生产支付渠道不是微信时拒绝启动', () => {
    expect(() => assertStartupEnv({ ...validProductionEnv, DEFAULT_PAY_PROVIDER: 'mock' }))
      .toThrow('DEFAULT_PAY_PROVIDER');
  });

  it('没有真实 AI Provider 时拒绝启动', () => {
    const env = { ...validProductionEnv };
    delete env.DEEPSEEK_API_KEY;
    expect(() => assertStartupEnv(env)).toThrow('真实 AI Provider');
  });

  it('生产通知渠道必须显式关闭或使用真实微信渠道', () => {
    const missing = { ...validProductionEnv };
    delete missing.NOTIFY_CHANNEL;
    expect(() => assertStartupEnv(missing)).toThrow('NOTIFY_CHANNEL');
    expect(() => assertStartupEnv({ ...validProductionEnv, NOTIFY_CHANNEL: 'console' }))
      .toThrow('NOTIFY_CHANNEL');
    expect(() => assertStartupEnv({ ...validProductionEnv, NOTIFY_CHANNEL: 'sms' }))
      .toThrow('NOTIFY_CHANNEL');
  });

  it('启用微信通知时必须配置真实模板消息参数', () => {
    expect(() => assertStartupEnv({ ...validProductionEnv, NOTIFY_CHANNEL: 'wechat' }))
      .toThrow('WECHAT_OPEN_APPID');
    expect(() => assertStartupEnv({
      ...validProductionEnv,
      NOTIFY_CHANNEL: 'wechat',
      WECHAT_OPEN_APPID: 'wx-open-app-id',
      WECHAT_OPEN_SECRET: 'real-secret',
      WECHAT_NOTIFY_TEMPLATE_ID: 'template-id',
    })).not.toThrow();
  });
  it('微信平台验签材料必须是 X.509 证书，不能用裸公钥代替', () => {
    const env = {
      ...validProductionEnv,
      WECHAT_PLATFORM_CERT: '-----BEGIN PUBLIC KEY-----\nkey\n-----END PUBLIC KEY-----',
    };
    expect(() => assertStartupEnv(env)).toThrow('X.509 平台证书');
  });

  it('测试环境不执行生产配置门禁', () => {
    expect(() => validateStartupEnv({ NODE_ENV: 'test', JWT_SECRET: 'test' })).not.toThrow();
  });

  it('开发环境弱密钥只告警', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(() => validateStartupEnv({ NODE_ENV: 'development', JWT_SECRET: 'test' })).not.toThrow();
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });
});
