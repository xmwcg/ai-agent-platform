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
exports.WebhookEvent = void 0;
/**
 * Webhook 事件记录模型 — 用于幂等性保证和审计追查
 *
 * - 同一 eventId 只能处理一次（MongoDB unique index 防重）
 * - 记录处理状态，支撑失败重试与对账
 * - 30 天 TTL 自动清理，控制存储成本
 */
const mongoose_1 = __importStar(require("mongoose"));
const webhookEventSchema = new mongoose_1.Schema({
    eventId: { type: String, required: true, unique: true },
    provider: { type: String, enum: ['wechat', 'stripe', 'alipay'], required: true },
    orderNo: { type: String, index: true },
    transactionId: { type: String },
    status: {
        type: String,
        enum: ['received', 'processed', 'skipped', 'failed'],
        default: 'received',
    },
    errorMessage: { type: String },
    rawSummary: { type: String, maxlength: 512 },
    receivedAt: { type: Date, default: Date.now },
    processedAt: { type: Date },
}, {
    timestamps: true,
});
// 30 天 TTL 索引：自动清理旧事件
webhookEventSchema.index({ receivedAt: 1 }, { expireAfterSeconds: 30 * 86400 });
exports.WebhookEvent = mongoose_1.default.model('WebhookEvent', webhookEventSchema);
//# sourceMappingURL=WebhookEvent.js.map