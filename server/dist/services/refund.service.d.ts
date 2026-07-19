import mongoose from "mongoose";
import { RefundReason, RefundStatus } from "../models/Refund";
export declare function genRefundNo(): string;
export interface SubmitRefundInput {
    userId: string;
    orderNo: string;
    reason: RefundReason;
    description?: string;
}
export interface ApproveRefundInput {
    refundNo: string;
    adminId: string;
    actualRefundAmount?: number;
    adminNote: string;
}
export declare class RefundService {
    static submitRefund(input: SubmitRefundInput): Promise<{
        refundNo: string;
        orderNo: string;
        amount: number;
        status: string;
    }>;
    static approveRefund(input: ApproveRefundInput): Promise<mongoose.Document<unknown, {}, import("../models/Refund").IRefund, {}, {}> & import("../models/Refund").IRefund & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static rejectRefund(refundNo: string, adminId: string, reason: string): Promise<mongoose.Document<unknown, {}, import("../models/Refund").IRefund, {}, {}> & import("../models/Refund").IRefund & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static executeWechatRefund(refund: any): Promise<any>;
    static reverseFulfillment(refund: any, order: any): Promise<void>;
    static getRefundDetail(refundNo: string, userId?: string): Promise<mongoose.FlattenMaps<import("../models/Refund").IRefund> & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    }>;
    static getUserRefunds(userId: string, status?: RefundStatus): Promise<(mongoose.FlattenMaps<import("../models/Refund").IRefund> & Required<{
        _id: mongoose.Types.ObjectId;
    }> & {
        __v: number;
    })[]>;
    static getAllRefunds(page: number, limit: number, status?: string): Promise<{
        list: (mongoose.FlattenMaps<import("../models/Refund").IRefund> & Required<{
            _id: mongoose.Types.ObjectId;
        }> & {
            __v: number;
        })[];
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    }>;
}
//# sourceMappingURL=refund.service.d.ts.map