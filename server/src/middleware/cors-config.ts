import { CorsOptions } from 'cors';

/**
 * CORS 白名单配置（L6）
 *
 * - CLIENT_URL 支持逗号分隔多个来源；缺省回退本地开发地址。
 * - 无 origin 的请求（同源 / 服务端 / 健康检查）放行。
 * - 非白名单来源拒绝跨域（返回 CORS 错误）。
 * - 显式限制方法与请求头，收紧攻击面。
 */

export function parseAllowedOrigins(clientUrl?: string): string[] {
  const raw = clientUrl || 'http://localhost:5173';
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  // 无 origin（同源请求 / 服务端调用 / curl）放行
  if (!origin) return true;
  return allowed.includes(origin);
}

export function buildCorsOptions(clientUrl?: string): CorsOptions {
  const allowed = parseAllowedOrigins(clientUrl);
  return {
    origin(origin, callback) {
      if (isOriginAllowed(origin, allowed)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS: origin ${origin} 不在允许列表`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Api-Key'],
  };
}
