/**
 * OAuth 第三方登录配置（微信 / 抖音）
 *
 * - 微信「网站应用」扫码登录：https://open.weixin.qq.com/connect/qrconnect
 * - 抖音「网站应用」扫码登录：https://open.douyin.com/platform/oauth/connect/
 *
 * 配置必须在访问时动态计算，不能在模块导入阶段缓存：入口文件会在导入路由后才执行
 * dotenv.config()，静态读取会导致 .env 中已配置的凭据仍被误判为缺失。
 */

export interface OAuthProviderConfig {
  enabled: boolean;
  /** 是否进入 Mock 模式（仅测试或本机开发环境允许） */
  mock: boolean;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

type OAuthProvider = 'wechat' | 'douyin' | 'wechatMini';
type EnvLike = Record<string, string | undefined>;

function isLocalHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase().replace(/^\[|\]$/g, '');
  return normalized === 'localhost'
    || normalized === '127.0.0.1'
    || normalized === '::1'
    || normalized.endsWith('.localhost');
}

function parseHostname(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    return new URL(value).hostname;
  } catch {
    return null;
  }
}

/**
 * NODE_ENV 被误配为 development 时，只要公开基础地址指向公网域名，也必须按生产处理。
 * 这样可避免 aibak.site 等公网部署意外暴露 Mock 登录。
 */
export function isProductionLikeRuntime(env: EnvLike = process.env): boolean {
  if (env.NODE_ENV === 'production') return true;
  const hostname = parseHostname(env.PUBLIC_BASE_URL);
  return Boolean(hostname && !isLocalHostname(hostname));
}

function oauthMockAllowed(env: EnvLike): boolean {
  if (env.NODE_ENV === 'test') return true;
  if (isProductionLikeRuntime(env)) return false;
  if (env.OAUTH_MOCK_ENABLED === 'false') return false;
  return env.NODE_ENV !== 'production';
}

function resolveRedirectUri(
  explicitValue: string | undefined,
  callbackPath: string,
  env: EnvLike,
): string {
  const baseUrl = env.PUBLIC_BASE_URL?.trim() || 'http://localhost:3000';
  try {
    return new URL(explicitValue?.trim() || callbackPath, baseUrl).toString();
  } catch {
    return `${baseUrl.replace(/\/$/, '')}${callbackPath}`;
  }
}

function buildOAuthConfig(env: EnvLike = process.env): Record<OAuthProvider, OAuthProviderConfig> {
  const wechatEnabled = Boolean(env.WECHAT_OPEN_APPID?.trim() && env.WECHAT_OPEN_SECRET?.trim());
  const wechatMiniEnabled = Boolean(env.WECHAT_MINI_APPID?.trim() && env.WECHAT_MINI_SECRET?.trim());
  const douyinEnabled = Boolean(env.DOUYIN_CLIENT_KEY?.trim() && env.DOUYIN_CLIENT_SECRET?.trim());
  const allowMock = oauthMockAllowed(env);

  return {
    wechat: {
      enabled: wechatEnabled,
      mock: allowMock && !wechatEnabled,
      authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
      tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
      userinfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
      clientId: env.WECHAT_OPEN_APPID?.trim() || '',
      clientSecret: env.WECHAT_OPEN_SECRET?.trim() || '',
      redirectUri: resolveRedirectUri(
        env.WECHAT_LOGIN_REDIRECT,
        '/api/auth/wechat/callback',
        env,
      ),
      scope: 'snsapi_login',
    },
    // 微信小程序登录（引流小程序，code2session 换 openid，独立于网站应用/支付凭据）
    wechatMini: {
      enabled: wechatMiniEnabled,
      mock: allowMock && !wechatMiniEnabled,
      authorizeUrl: '',
      tokenUrl: 'https://api.weixin.qq.com/sns/jscode2session',
      userinfoUrl: '',
      clientId: env.WECHAT_MINI_APPID?.trim() || '',
      clientSecret: env.WECHAT_MINI_SECRET?.trim() || '',
      redirectUri: '',
      scope: 'snsapi_userinfo',
    },
    douyin: {
      enabled: douyinEnabled,
      mock: allowMock && !douyinEnabled,
      authorizeUrl: 'https://open.douyin.com/platform/oauth/connect/',
      tokenUrl: 'https://open.douyin.com/oauth/access_token/',
      userinfoUrl: 'https://open.douyin.com/oauth/userinfo/',
      clientId: env.DOUYIN_CLIENT_KEY?.trim() || '',
      clientSecret: env.DOUYIN_CLIENT_SECRET?.trim() || '',
      redirectUri: resolveRedirectUri(
        env.DOUYIN_REDIRECT_URI,
        '/api/auth/douyin/callback',
        env,
      ),
      scope: 'user_info',
    },
  };
}

/** 便于测试与启动校验复用的动态配置读取函数。 */
export function getOAuthConfig(env: EnvLike = process.env): Record<OAuthProvider, OAuthProviderConfig> {
  return buildOAuthConfig(env);
}

/**
 * 保留原调用方式，同时通过 getter 保证每次访问都读取 dotenv 加载后的最新环境变量。
 */
export const OAUTH_CONFIG: Record<OAuthProvider, OAuthProviderConfig> = {
  get wechat() {
    return buildOAuthConfig().wechat;
  },
  get wechatMini() {
    return buildOAuthConfig().wechatMini;
  },
  get douyin() {
    return buildOAuthConfig().douyin;
  },
};

/**
 * 抖音 OAuth 与微信的关键差异：
 * 1. 参数名：抖音用 client_key / client_secret（微信用 appid / secret）
 * 2. 获取 access_token：抖音用 POST 请求（微信用 GET）
 * 3. scope：抖音 user_info（微信 snsapi_login）
 * 4. 移动端：抖音支持 H5 跳转授权（与 PC 扫码同 URL，自动适配）
 */
