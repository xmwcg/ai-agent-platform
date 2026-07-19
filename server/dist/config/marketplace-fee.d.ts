/**
 * API 市场抽成机制配置
 *
 * 平台抽成比例、最低提现额度、结算周期等核心参数集中管理。
 */
/** 平台抽成比例配置 */
export declare const MARKETPLACE_FEE: {
    /** 平台基础抽成比例 (30%) */
    readonly platformRate: 0.3;
    /** 高等级创作者优惠抽成 (Pro 15%, Max 10%) */
    readonly creatorTierRates: Record<string, number>;
    /** 最低提现金额（分） */
    readonly minWithdrawAmount: 5000;
    /** 提现手续费（固定，分） */
    readonly withdrawFee: 100;
    /** 提现支持的渠道 */
    readonly withdrawMethods: readonly ["wechat", "alipay"];
    /** 收益结算周期（天），收益产生后 N 天自动结算 */
    readonly settlementDays: 7;
    /** 每 API 调用最低收费（分） */
    readonly minChargePerCall: 1;
};
/**
 * 各资源类型的市场定价（分/调用）
 * 创作者设置价格范围 [min, max]
 */
export declare const RESOURCE_PRICING_RANGE: {
    readonly chat: {
        readonly min: 1;
        readonly max: 50;
        readonly default: 5;
    };
    readonly embed: {
        readonly min: 1;
        readonly max: 30;
        readonly default: 3;
    };
    readonly compare: {
        readonly min: 2;
        readonly max: 50;
        readonly default: 10;
    };
    readonly image: {
        readonly min: 5;
        readonly max: 200;
        readonly default: 20;
    };
};
export type MarketplaceResourceType = keyof typeof RESOURCE_PRICING_RANGE;
//# sourceMappingURL=marketplace-fee.d.ts.map