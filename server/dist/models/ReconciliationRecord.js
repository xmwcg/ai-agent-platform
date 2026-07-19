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
exports.ReconciliationRecord = void 0;
/**
 * 对账记录模型 — 每日自动对账与差异追踪
 *
 * - batchId: 对账批次号（日期 YYYYMMDD）
 * - 记录匹配/不匹配订单和金额差异
 * - 支持手动触发对账和差异处理
 */
const mongoose_1 = __importStar(require("mongoose"));
const differenceSchema = new mongoose_1.Schema({
    orderNo: { type: String, required: true },
    type: {
        type: String,
        enum: ["missing_in_wechat", "missing_in_system", "amount_mismatch", "status_mismatch"],
        required: true,
    },
    systemAmount: { type: Number },
    wechatAmount: { type: Number },
    systemStatus: { type: String },
    wechatStatus: { type: String },
    resolved: { type: Boolean, default: false },
    resolvedAt: { type: Date },
    resolution: { type: String },
}, { _id: false });
const reconciliationRecordSchema = new mongoose_1.Schema({
    batchId: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    dateRange: {
        start: { type: Date, required: true },
        end: { type: Date, required: true },
    },
    totalSystemOrders: { type: Number, required: true },
    totalWechatOrders: { type: Number, default: 0 },
    totalSystemAmount: { type: Number, required: true },
    totalWechatAmount: { type: Number, default: 0 },
    matchedOrders: { type: Number, default: 0 },
    unmatchedOrders: { type: Number, default: 0 },
    differences: { type: [differenceSchema], default: [] },
    status: {
        type: String,
        enum: ["pending", "matched", "partial", "unmatched"],
        default: "pending",
    },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date },
    errorMessage: { type: String },
}, { timestamps: true });
reconciliationRecordSchema.index({ provider: 1, status: 1 });
reconciliationRecordSchema.index({ "dateRange.start": 1, "dateRange.end": 1 });
exports.ReconciliationRecord = mongoose_1.default.model("ReconciliationRecord", reconciliationRecordSchema);
//# sourceMappingURL=ReconciliationRecord.js.map