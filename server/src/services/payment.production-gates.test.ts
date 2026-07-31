import { getPaymentGateway, listPaymentMethods } from './payment.service';

const originalEnv = process.env;

function productionEnv(): NodeJS.ProcessEnv {
  return {
    ...originalEnv,
    NODE_ENV: 'production',
    DEFAULT_PAY_PROVIDER: 'wechat',
    WECHAT_MCH_ID: '1900000001',
    WECHAT_APP_ID: 'wx-app-id',
    WECHAT_API_V3_KEY: '12345678901234567890123456789012',
    WECHAT_CERT_SERIAL: 'merchant-cert-serial',
    WECHAT_PRIVATE_KEY: '-----BEGIN PRIVATE KEY-----\nkey\n-----END PRIVATE KEY-----',
    WECHAT_PLATFORM_CERT: '-----BEGIN CERTIFICATE-----\ncert\n-----END CERTIFICATE-----',
  };
}

describe('生产支付渠道门禁', () => {
  beforeEach(() => {
    process.env = productionEnv();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it.each(['mock', 'alipay', 'stripe'])('生产拒绝 %s 网关', (provider) => {
    expect(() => getPaymentGateway(provider)).toThrow('仅允许微信支付');
  });

  it('生产支付方式只暴露微信', () => {
    expect(listPaymentMethods()).toEqual([
      { key: 'wechat', label: '微信支付', enabled: true },
    ]);
  });

  it('生产微信回调缺少签名头时验签失败', async () => {
    const result = await getPaymentGateway('wechat').verifyWebhook(
      JSON.stringify({ event_type: 'TRANSACTION.SUCCESS' }),
      '',
      {},
    );
    expect(result).toBeNull();
  });

  it('生产缺平台证书时网关不可用', () => {
    delete process.env.WECHAT_PLATFORM_CERT;
    expect(getPaymentGateway('wechat').isConfigured()).toBe(false);
  });
});
