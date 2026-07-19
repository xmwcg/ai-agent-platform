"use strict";
/**
 * API 市场抽成机制配置
 *
 * 平台抽成比例、最低提现额度、结算周期等核心参数集中管理。
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RESOURCE_PRICING_RANGE = exports.MARKETPLACE_FEE = void 0;
/** 平台抽成比例配置 */
exports.MARKETPLACE_FEE = {
    /** 平台基础抽成比例 (30%) */
    platformRate: 0.30,
    /** 高等级创作者优惠抽成 (Pro 15%, Max 10%) */
    creatorTierRates: {
        free: 0.30, // 免费用户：平台抽 30%
        pro: 0.15, // 专业版：平台抽 15%
        max: 0.10, // 旗舰版：平台抽 10%
        team: 0.08, // 团队版：平台抽 8%（企业客户最优）
    },
    /** 最低提现金额（分） */
    minWithdrawAmount: 5000, // ¥50.00
    /** 提现手续费（固定，分） */
    withdrawFee: 100, // ¥1.00
    /** 提现支持的渠道 */
    withdrawMethods: ['wechat', 'alipay'],
    /** 收益结算周期（天），收益产生后 N 天自动结算 */
    settlementDays: 7,
    /** 每 API 调用最低收费（分） */
    minChargePerCall: 1, // ¥0.01
};
/**
 * 各资源类型的市场定价（分/调用）
 * 创作者设置价格范围 [min, max]
 */
exports.RESOURCE_PRICING_RANGE = {
    chat: { min: 1, max: 50, default: 5 },
    embed: { min: 1, max: 30, default: 3 },
    compare: { min: 2, max: 50, default: 10 },
    image: { min: 5, max: 200, default: 20 },
};
//# sourceMappingURL=marketplace-fee.js.map