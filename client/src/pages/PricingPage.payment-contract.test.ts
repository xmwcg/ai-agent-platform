import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pricingPagePath = fileURLToPath(new URL('./PricingPage.tsx', import.meta.url));

describe('价格页产品订阅下单契约', () => {
  it('应向后端发送正式的 productPackageId 字段', () => {
    const source = readFileSync(pricingPagePath, 'utf8');

    expect(source).toContain('...(isProductSubscription ? { productPackageId: rawId } : {}),');
    expect(source).not.toContain('...(isProductSubscription ? { packageId: rawId } : {}),');
  });
});
