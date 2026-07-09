/**
 * Credits Pricing 配置单元测试
 *
 * 覆盖：定价表完整性、getCreditsCost 函数、积分包结构
 */
import {
  MARKETPLACE_CREDITS_COST,
  CREDITS_PACKAGES,
  getCreditsCost,
} from './credits-pricing';

describe('Credits Pricing Config', () => {
  // ========== 定价表 ==========

  it('所有资源类型都应有定价', () => {
    const resources = ['chat', 'embed', 'compare', 'image'];
    for (const r of resources) {
      expect(MARKETPLACE_CREDITS_COST[r as keyof typeof MARKETPLACE_CREDITS_COST]).toBeGreaterThan(0);
    }
  });

  it('chat 消耗 10 积分', () => {
    expect(MARKETPLACE_CREDITS_COST.chat).toBe(10);
  });

  it('embed 消耗 5 积分', () => {
    expect(MARKETPLACE_CREDITS_COST.embed).toBe(5);
  });

  it('compare 消耗 8 积分', () => {
    expect(MARKETPLACE_CREDITS_COST.compare).toBe(8);
  });

  it('image 消耗 15 积分', () => {
    expect(MARKETPLACE_CREDITS_COST.image).toBe(15);
  });

  // ========== getCreditsCost ==========

  it('已知资源返回正确定价', () => {
    expect(getCreditsCost('chat')).toBe(10);
    expect(getCreditsCost('embed')).toBe(5);
  });

  it('未知资源降级为 10', () => {
    expect(getCreditsCost('unknown')).toBe(10);
  });

  // ========== 积分包 ==========

  it('积分包列表长度 >= 3', () => {
    expect(CREDITS_PACKAGES.length).toBeGreaterThanOrEqual(3);
  });

  it('每个积分包包含必要字段', () => {
    for (const pkg of CREDITS_PACKAGES) {
      expect(pkg.id).toBeTruthy();
      expect(pkg.name).toBeTruthy();
      expect(pkg.credits).toBeGreaterThan(0);
      expect(pkg.price).toBeGreaterThan(0);
      expect(pkg.description).toBeTruthy();
    }
  });

  it('积分包 id 不重复', () => {
    const ids = CREDITS_PACKAGES.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
