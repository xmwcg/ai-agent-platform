/** JWT 访问令牌的最小载荷结构。 */
interface JwtPayload {
  exp?: number;
}

/** 解析 Base64URL 编码的 JWT 载荷；格式异常时返回 null。 */
export function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(atob(padded)) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * 判断访问令牌是否仍可使用。
 * 默认预留 30 秒时钟偏差，避免用户点击支付时令牌刚好过期。
 */
export function isAccessTokenUsable(
  token: string | null | undefined,
  nowMs = Date.now(),
  clockSkewMs = 30_000
): boolean {
  if (!token) return false;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.exp !== 'number') return false;
  return payload.exp * 1000 > nowMs + clockSkewMs;
}

/** 清理浏览器中所有持久化登录信息。 */
export function clearStoredAuth(storage: Pick<Storage, 'removeItem'> = localStorage): void {
  storage.removeItem('token');
  storage.removeItem('user');
  storage.removeItem('auth-storage');
  storage.removeItem('oauth_pending_token');
}
