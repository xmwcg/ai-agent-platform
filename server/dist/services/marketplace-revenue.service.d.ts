import mongoose from 'mongoose';
import { MarketplaceResourceType } from '../config/marketplace-fee';
/**
 * 记录 API 调用产生的收益（平台抽成 + 创作者分成）
 */
export declare function recordApiRevenue(userId: string, apiKeyId: string, resource: MarketplaceResourceType, callAmount: number): Promise<void>;
/**
 * 获取创作者收益概览
 */
export declare function getCreatorRevenueStats(userId: string): Promise<{
    pendingCount: number;
    pendingRevenue: any;
    settledCount: number;
    settledRevenue: any;
    withdrawnCount: number;
    totalCalls: number;
    canWithdraw: boolean;
    minWithdrawAmount: 5000;
    withdrawFee: 100;
}>;
/**
 * 获取收益明细列表（分页）
 */
export declare function getRevenueList(userId: string, status?: string, page?: number, pageSize?: number): Promise<{
    items: (mongoose.Document<unknown, {}, import("../models/RevenueRecord").IRevenueRecord, {}, {}> & import("../models/RevenueRecord").IRevenueRecord & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
/**
 * 创建提现申请
 */
export declare function createWithdrawRequest(userId: string, amount: number, // 分
method: 'wechat' | 'alipay', account: string): Promise<{
    requestId: mongoose.Types.ObjectId;
    amount: number;
    fee: 100;
    netAmount: number;
    status: string;
}>;
/**
 * 获取提现申请列表
 */
export declare function getWithdrawList(userId: string, page?: number, pageSize?: number): Promise<{
    items: (mongoose.Document<unknown, {}, import("../models/RevenueRecord").IWithdrawRequest, {}, {}> & import("../models/RevenueRecord").IWithdrawRequest & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
/**
 * 按资源类型统计收益
 */
export declare function getRevenueByResource(userId: string): Promise<any[]>;
//# sourceMappingURL=marketplace-revenue.service.d.ts.map