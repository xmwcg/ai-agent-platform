import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./PlatformStatusPage.tsx', import.meta.url)), 'utf8');

describe('公开平台状态页接口契约', () => {
  it('默认必须使用同源生产接口，不能请求用户本机回环地址', () => {
    expect(source).toContain("|| '/api/ops/public-status'");
    expect(source).not.toContain('127.0.0.1:9090/api/public-status');
  });
});
