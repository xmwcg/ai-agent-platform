/**
 * OAuth 第三方登录配置（微信 / 抖音）
 *
 * - 微信「网站应用」扫码登录：https://open.weixin.qq.com/connect/qrconnect
 * - 抖音「网站应用」扫码登录：https://open.douyin.com/platform/oauth/connect/
 *
 * 未配置凭据时 enabled=false，前端自动隐藏对应登录入口（Mock 模式除外）。
 */

export interface OAuthProviderConfig {
  enabled: boolean;
  /** 是否进入 Mock 模式（未配置密钥且非生产环境时自动启用，便于前端开发） */
  mock: boolean;
  authorizeUrl: string;
  tokenUrl: string;
  userinfoUrl: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string;
}

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export const OAUTH_CONFIG: Record<'wechat' | 'douyin', OAuthProviderConfig> = {
  wechat: {
    enabled: !!(process.env.WECHAT_OPEN_APPID && process.env.WECHAT_OPEN_SECRET),
    mock: !isProduction() && !(process.env.WECHAT_OPEN_APPID && process.env.WECHAT_OPEN_SECRET),
    authorizeUrl: 'https://open.weixin.qq.com/connect/qrconnect',
    tokenUrl: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    userinfoUrl: 'https://api.weixin.qq.com/sns/userinfo',
    clientId: process.env.WECHAT_OPEN_APPID || '',
    clientSecret: process.env.WECHAT_OPEN_SECRET || '',
    redirectUri:
      process.env.WECHAT_LOGIN_REDIRECT ||
      `${process.env.PUBLIC_BASE_URL || ''}/api/auth/wechat/callback`,
    scope: 'snsapi_login',
  },
  douyin: {
    enabled: !!(process.env.DOUYIN_CLIENT_KEY && process.env.DOUYIN_CLIENT_SECRET),
    mock: !isProduction() && !(process.env.DOUYIN_CLIENT_KEY && process.env.DOUYIN_CLIENT_SECRET),
    authorizeUrl: 'https://open.douyin.com/platform/oauth/connect/',
    tokenUrl: 'https://open.douyin.com/oauth/access_token/',
    userinfoUrl: 'https://open.douyin.com/oauth/userinfo/',
    clientId: process.env.DOUYIN_CLIENT_KEY || '',
    clientSecret: process.env.DOUYIN_CLIENT_SECRET || '',
    redirectUri:
      process.env.DOUYIN_REDIRECT_URI ||
      `${process.env.PUBLIC_BASE_URL || ''}/api/auth/douyin/callback`,
    scope: 'user_info',
  },
};

/**
 * 抖音 OAuth 与微信的关键差异：
 * 1. 参数名：抖音用 client_key / client_secret（微信用 appid / secret）
 * 2. 获取 access_token：抖音用 POST 请求（微信用 GET）
 * 3. scope：抖音 user_info（微信 snsapi_login）
 * 4. 移动端：抖音支持 H5 跳转授权（与 PC 扫码同 URL，自动适配）
 */
