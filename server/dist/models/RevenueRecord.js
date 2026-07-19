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
exports.WithdrawRequest = exports.RevenueRecord = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const RevenueRecordSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    apiKeyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ApiKey', required: true },
    usageLogId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ApiUsageLog' },
    resource: { type: String, required: true },
    callAmount: { type: Number, required: true },
    platformFee: { type: Number, required: true },
    creatorRevenue: { type: Number, required: true },
    platformRate: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'settled', 'withdrawn'],
        default: 'pending',
    },
    settledAt: { type: Date },
    withdrawnAt: { type: Date },
    withdrawRequestId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'WithdrawRequest' },
}, { timestamps: { createdAt: true, updatedAt: false } });
RevenueRecordSchema.index({ userId: 1, createdAt: -1 });
RevenueRecordSchema.index({ userId: 1, status: 1 });
RevenueRecordSchema.index({ apiKeyId: 1 });
RevenueRecordSchema.index({ status: 1 });
exports.RevenueRecord = mongoose_1.default.model('RevenueRecord', RevenueRecordSchema);
const WithdrawRequestSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    amount: { type: Number, required: true },
    fee: { type: Number, required: true, default: 0 },
    netAmount: { type: Number, required: true },
    method: { type: String, enum: ['wechat', 'alipay'], required: true },
    account: { type: String, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'completed', 'rejected'],
        default: 'pending',
    },
    rejectReason: { type: String },
    processedAt: { type: Date },
    transactionId: { type: String },
}, { timestamps: { createdAt: true, updatedAt: true } });
WithdrawRequestSchema.index({ userId: 1, createdAt: -1 });
WithdrawRequestSchema.index({ status: 1 });
exports.WithdrawRequest = mongoose_1.default.model('WithdrawRequest', WithdrawRequestSchema);
//# sourceMappingURL=RevenueRecord.js.map