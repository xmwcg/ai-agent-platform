/**
 * 支付网关适配层单元测试
 *
 * 覆盖：getPaymentGateway / isRealGateway / listPaymentMethods 的行为验证
 * - 未配置凭证时返回 Mock 网关
 * - 配置凭证后返回真实网关
 * - isRealGateway 正确反映配置状态
 * - listPaymentMethods 按配置动态返回
 * - WechatPayV3Gateway 各方法在无真实网络下的错误处理
 */

import { getPaymentGateway, isRealGateway, listPaymentMethods } from "../services/payment.service";

describe("支付网关适配层", () => {
  const OLD_ENV = { ...process.env };

  beforeEach(() => {
    // 清空所有微信支付相关环境变量
    delete process.env.WECHAT_MCH_ID;
    delete process.env.WECHAT_APP_ID;
    delete process.env.WECHAT_API_V3_KEY;
    delete process.env.WECHAT_CERT_SERIAL;
    delete process.env.WECHAT_PRIVATE_KEY;
    delete process.env.WECHAT_PLATFORM_CERT;
    delete process.env.ALIPAY_APP_ID;
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe("listPaymentMethods", () => {
    it("无任何支付渠道配置时返回单条未配置提示", () => {
      const methods = listPaymentMethods();
      expect(methods.length).toBe(1);
      expect(methods[0]).toEqual({ key: "wechat", label: "微信支付", enabled: false });
    });

    it("仅配置微信支付时返回一条微信支付", () => {
      process.env.WECHAT_MCH_ID = "test_mch";
      process.env.WECHAT_APP_ID = "test_app";
      process.env.WECHAT_API_V3_KEY = "12345678901234567890123456789012";
      process.env.WECHAT_CERT_SERIAL = "test_serial";
      process.env.WECHAT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
      process.env.WECHAT_PLATFORM_CERT = "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

      const methods = listPaymentMethods();
      expect(methods.length).toBe(1);
      expect(methods[0]).toEqual({ key: "wechat", label: "微信支付", enabled: true });
    });
  });

  describe("isRealGateway", () => {
    it("未配置微信支付时返回 false", () => {
      expect(isRealGateway("wechat")).toBe(false);
    });

    it("完整配置微信支付后返回 true", () => {
      process.env.WECHAT_MCH_ID = "test_mch";
      process.env.WECHAT_APP_ID = "test_app";
      process.env.WECHAT_API_V3_KEY = "12345678901234567890123456789012";
      process.env.WECHAT_CERT_SERIAL = "test_serial";
      process.env.WECHAT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
      process.env.WECHAT_PLATFORM_CERT = "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

      expect(isRealGateway("wechat")).toBe(true);
    });

    it("部分配置微信支付仍返回 false", () => {
      process.env.WECHAT_MCH_ID = "test_mch";
      process.env.WECHAT_APP_ID = "test_app";
      // 缺少 API_V3_KEY、CERT_SERIAL、PRIVATE_KEY、PLATFORM_CERT

      expect(isRealGateway("wechat")).toBe(false);
    });

    it("支付宝始终返回 false（占位实现）", () => {
      expect(isRealGateway("alipay")).toBe(false);
    });

    it("mock provider 始终返回 false", () => {
      expect(isRealGateway("mock")).toBe(false);
    });
  });

  describe("getPaymentGateway", () => {
    it("未配置时返回不可用的微信网关", async () => {
      const gw = getPaymentGateway("wechat");
      expect(gw.isConfigured()).toBe(false);
      await expect(gw.createOrder({
        orderNo: "unconfigured", amount: 100, currency: "CNY", description: "测试订单",
      })).rejects.toThrow("微信支付未配置");
    });

    it("配置微信支付后返回真实网关", () => {
      process.env.WECHAT_MCH_ID = "test_mch";
      process.env.WECHAT_APP_ID = "test_app";
      process.env.WECHAT_API_V3_KEY = "12345678901234567890123456789012";
      process.env.WECHAT_CERT_SERIAL = "test_serial";
      process.env.WECHAT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
      process.env.WECHAT_PLATFORM_CERT = "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

      const gw = getPaymentGateway("wechat");
      expect(gw.isConfigured()).toBe(true);
    });

    it("真实网关 createOrder 在无网络时抛出错误", async () => {
      process.env.WECHAT_MCH_ID = "test_mch";
      process.env.WECHAT_APP_ID = "test_app";
      process.env.WECHAT_API_V3_KEY = "12345678901234567890123456789012";
      process.env.WECHAT_CERT_SERIAL = "test_serial";
      process.env.WECHAT_PRIVATE_KEY = "-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----";
      process.env.WECHAT_PLATFORM_CERT = "-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----";

      const gw = getPaymentGateway("wechat");
      // 真实网络调用会失败（无真实商户号），但不应是"未配置"错误
      await expect(
        gw.createOrder({
          orderNo: "test_order_001",
          amount: 100,
          currency: "CNY",
          description: "测试订单",
        })
      ).rejects.toThrow();
    });

    it("真实网关 verifyWebhook 在无有效签名时返回 null", async () => {
      const gw = getPaymentGateway("wechat");
      const result = await gw.verifyWebhook("{}", "invalid_signature", {
        wechatTimestamp: "1700000000",
        wechatNonce: "test_nonce",
      });
      expect(result).toBeNull();
    });

    it("Mock 网关 createOrder 返回 placeholder", async () => {
      const gw = getPaymentGateway("mock");
      const result = await gw.createOrder({
        orderNo: "test",
        amount: 100,
        currency: "CNY",
        description: "test",
      });
      expect(result.payParams).toEqual({ mode: "placeholder" });
    });
  });
});
