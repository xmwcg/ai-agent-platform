import mongoose from 'mongoose';
import { IReferral } from '../models/Referral';
/**
 * 注册时处理推荐关系：
 * - 根据 referralCode 查找推荐人
 * - 创建 Referral 记录
 * - 建立三级分销链路
 */
export declare function processReferralOnRegister(newUserId: string, referralCode?: string): Promise<void>;
/**
 * 用户首次付费后，激活推荐链路并计算佣金
 */
export declare function activateReferralOnPayment(referredUserId: string, orderAmount: number, // 分
orderId?: string): Promise<void>;
/**
 * 结算佣金（pending → settled）
 */
export declare function settleCommissions(userId: string): Promise<number>;
/**
 * 申请提现：校验可提现余额（已结算且未提现），生成提现单并锁定对应佣金。
 * - 可提现 = 已结算佣金（分） - 已提现（分）
 * - 锁定：将足够的 settled 佣金标记为 withdrawn，并累加 commissionWithdrawn
 */
export declare function requestWithdrawal(userId: string, amountYuan: number, method: 'wechat' | 'alipay', account?: string): Promise<{
    withdrawalId: string;
    availableCents: number;
    amountCents: number;
}>;
/**
 * 获取用户的推荐统计
 */
export declare function getReferralStats(userId: string): Promise<{
    directReferrals: number;
    totalReferrals: number;
    pendingCommission: any;
    settledCommission: any;
    commissionTotal: any;
    paidCommission: any;
    monthlyTrend: {
        month: any;
        amountCents: any;
    }[];
}>;
/**
 * 获取推荐列表（分页）
 */
export declare function getReferralList(userId: string, page?: number, pageSize?: number): Promise<{
    items: (mongoose.Document<unknown, {}, IReferral, {}, {}> & IReferral & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
/**
 * 获取佣金列表（分页）
 */
export declare function getCommissionList(userId: string, page?: number, pageSize?: number): Promise<{
    items: (mongoose.Document<unknown, {}, import("../models/Referral").ICommission, {}, {}> & import("../models/Referral").ICommission & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
    page: number;
    pageSize: number;
}>;
//# sourceMappingURL=referral.service.d.ts.map