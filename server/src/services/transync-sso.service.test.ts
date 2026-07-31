import {
  createAuthorizationCode,
  isValidSsoState,
  normalizeTranSyncOrigin,
  sanitizeTranSyncNext,
  secretMatches,
  ticketStorageKey,
} from './transync-sso.service';

describe('TranSync SSO service guards', () => {
  it('accepts only a dedicated HTTPS origin in production', () => {
    expect(normalizeTranSyncOrigin('https://translate.aibak.site', 'production')).toBe('https://translate.aibak.site');
    expect(normalizeTranSyncOrigin('https://translate.aibak.site/path', 'production')).toBeNull();
    expect(normalizeTranSyncOrigin('http://translate.aibak.site', 'production')).toBeNull();
    expect(normalizeTranSyncOrigin('http://127.0.0.1:3100', 'development')).toBe('http://127.0.0.1:3100');
  });

  it('keeps return paths local to TranSync', () => {
    expect(sanitizeTranSyncNext('/billing?from=aibak')).toBe('/billing?from=aibak');
    expect(sanitizeTranSyncNext('https://evil.example')).toBe('/app');
    expect(sanitizeTranSyncNext('//evil.example')).toBe('/app');
    expect(sanitizeTranSyncNext('/\\evil')).toBe('/app');
  });

  it('uses strong state, opaque codes and constant-time comparable secrets', () => {
    const code = createAuthorizationCode();
    expect(code).toMatch(/^[A-Za-z0-9_-]{32,}$/);
    expect(ticketStorageKey(code)).toMatch(/^sso:transync:[a-f0-9]{64}$/);
    expect(isValidSsoState('a'.repeat(43))).toBe(true);
    expect(isValidSsoState('short')).toBe(false);
    const secret = 's'.repeat(64);
    expect(secretMatches(secret, secret)).toBe(true);
    expect(secretMatches(secret, 'x'.repeat(64))).toBe(false);
    expect(secretMatches('short', 'short')).toBe(false);
  });
});
