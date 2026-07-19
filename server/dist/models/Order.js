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
exports.Order = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const orderSchema = new mongoose_1.Schema({
    orderNo: { type: String, required: true, unique: true },
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    orderType: { type: String, enum: ["subscription", "credits_pack", "private_license"], default: "subscription" },
    plan: { type: String, enum: ["free", "pro", "max", "team"], required: true },
    packageId: { type: String },
    period: { type: String, enum: ["monthly", "yearly"], default: "monthly" },
    amount: { type: Number, required: true },
    currency: { type: String, default: "CNY" },
    provider: { type: String, enum: ["wechat", "stripe", "alipay", "mock"], default: "mock" },
    status: {
        type: String,
        enum: ["pending", "paid", "failed", "expired", "refunded"],
        default: "pending",
        index: true,
    },
    paymentStatus: {
        type: String,
        enum: ["created", "pending", "paid", "closed", "failed", "refunding", "refunded"],
        default: "created",
        index: true,
    },
    fulfillmentStatus: {
        type: String,
        enum: ["pending", "processing", "fulfilled", "failed", "reversed"],
        default: "pending",
        index: true,
    },
    transactionId: { type: String },
    paymentIntentId: { type: String, index: true },
    payParams: { type: mongoose_1.Schema.Types.Mixed },
    idempotencyKey: { type: String, index: true },
    expiresAt: { type: Date, required: true },
    paidAt: { type: Date },
}, { timestamps: true });
exports.Order = mongoose_1.default.model("Order", orderSchema);
//# sourceMappingURL=Order.js.map