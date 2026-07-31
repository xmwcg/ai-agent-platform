import { validateObject } from '../../lib/validation';
import { createOrderSchema, resolveBillingSourceProduct, resolveProductPackageId } from './logic';

describe('计费产品套餐参数契约', () => {
  it('接受正式 productPackageId 字段', () => {
    const result = validateObject(
      { sourceProduct: 'zhipingtong', productPackageId: 'zpt_enterprise' },
      createOrderSchema
    );

    expect(result).toEqual({ valid: true, errors: [] });
    expect(resolveProductPackageId({ productPackageId: 'zpt_enterprise' })).toBe('zpt_enterprise');
  });

  it('兼容旧前端发送的 packageId 字段', () => {
    const result = validateObject(
      { sourceProduct: 'zhipingtong', packageId: 'zpt_enterprise' },
      createOrderSchema
    );

    expect(result).toEqual({ valid: true, errors: [] });
    expect(resolveProductPackageId({ packageId: 'zpt_enterprise' })).toBe('zpt_enterprise');
  });

  it('拒绝两个套餐字段值不一致的请求', () => {
    expect(() =>
      resolveProductPackageId({ productPackageId: 'zpt_enterprise', packageId: 'zpt_team' })
    ).toThrow('产品套餐参数不一致');
  });

  it('接受 NexMind Guard 产品来源并保持归因', () => {
    const result = validateObject(
      { plan: 'pro', period: 'yearly', sourceProduct: 'guard', productPackageId: 'guard_pro' },
      createOrderSchema
    );

    expect(result).toEqual({ valid: true, errors: [] });
    expect(resolveBillingSourceProduct('guard')).toBe('guard');
    expect(resolveBillingSourceProduct('unknown-product')).toBe('platform');
  });

});
