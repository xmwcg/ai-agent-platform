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
exports.OutboxEvent = void 0;
/**
 * 事务型发件箱模型 — 保证跨服务操作最终一致性
 *
 * - 支付回调 → 权益履约链路中，先写发件箱再返回成功
 * - 后台 Worker 定时拉取 pending 事件并执行
 * - 支持重试次数和指数退避
 */
const mongoose_1 = __importStar(require("mongoose"));
const outboxEventSchema = new mongoose_1.Schema({
    eventType: {
        type: String,
        enum: [
            "payment_confirmed",
            "subscription_activated",
            "credits_granted",
            "refund_confirmed",
            "credits_reversed",
            "order_expired",
        ],
        required: true,
    },
    aggregateId: { type: String, required: true, index: true },
    idempotencyKey: { type: String, required: true, unique: true },
    payload: { type: mongoose_1.Schema.Types.Mixed, required: true },
    status: {
        type: String,
        enum: ["pending", "processing", "done", "failed", "dead"],
        default: "pending",
        index: true,
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextRetryAt: { type: Date, default: Date.now, index: true },
    lastError: { type: String },
    completedAt: { type: Date },
}, { timestamps: true });
// 索引：Worker 拉取待处理事件
outboxEventSchema.index({ status: 1, nextRetryAt: 1 });
exports.OutboxEvent = mongoose_1.default.model("OutboxEvent", outboxEventSchema);
//# sourceMappingURL=OutboxEvent.js.map