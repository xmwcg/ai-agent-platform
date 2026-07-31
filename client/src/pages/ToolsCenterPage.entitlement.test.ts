import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const toolsPage = readFileSync(fileURLToPath(new URL('./ToolsCenterPage.tsx', import.meta.url)), 'utf8');
const aiTool = readFileSync(fileURLToPath(new URL('../components/tools/AITool.tsx', import.meta.url)), 'utf8');

describe('工具箱商业权益闭环契约', () => {
  it('页面读取权益目录并提供升级/积分跳转', () => {
    expect(toolsPage).toContain('toolsAPI.entitlements()');
    expect(toolsPage).toContain('ToolAccessBoundary');
    expect(toolsPage).toContain("navigate(entitlement.upgradeUrl)");
    expect(toolsPage).toContain("navigate(entitlement.creditsUrl)");
  });

  it('AI 工具请求必须携带 toolId，交由服务端做权益与积分校验', () => {
    expect(aiTool).toContain('toolId: entitlement?.id');
    expect(aiTool).toContain('useToolEntitlement');
  });
});
