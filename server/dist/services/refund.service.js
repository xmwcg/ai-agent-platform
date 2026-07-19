"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.RefundService = void 0;
exports.genRefundNo = genRefundNo;
/**
 * 退款服务 — 退款申请、审批、微信真实退款、权益回收、审计
 *
 * 流程:
 * 1. 用户提交退款申请 → pending
 * 2. 管理员审批 → approved / rejected
 * 3. 系统调用微信退款接口 → processing → success/failed
 * 4. 退款成功后回收权益（积分扣回、订阅降级）→ 写冲正账本
 */
const crypto_1 = __importDefault(require("crypto"));
const mongoose_1 = __importDefault(require("mongoose"));
const axios_1 = __importDefault(require("axios"));
const Refund_1 = require("../models/Refund");
const Order_1 = require("../models/Order");
const User_1 = require("../models/User");
const CreditLot_1 = require("../models/CreditLot");
const OutboxEvent_1 = require("../models/OutboxEvent");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const CreditsTransaction_1 = require("../models/CreditsTransaction");
function genRefundNo() {
    const timePart = Date.now().toString(36).toUpperCase().padStart(9, "0");
    const randomPart = crypto_1.default.randomBytes(8).toString("hex").toUpperCase();
    return "RF" + timePart + randomPart;
}
class RefundService {
    static async submitRefund(input) {
        const order = await Order_1.Order.findOne({ orderNo: input.orderNo });
        if (!order)
            throw new http_error_1.AppError(404, "订单不存在", "ORDER_NOT_FOUND");
        if (order.userId.toString() !== input.userId) {
            throw new http_error_1.AppError(403, "无权操作他人订单", "FORBIDDEN");
        }
        if (order.paymentStatus !== "paid" && order.status !== "paid") {
            throw new http_error_1.AppError(400, "该订单未支付，无法退款", "ORDER_NOT_PAID");
        }
        if (["refunding", "refunded"].includes(order.paymentStatus)) {
            throw new http_error_1.AppError(400, "该订单已在退款流程中", "ORDER_ALREADY_REFUNDING");
        }
        const existingRefund = await Refund_1.Refund.findOne({
            orderNo: input.orderNo,
            status: { $in: ["pending", "approved", "processing"] },
        });
        if (existingRefund) {
            throw new http_error_1.AppError(400, "已有进行中的退款申请", "REFUND_ALREADY_EXISTS");
        }
        const user = await User_1.User.findById(input.userId).select("credits");
        if (!user)
            throw new http_error_1.AppError(404, "用户不存在", "USER_NOT_FOUND");
        let refundableAmount = order.amount;
        let consumedCreditsInOrder = 0;
        if (order.orderType === "credits_pack" && order.packageId) {
            const creditLots = await CreditLot_1.CreditLot.find({
                userId: input.userId,
                sourceOrderNo: input.orderNo,
            });
            const totalGranted = creditLots.reduce((sum, lot) => sum + lot.originalAmount, 0);
            const totalRemaining = creditLots.reduce((sum, lot) => sum + lot.remainingAmount, 0);
            consumedCreditsInOrder = totalGranted - totalRemaining;
            if (totalGranted > 0) {
                const consumedRatio = consumedCreditsInOrder / totalGranted;
                refundableAmount = Math.floor(order.amount * (1 - consumedRatio));
            }
        }
        else if (order.orderType === "subscription") {
            const billing = await Promise.resolve().then(() => __importStar(require("../config/billing")));
            const planConfig = billing.getPlan(order.plan);
            const grantedCredits = planConfig.credits || 0;
            if (grantedCredits > 0) {
                const creditLots = await CreditLot_1.CreditLot.find({
                    userId: input.userId,
                    sourceOrderNo: input.orderNo,
                    sourceType: "subscription_free",
                });
                const totalRemaining = creditLots.reduce((sum, lot) => sum + lot.remainingAmount, 0);
                consumedCreditsInOrder = grantedCredits - totalRemaining;
                if (grantedCredits > 0) {
                    const consumedRatio = consumedCreditsInOrder / grantedCredits;
                    refundableAmount = Math.floor(order.amount * (1 - consumedRatio));
                }
            }
        }
        if (refundableAmount <= 0) {
            throw new http_error_1.AppError(400, "无可退金额（积分已全部消费）", "NOTHING_TO_REFUND");
        }
        const refundNo = genRefundNo();
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                await Refund_1.Refund.create([{
                        refundNo,
                        orderNo: input.orderNo,
                        userId: input.userId,
                        amount: refundableAmount,
                        refundableAmount,
                        actualRefundAmount: 0,
                        reason: input.reason,
                        userDescription: input.description,
                        status: "pending",
                        creditSnapshot: {
                            totalCredits: user.credits,
                            consumedCreditsInOrder,
                            remainingCreditsInOrder: 0,
                        },
                    }], { session });
                await Order_1.Order.updateOne({ orderNo: input.orderNo }, { $set: { paymentStatus: "refunding" } }, { session });
            });
        }
        finally {
            await session.endSession();
        }
        logger_1.logger.info("refund", "退款申请已提交: refundNo=" + refundNo + " orderNo=" + input.orderNo + " amount=" + refundableAmount);
        return { refundNo, orderNo: input.orderNo, amount: refundableAmount, status: "pending" };
    }
    static async approveRefund(input) {
        const refund = await Refund_1.Refund.findOne({ refundNo: input.refundNo });
        if (!refund)
            throw new http_error_1.AppError(404, "退款申请不存在", "REFUND_NOT_FOUND");
        if (refund.status !== "pending") {
            throw new http_error_1.AppError(400, "当前状态 " + refund.status + " 不允许审批", "REFUND_NOT_PENDING");
        }
        const actualAmount = input.actualRefundAmount || refund.refundableAmount;
        if (actualAmount <= 0 || actualAmount > refund.refundableAmount) {
            throw new http_error_1.AppError(400, "退款金额超出可退范围", "INVALID_REFUND_AMOUNT");
        }
        refund.status = "approved";
        refund.adminId = new mongoose_1.default.Types.ObjectId(input.adminId);
        refund.adminNote = input.adminNote;
        refund.actualRefundAmount = actualAmount;
        await refund.save();
        logger_1.logger.info("refund", "退款审批通过: refundNo=" + refund.refundNo + " orderNo=" + refund.orderNo + " amount=" + actualAmount + " adminId=" + input.adminId);
        try {
            await RefundService.executeWechatRefund(refund);
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_1.logger.error("refund", "微信退款执行失败: refundNo=" + refund.refundNo, err);
            refund.status = "failed";
            refund.failedReason = message;
            await refund.save();
        }
        return refund;
    }
    static async rejectRefund(refundNo, adminId, reason) {
        const refund = await Refund_1.Refund.findOne({ refundNo });
        if (!refund)
            throw new http_error_1.AppError(404, "退款申请不存在", "REFUND_NOT_FOUND");
        if (refund.status !== "pending") {
            throw new http_error_1.AppError(400, "当前状态不允许操作", "REFUND_NOT_PENDING");
        }
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                refund.status = "rejected";
                refund.adminId = new mongoose_1.default.Types.ObjectId(adminId);
                refund.adminNote = reason;
                await refund.save({ session });
                await Order_1.Order.updateOne({ orderNo: refund.orderNo }, { $set: { paymentStatus: "paid" } }, { session });
            });
        }
        finally {
            await session.endSession();
        }
        logger_1.logger.info("refund", "退款申请已拒绝: refundNo=" + refundNo + " reason=" + reason);
        return refund;
    }
    static async executeWechatRefund(refund) {
        const mchId = process.env.WECHAT_MCH_ID;
        const apiV3Key = process.env.WECHAT_API_V3_KEY;
        const serialNo = process.env.WECHAT_CERT_SERIAL;
        const privateKey = process.env.WECHAT_PRIVATE_KEY;
        if (!mchId || !apiV3Key || !serialNo || !privateKey) {
            throw new Error("微信支付未完整配置，无法执行退款");
        }
        const order = await Order_1.Order.findOne({ orderNo: refund.orderNo });
        if (!order || !order.transactionId) {
            throw new Error("订单无渠道交易号，无法执行退款");
        }
        refund.status = "processing";
        await refund.save();
        const body = JSON.stringify({
            transaction_id: order.transactionId,
            out_refund_no: refund.refundNo,
            amount: {
                refund: refund.actualRefundAmount,
                total: order.amount,
                currency: "CNY",
            },
            reason: refund.adminNote || "用户申请退款",
        });
        const url = "/v3/refund/domestic/refunds";
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonce = crypto_1.default.randomBytes(16).toString("hex");
        const signStr = "POST\n" + url + "\n" + timestamp + "\n" + nonce + "\n" + body + "\n";
        const sign = crypto_1.default.createSign("RSA-SHA256").update(signStr).sign(privateKey, "base64");
        const response = await axios_1.default.post("https://api.mch.weixin.qq.com" + url, body, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
                Authorization: "WECHATPAY2-SHA256-RSA2048 mchid=\"" + mchId + "\",nonce_str=\"" + nonce + "\",signature=\"" + sign + "\",timestamp=\"" + timestamp + "\",serial_no=\"" + serialNo + "\"",
            },
            timeout: 15000,
        });
        const data = response.data;
        if (data.status === "SUCCESS" || data.status === "PROCESSING") {
            refund.status = "success";
            refund.wechatRefundId = data.refund_id;
            refund.providerOrderNo = data.out_refund_no;
            await RefundService.reverseFulfillment(refund, order);
        }
        else if (data.status === "ABNORMAL") {
            refund.status = "failed";
            refund.failedReason = "微信退款异常: " + data.status;
        }
        else {
            refund.status = "failed";
            refund.failedReason = "微信退款失败: " + JSON.stringify(data);
        }
        await refund.save();
        await OutboxEvent_1.OutboxEvent.create({
            eventType: "refund_confirmed",
            aggregateId: refund.refundNo,
            idempotencyKey: "refund-confirmed:" + refund.refundNo,
            payload: {
                refundNo: refund.refundNo,
                orderNo: refund.orderNo,
                wechatRefundId: refund.wechatRefundId,
                status: refund.status,
                amount: refund.actualRefundAmount,
            },
        });
        return refund;
    }
    static async reverseFulfillment(refund, order) {
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const creditLots = await CreditLot_1.CreditLot.find({
                    userId: refund.userId.toString(),
                    sourceOrderNo: order.orderNo,
                    status: "active",
                }).session(session);
                let totalToReverse = 0;
                for (const lot of creditLots) {
                    if (lot.remainingAmount > 0) {
                        totalToReverse += lot.remainingAmount;
                        lot.remainingAmount = 0;
                        lot.status = "reversed";
                        await lot.save({ session });
                    }
                }
                if (totalToReverse > 0) {
                    const userBefore = await User_1.User.findById(refund.userId).select("credits").session(session);
                    const balanceBefore = Number(userBefore?.credits || 0);
                    if (balanceBefore < totalToReverse) {
                        throw new http_error_1.AppError(409, "退款权益回收失败：积分余额不足", "REFUND_CREDIT_INSUFFICIENT");
                    }
                    const updatedUser = await User_1.User.findOneAndUpdate({ _id: refund.userId, credits: { $gte: totalToReverse } }, { $inc: { credits: -totalToReverse } }, { new: true, session });
                    if (!updatedUser) {
                        throw new http_error_1.AppError(409, "退款权益回收失败：积分余额发生并发变化，请重试", "REFUND_CREDIT_CONFLICT");
                    }
                    const balanceAfter = Number(updatedUser.credits || 0);
                    await CreditsTransaction_1.CreditsTransaction.create([{
                            userId: refund.userId,
                            type: "adjustment",
                            amount: -totalToReverse,
                            balanceBefore,
                            balanceAfter,
                            idempotencyKey: "refund-reverse:" + refund.refundNo,
                            businessType: "refund_reversal",
                            businessId: refund.refundNo,
                            sourceOrderNo: order.orderNo,
                            status: "committed",
                            operatorId: refund.approvedBy?.toString(),
                            auditReason: "订单退款 " + refund.refundNo + " 权益回收",
                            description: "退款 " + refund.refundNo + " 权益回收",
                        }], { session });
                }
                await Order_1.Order.updateOne({ orderNo: order.orderNo }, {
                    $set: {
                        fulfillmentStatus: "reversed",
                        paymentStatus: "refunded",
                        status: "refunded",
                    },
                }, { session });
                refund.repairedAt = new Date();
                await refund.save({ session });
            });
        }
        finally {
            await session.endSession();
        }
        if (order.orderType === "subscription" && order.plan !== "free") {
            await User_1.User.updateOne({ _id: refund.userId }, { $set: { plan: "free", membershipExpiresAt: new Date() } });
        }
        logger_1.logger.info("refund", "权益回收完成: refundNo=" + refund.refundNo);
    }
    static async getRefundDetail(refundNo, userId) {
        const refund = await Refund_1.Refund.findOne({ refundNo }).lean();
        if (!refund)
            throw new http_error_1.AppError(404, "退款申请不存在", "REFUND_NOT_FOUND");
        if (userId && refund.userId.toString() !== userId) {
            throw new http_error_1.AppError(403, "无权查看他人退款", "FORBIDDEN");
        }
        return refund;
    }
    static async getUserRefunds(userId, status) {
        const filter = { userId };
        if (status)
            filter.status = status;
        return Refund_1.Refund.find(filter).sort({ createdAt: -1 }).lean();
    }
    static async getAllRefunds(page, limit, status) {
        const filter = {};
        if (status)
            filter.status = status;
        const [refunds, total] = await Promise.all([
            Refund_1.Refund.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
            Refund_1.Refund.countDocuments(filter),
        ]);
        return { list: refunds, total, page, limit, totalPages: Math.ceil(total / limit) };
    }
}
exports.RefundService = RefundService;
//# sourceMappingURL=refund.service.js.map