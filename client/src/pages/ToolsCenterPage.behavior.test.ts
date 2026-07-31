import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const source = readFileSync(fileURLToPath(new URL('./ToolsCenterPage.tsx', import.meta.url)), 'utf8');

describe('智能工具箱分类与工具选择契约', () => {
  it('子工具点击必须经过父分类解析，不能把子项 key 当成分类 key', () => {
    expect(source).toContain('handleToolMenuClick(String(key))');
    expect(source).toContain("const separatorIndex = key.indexOf('-')");
    expect(source).not.toContain('onClick={({ key }) => setActiveCat(key)}');
  });

  it('Tabs 必须使用真实工具 key，而不是数组索引 0', () => {
    expect(source).toContain('activeKey={resolvedActiveToolKey}');
    expect(source).toContain('onChange={setActiveToolKey}');
    expect(source).not.toContain('activeKey={Object.keys((tools as any)[activeCat] || {})[0]}');
  });
});
