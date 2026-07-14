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

// 平台公网来源兜底：即便 CLIENT_URL 未配置，也不会把站点锁死在 localhost
const FALLBACK_ORIGINS = [
  'http://localhost:5173',
  'https://aibak.site',
  'http://aibak.site',
  'http://159.75.124.59',
  'https://159.75.124.59',
];

export function parseAllowedOrigins(clientUrl?: string): string[] {
  const configured = (clientUrl || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  // 合并：已配置来源 ∪ 兜底来源（去重）
  const merged = new Set<string>([...configured, ...FALLBACK_ORIGINS]);
  return Array.from(merged);
}

export function isOriginAllowed(origin: string | undefined, allowed: string[]): boolean {
  // 无 origin 的请求：放行（健康检查 / 服务端调用 / 同源）。
  // 说明：收紧为 false 会误伤无 Origin 的健康检查与外部监控探针，故保持放行。
  if (!origin) return true;
  // 精确匹配
  if (allowed.includes(origin)) return true;
  // 通配子域名匹配：*.example.com
  for (const pattern of allowed) {
    if (pattern.startsWith('*.')) {
      const suffix = pattern.slice(1); // .example.com
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith(suffix)) return true;
      } catch {
        // 非法 URL 忽略
      }
    }
  }
  return false;
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
    maxAge: 86400, // 预检请求缓存 24h（减少 OPTIONS 请求）
  };
}
