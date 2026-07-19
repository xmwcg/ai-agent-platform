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
Object.defineProperty(exports, "__esModule", { value: true });
exports.Refund = void 0;
/**
 * 退款模型 — 完整的退款生命周期管理
 *
 * - refundNo: 高熵唯一退款编号
 * - 状态流转: pending → approved → processing → success/failed
 * - 支持管理员审批、微信真实退款、权益回收、审计记录
 */
const mongoose_1 = __importStar(require("mongoose"));
const refundSchema = new mongoose_1.Schema({
    refundNo: { type: String, required: true, unique: true },
    orderNo: { type: String, required: true, index: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    refundableAmount: { type: Number, required: true, min: 0 },
    actualRefundAmount: { type: Number, default: 0, min: 0 },
    reason: {
        type: String,
        enum: ["duplicate_payment", "voluntary_refund", "service_unavailable", "fraud", "other"],
        required: true,
    },
    userDescription: { type: String, maxlength: 500 },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected", "processing", "success", "failed"],
        default: "pending",
        index: true,
    },
    adminId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User" },
    adminNote: { type: String, maxlength: 1000 },
    wechatRefundId: { type: String },
    providerOrderNo: { type: String },
    repairedAt: { type: Date },
    failedReason: { type: String },
    creditSnapshot: {
        totalCredits: { type: Number, default: 0 },
        consumedCreditsInOrder: { type: Number, default: 0 },
        remainingCreditsInOrder: { type: Number, default: 0 },
    },
}, { timestamps: true });
refundSchema.index({ userId: 1, status: 1 });
refundSchema.index({ wechatRefundId: 1 });
exports.Refund = mongoose_1.default.model("Refund", refundSchema);
//# sourceMappingURL=Refund.js.map