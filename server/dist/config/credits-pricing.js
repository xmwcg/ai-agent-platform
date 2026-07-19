"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREDITS_PACKAGES = exports.MARKETPLACE_CREDITS_COST = void 0;
exports.getCreditsCost = getCreditsCost;
/** 积分扣减定价表：resource → 单次调用消耗积分 */
exports.MARKETPLACE_CREDITS_COST = {
    chat: 10,
    embed: 5,
    compare: 8,
    image: 15,
};
/** 可购买的积分包列表 */
exports.CREDITS_PACKAGES = [
    { id: 'credits_100', name: '100 积分', credits: 100, price: 990, description: '适合轻度 API 调用' },
    { id: 'credits_500', name: '500 积分', credits: 500, price: 3990, description: '适合日常开发' },
    { id: 'credits_2000', name: '2000 积分', credits: 2000, price: 12900, description: '适合高频调用，性价比最高' },
];
/** 根据 resource 查询单次消耗积分 */
function getCreditsCost(resource) {
    return exports.MARKETPLACE_CREDITS_COST[resource] ?? 10;
}
//# sourceMappingURL=credits-pricing.js.map