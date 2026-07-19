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
exports.CreditLot = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CreditLotSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sourceType: {
        type: String,
        enum: ['subscription_free', 'promotion_free', 'purchase', 'refund', 'adjustment', 'legacy_protected'],
        required: true,
    },
    originalAmount: { type: Number, required: true, min: 0 },
    remainingAmount: { type: Number, required: true, min: 0 },
    sourceOrderNo: { type: String, index: true, sparse: true },
    idempotencyKey: { type: String, required: true, default: () => `lot_${Date.now().toString()}_${Math.random().toString(36).slice(2, 10)}` },
    expiresAt: { type: Date },
    status: { type: String, enum: ['active', 'depleted', 'expired', 'reversed'], default: 'active', index: true },
    migrationBatch: { type: String },
    auditReason: { type: String, maxlength: 500 },
}, { timestamps: true });
CreditLotSchema.index({ userId: 1, idempotencyKey: 1 }, { unique: true });
CreditLotSchema.index({ userId: 1, status: 1, expiresAt: 1, createdAt: 1 });
exports.CreditLot = mongoose_1.default.model('CreditLot', CreditLotSchema);
//# sourceMappingURL=CreditLot.js.map