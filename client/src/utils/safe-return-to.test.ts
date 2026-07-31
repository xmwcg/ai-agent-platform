import { describe, expect, it } from 'vitest';
import { buildLoginPath, resolveSafeReturnTo } from './safe-return-to';

describe('safe login return path', () => {
  it('preserves a valid ProjectGrade import path', () => {
    const target =
      '/project-grade/projects?source=public-url-scan&importUrl=https%3A%2F%2Fexample.com%2F';
    expect(resolveSafeReturnTo(target)).toBe(target);
    expect(buildLoginPath(target)).toBe(`/login?returnTo=${encodeURIComponent(target)}`);
  });

  it('rejects protocol-relative, absolute, and backslash-normalized external redirects', () => {
    expect(resolveSafeReturnTo('//evil.example')).toBe('/');
    expect(resolveSafeReturnTo('https://evil.example')).toBe('/');
    expect(resolveSafeReturnTo('/\\evil.example')).toBe('/');
  });
});
