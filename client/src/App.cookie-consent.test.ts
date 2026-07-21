import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

describe('global Cookie consent composition', () => {
  it('mounts one CookieConsentBanner so a single consent choice dismisses the only banner', () => {
    const appSource = readFileSync(fileURLToPath(new URL('./App.tsx', import.meta.url)), 'utf8');
    const mounts = appSource.match(/<CookieConsentBanner\s*\/>/g) ?? [];

    expect(mounts).toHaveLength(1);
  });
});
