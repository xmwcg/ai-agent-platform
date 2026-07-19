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
exports.PaymentAttempt = void 0;
/**
 * 支付尝试记录模型 — 唯一回调事件去重与审计追踪
 *
 * - 每次支付回调（或主动查单确认）创建一条记录
 * - idempotencyKey 唯一索引保证同一回调只处理一次
 * - rawEvent 保存原始回调数据用于对账
 */
const mongoose_1 = __importStar(require("mongoose"));
const paymentAttemptSchema = new mongoose_1.Schema({
    orderNo: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    provider: {
        type: String,
        enum: ["wechat", "stripe", "alipay"],
        required: true,
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "CNY" },
    transactionId: { type: String, index: true },
    eventType: { type: String, required: true },
    status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "duplicate"],
        default: "pending",
    },
    rawEvent: { type: String, maxlength: 4096 },
    errorMessage: { type: String },
    confirmedAt: { type: Date },
}, { timestamps: true });
exports.PaymentAttempt = mongoose_1.default.model("PaymentAttempt", paymentAttemptSchema);
//# sourceMappingURL=PaymentAttempt.js.map