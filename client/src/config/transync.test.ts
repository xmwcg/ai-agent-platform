import { describe, expect, it } from 'vitest';
import { normalizeTransyncBaseUrl, transyncAssetUrl } from './transync';

describe('TranSync integration URL', () => {
  it('accepts HTTPS production origins and removes trailing slashes', () => {
    expect(normalizeTransyncBaseUrl(' https://translate.aibak.site/// ')).toBe('https://translate.aibak.site');
  });

  it('allows HTTP only for local development', () => {
    expect(normalizeTransyncBaseUrl('http://localhost:3000')).toBe('http://localhost:3000');
    expect(normalizeTransyncBaseUrl('http://translate.example.com')).toBeNull();
  });

  it('rejects credentials, query strings, hashes, and unsafe schemes', () => {
    expect(normalizeTransyncBaseUrl('https://user:pass@example.com')).toBeNull();
    expect(normalizeTransyncBaseUrl('https://example.com?token=secret')).toBeNull();
    expect(normalizeTransyncBaseUrl('https://example.com/#embed')).toBeNull();
    expect(normalizeTransyncBaseUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeTransyncBaseUrl('https://example.com/subpath')).toBeNull();
  });

  it('builds widget and application URLs from one configured base', () => {
    expect(transyncAssetUrl('https://translate.aibak.site', '/embed.js')).toBe('https://translate.aibak.site/embed.js');
  });
});
