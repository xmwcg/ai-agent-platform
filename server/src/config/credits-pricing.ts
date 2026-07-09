/**
 * 积分（Credits）扣减定价配置
 *
 * 定义 API 市场各类资源调用时消耗的积分数。
 * 积分是独立于套餐配额的「按量」货币，仅当 API Key 开启 creditsEnabled
 * 且日配额耗尽时才会触发积分抵扣。
 */
import { QuotaResource } from './billing';

/** API 市场资源类型（开放 API 场景的子集） */
export type MarketplaceResource = 'chat' | 'embed' | 'compare' | 'image';

/** 积分扣减定价表：resource → 单次调用消耗积分 */
export const MARKETPLACE_CREDITS_COST: Record<MarketplaceResource, number> = {
  chat: 10,
  embed: 5,
  compare: 8,
  image: 15,
};

/** 积分包商品 */
export interface CreditsPackage {
  id: string;
  name: string;
  credits: number;
  price: number; // 分
  description: string;
}

/** 可购买的积分包列表 */
export const CREDITS_PACKAGES: CreditsPackage[] = [
  { id: 'credits_100',  name: '100 积分',  credits: 100,  price: 990,   description: '适合轻度 API 调用' },
  { id: 'credits_500',  name: '500 积分',  credits: 500,  price: 3990,  description: '适合日常开发' },
  { id: 'credits_2000', name: '2000 积分', credits: 2000, price: 12900, description: '适合高频调用，性价比最高' },
];

/** 根据 resource 查询单次消耗积分 */
export function getCreditsCost(resource: string): number {
  return (MARKETPLACE_CREDITS_COST as Record<string, number>)[resource] ?? 10;
}
