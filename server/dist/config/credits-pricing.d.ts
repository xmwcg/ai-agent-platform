/** API 市场资源类型（开放 API 场景的子集） */
export type MarketplaceResource = 'chat' | 'embed' | 'compare' | 'image';
/** 积分扣减定价表：resource → 单次调用消耗积分 */
export declare const MARKETPLACE_CREDITS_COST: Record<MarketplaceResource, number>;
/** 积分包商品 */
export interface CreditsPackage {
    id: string;
    name: string;
    credits: number;
    price: number;
    description: string;
}
/** 可购买的积分包列表 */
export declare const CREDITS_PACKAGES: CreditsPackage[];
/** 根据 resource 查询单次消耗积分 */
export declare function getCreditsCost(resource: string): number;
//# sourceMappingURL=credits-pricing.d.ts.map