import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const router = readFileSync(fileURLToPath(new URL('./router.tsx', import.meta.url)), 'utf8');
const features = readFileSync(fileURLToPath(new URL('./config/site-features.ts', import.meta.url)), 'utf8');

const entries = [
  ['flow', 'FlowPage'],
  ['developer', 'DeveloperPortal'],
  ['admin/knowledge-products', 'AdminKnowledgeProducts'],
] as const;

describe('阶段 0 页面可达性', () => {
  it.each(entries)('挂载 /%s 页面', (route, component) => {
    expect(router).toContain(`path: "${route}"`);
    expect(router).toContain(`<${component} />`);
  });

  it.each(['flow', 'developer', 'admin-knowledge-products'])('功能目录包含 %s', (id) => {
    expect(features).toContain(`id: '${id}'`);
  });
});
