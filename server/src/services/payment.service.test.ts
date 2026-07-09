import { getPaymentGateway, isRealGateway } from './payment.service';

describe('payment gateway abstraction', () => {
  it('mock gateway returns a pay URL without any network call', async () => {
    const gateway = getPaymentGateway('mock');
    const result = await gateway.createOrder({
      orderNo: 'TEST123',
      amount: 3900,
      currency: 'CNY',
      description: '专业版月付',
    });
    expect(result.provider).toBe('mock');
    expect(result.status).toBe('pending');
    expect(result.payParams.payUrl).toContain('/pay');
    expect(result.amount).toBe(3900);
  });

  it('isRealGateway distinguishes mock from real channels', () => {
    expect(isRealGateway('mock')).toBe(false);
    expect(isRealGateway('wechat')).toBe(true);
    expect(isRealGateway('stripe')).toBe(true);
  });

  it('falls back to mock when an unknown provider is requested', () => {
    // @ts-expect-error 测试非法输入
    const g = getPaymentGateway('unknown');
    expect(g.name).toBe('mock');
  });
});
