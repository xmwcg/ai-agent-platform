import { CorsOptions } from 'cors';
/**
 * CORS 白名单配置（L6+）
 *
 * - CLIENT_URL 支持逗号分隔多个来源；缺省回退本地开发地址。
 * - 无 origin 的请求（同源 / 服务端 / 健康检查）放行，避免监控与健康检查被误伤。
 * - 非白名单来源拒绝跨域（返回 CORS 错误）。
 * - 支持通配子域名：*.example.com 匹配 app.example.com、admin.example.com 等。
 * - 显式限制方法与请求头，收紧攻击面。
 *
 * ⚠️ 历史坑：此前 CLIENT_URL 在生产被写成 http://localhost:5173（或未注入），
 * 导致「只允许 localhost」——任何真实浏览器（IP / 域名）访问都被整体拦截，
 * 站点表现为「完全不可用」。因此这里在解析 CLIENT_URL 之外，兜底并入平台公网
 * 来源（aibak.site 与服务器 IP），保证即便环境变量缺失，站点也不会被锁死。
 */
export declare const FALLBACK_ORIGINS: string[];
export declare function parseAllowedOrigins(clientUrl?: string): string[];
export declare function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean;
export declare function buildCorsOptions(clientUrl?: string): CorsOptions;
//# sourceMappingURL=cors-config.d.ts.map