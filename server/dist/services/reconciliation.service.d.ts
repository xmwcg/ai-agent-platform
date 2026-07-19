import mongoose from "mongoose";
import { IDifference } from "../models/ReconciliationRecord";
interface WeChatBillRecord {
    tradeState: string;
    transactionId: string;
    outTradeNo: string;
    totalAmount: number;
    tradeType: string;
    finishTime: string;
    refundAmount?: number;
}
export declare class ReconciliationService {
    /**
     * 生成对账批次号：日期 YYYYMMDD
     */
    static genBatchId(date?: Date): string;
    /**
     * 手动触发对账（管理员用）
     * 参数 date: 对账日期，不传则对昨天
     */
    static triggerReconciliation(date?: Date): Promise<mongoose.Document<unknown, {}, import("../models/ReconciliationRecord").IReconciliationRecord, {}, {}> & import("../models/ReconciliationRecord").IReconciliationRecord & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    /**
     * 下载微信交易账单
     * 使用微信 v3 交易账单下载接口
     */
    static downloadWeChatBill(date: Date): Promise<WeChatBillRecord[]>;
    /**
     * 解析微信账单 CSV
     * 格式：交易时间,公众账号ID,商户号,特殊商户号,设备号,微信订单号,商户订单号,用户标识,交易类型,交易状态,付款银行,货币种类,应结订单金额,代金券金额,微信退款单号,商户退款单号,退款金额,充值券退款金额,退款类型,退款状态,商品名称,商户数据包,手续费,费率,订单金额,申请退款金额,费率备注
     */
    static parseWeChatBill(raw: string): WeChatBillRecord[];
    /**
     * 自动重试：尝试通过 webhook event 补全差异
     */
    static autoRetryUnmatched(differences: IDifference[], batchId: string): Promise<void>;
    /**
     * 查询对账列表
     */
    static getReconciliationList(page: number, limit: number): Promise<{
        list: (mongoose.FlattenMaps<import("../models/ReconciliationRecord").IReconciliationRecord> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
    /**
     * 查询对账详情
     */
    static getReconciliationDetail(batchId: string): Promise<mongoose.FlattenMaps<import("../models/ReconciliationRecord").IReconciliationRecord> & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
}
export {};
//# sourceMappingURL=reconciliation.service.d.ts.map