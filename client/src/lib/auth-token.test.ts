import { describe, expect, it } from 'vitest';
import { clearStoredAuth, decodeJwtPayload, isAccessTokenUsable } from './auth-token';

function makeToken(exp: number): string {
  const payload = btoa(JSON.stringify({ exp })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `header.${payload}.signature`;
}

describe('访问令牌有效期判断', () => {
  it('接受仍在有效期内的 JWT', () => {
    expect(isAccessTokenUsable(makeToken(2_000), 1_000_000, 0)).toBe(true);
    expect(decodeJwtPayload(makeToken(2_000))?.exp).toBe(2_000);
  });

  it('拒绝已过期、即将过期和格式错误的 Token', () => {
    expect(isAccessTokenUsable(makeToken(1_000), 1_000_000, 0)).toBe(false);
    expect(isAccessTokenUsable(makeToken(1_020), 1_000_000, 30_000)).toBe(false);
    expect(isAccessTokenUsable('invalid-token', 1_000_000, 0)).toBe(false);
  });

  it('清理所有持久化登录键', () => {
    const removed: string[] = [];
    clearStoredAuth({ removeItem: (key: string) => { removed.push(key); } });
    expect(removed).toEqual(['token', 'user', 'auth-storage', 'oauth_pending_token']);
  });
});
