export function normalizeTransyncBaseUrl(value?: string | null): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;

  try {
    const url = new URL(candidate);
    const isLocalHttp = url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !isLocalHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    // 允许 /transync 等子路径（同域名部署时 NGINX 反向代理）
    const cleanPath = url.pathname.replace(/\/+$/, "");
    const allowedPaths = ["", "/transync"];
    if (!allowedPaths.includes(cleanPath)) return null;
    return cleanPath ? `${url.origin}${cleanPath}` : url.origin;
  } catch {
    return null;
  }
}

export function transyncAssetUrl(baseUrl: string, path: string): string {
  const safePath = path.replace(/^\/+/, "");
  return new URL(safePath, `${baseUrl}/`).toString();
}

export const TRANSYNC_BASE_URL = normalizeTransyncBaseUrl(import.meta.env.VITE_TRANSYNC_URL);