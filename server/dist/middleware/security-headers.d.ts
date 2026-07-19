import type { HelmetOptions } from 'helmet';
/**
 * 安全响应头配置（L7）
 *
 * 在 helmet 默认基线上显式收紧：
 * - 生产环境开启 HSTS（强制 HTTPS，含子域，1 年）；非生产不下发 HSTS 避免本地 http 被浏览器缓存强升。
 * - referrerPolicy 设为 no-referrer，避免跨站泄露来源 URL。
 * - 隐藏 X-Powered-By（helmet 默认已移除，这里显式保证）。
 * - CSP 保持 helmet 默认（本服务仅输出 JSON API；前端静态资源由 nginx 层单独治理，避免误伤）。
 */
export declare function buildHelmetOptions(nodeEnv?: string): HelmetOptions;
//# sourceMappingURL=security-headers.d.ts.map