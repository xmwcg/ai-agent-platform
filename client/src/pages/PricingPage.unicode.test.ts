import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pricingPagePath = fileURLToPath(new URL('./PricingPage.tsx', import.meta.url));

describe('价格页中文源码编码', () => {
  it('不应在 JSX/字符串中遗留字面量 Unicode 转义', () => {
    const source = readFileSync(pricingPagePath, 'utf8');
    expect(source).not.toMatch(/\\u[0-9a-fA-F]{4}/);
  });
});
