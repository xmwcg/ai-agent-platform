import { Response, NextFunction } from 'express';
import { AuthRequest } from '../middleware/auth';
import { MarketplaceResource } from '../config/credits-pricing';
/** enforceApiKey 中间件选项 */
interface EnforceApiKeyOptions {
    /** 资源类型，用于查询积分扣减定价，默认 'chat' */
    resource?: MarketplaceResource;
}
declare const router: import("express-serve-static-core").Router;
/**
 * API Key 鉴权 + 按量配额中间件工厂（开放 API 市场闸门）
 *
 * 支持传入 resource 参数，按资源类型查询积分扣减定价，配额耗尽时自动抵扣积分。
 * 抵扣成功时记录 CreditsTransaction 到 MongoDB，形成完整审计链路。
 *
 * @param options.resource - 资源类型（chat/embed/compare/image），默认 'chat'
 */
export declare function enforceApiKey(options?: EnforceApiKeyOptions): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void>;
export default router;
//# sourceMappingURL=marketplace.d.ts.map