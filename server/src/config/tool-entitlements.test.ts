import { TOOL_ENTITLEMENTS, getToolEntitlement } from './tool-entitlements';

describe('工具箱权益目录', () => {
  it('七类工具均有唯一权益定义', () => {
    expect(Object.keys(TOOL_ENTITLEMENTS)).toHaveLength(27);
    expect(getToolEntitlement('copywriting')?.requiredPlan).toBe('free');
    expect(getToolEntitlement('competitor')?.requiredPlan).toBe('pro');
    expect(getToolEntitlement('competitor')?.creditCost).toBe(10);
    expect(getToolEntitlement('unknown')).toBeUndefined();
  });
});
