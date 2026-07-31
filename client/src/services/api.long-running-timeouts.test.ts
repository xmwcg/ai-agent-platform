import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./api.ts', import.meta.url)), 'utf8');

describe('长耗时接口超时契约', () => {
  it.each([
    ['/learning-path/generate', 'API_TIMEOUT_MS.aiText'],
    ['/model-config/${id}/test', 'API_TIMEOUT_MS.probe'],
    ['/cs/chat/${embedCode}', 'API_TIMEOUT_MS.customerService'],
    ['/tools/translate', 'API_TIMEOUT_MS.aiText'],
    ['/tools/plan', 'API_TIMEOUT_MS.aiText'],
    ["apiClient.post('/tools/media'", 'API_TIMEOUT_MS.media'],
    ['/xhs/generate', 'API_TIMEOUT_MS.aiText'],
  ])('%s 必须显式使用 %s', (route, timeout) => {
    const routeIndex = source.indexOf(route);
    expect(routeIndex).toBeGreaterThanOrEqual(0);
    expect(source.slice(routeIndex, routeIndex + 260)).toContain(timeout);
  });

  it('ProjectGrade 两类扫描必须使用扫描档位而非全局 10 秒', () => {
    expect(source).toMatch(/url-scan`[^;]+API_TIMEOUT_MS\.projectScan/);
    expect(source).toMatch(/source-scan`[^;]+API_TIMEOUT_MS\.projectScan/);
  });

  it('Axios 超时应转换为中文可操作提示', () => {
    expect(source).toContain("e.code === 'ECONNABORTED'");
    expect(source).toContain('请勿连续重复提交');
  });
});
