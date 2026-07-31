import { getOAuthConfig, isProductionLikeRuntime, OAUTH_CONFIG } from './oauth';

describe('OAuth 动态配置与公网 Mock 防护', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('PUBLIC_BASE_URL 指向公网域名时，即使 NODE_ENV=development 也禁用 Mock', () => {
    const env = {
      NODE_ENV: 'development',
      PUBLIC_BASE_URL: 'https://aibak.site',
    };

    expect(isProductionLikeRuntime(env)).toBe(true);
    const config = getOAuthConfig(env);
    expect(config.wechat.mock).toBe(false);
    expect(config.douyin.mock).toBe(false);
  });

  it('本机开发且未配置凭据时保留 Mock，便于开发联调', () => {
    const config = getOAuthConfig({
      NODE_ENV: 'development',
      PUBLIC_BASE_URL: 'http://localhost:3000',
    });

    expect(config.wechat.mock).toBe(true);
    expect(config.douyin.mock).toBe(true);
  });

  it('相对回调地址会基于 PUBLIC_BASE_URL 解析为厂商可接受的绝对地址', () => {
    const config = getOAuthConfig({
      NODE_ENV: 'production',
      PUBLIC_BASE_URL: 'https://aibak.site',
      WECHAT_OPEN_APPID: 'wx-app-id',
      WECHAT_OPEN_SECRET: 'wx-secret',
      WECHAT_LOGIN_REDIRECT: '/api/auth/wechat/callback',
      DOUYIN_CLIENT_KEY: 'douyin-key',
      DOUYIN_CLIENT_SECRET: 'douyin-secret',
      DOUYIN_REDIRECT_URI: '/api/auth/douyin/callback',
    });

    expect(config.wechat.redirectUri).toBe('https://aibak.site/api/auth/wechat/callback');
    expect(config.douyin.redirectUri).toBe('https://aibak.site/api/auth/douyin/callback');
  });

  it('OAUTH_CONFIG getter 会读取模块导入后才写入的环境变量', () => {
    process.env.NODE_ENV = 'production';
    process.env.PUBLIC_BASE_URL = 'https://aibak.site';
    process.env.WECHAT_OPEN_APPID = 'late-loaded-app-id';
    process.env.WECHAT_OPEN_SECRET = 'late-loaded-secret';

    expect(OAUTH_CONFIG.wechat.enabled).toBe(true);
    expect(OAUTH_CONFIG.wechat.clientId).toBe('late-loaded-app-id');
  });
});
