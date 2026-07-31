import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const files = [
  './FlowPage/FlowPage.tsx',
  './AdminKnowledgeProducts.tsx',
  './DeveloperPortal/DeveloperPortal.tsx',
];

describe('阶段 0 新挂载页面鉴权请求', () => {
  it.each(files)('%s 使用统一 apiClient，不直接使用裸 axios', (relative) => {
    const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
    expect(source).toContain('apiClient');
    expect(source).not.toMatch(/import axios from ['"]axios['"]/);
  });
});
