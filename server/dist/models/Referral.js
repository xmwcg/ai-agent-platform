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
exports.Commission = exports.Referral = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const ReferralSchema = new mongoose_1.Schema({
    referrerId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    referredUserId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    level: { type: Number, enum: [1, 2, 3], required: true },
    status: {
        type: String,
        enum: ['pending', 'active'],
        default: 'pending',
    },
    activatedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });
ReferralSchema.index({ referrerId: 1, createdAt: -1 });
ReferralSchema.index({ referrerId: 1, level: 1 });
exports.Referral = mongoose_1.default.model('Referral', ReferralSchema);
const CommissionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    referralId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Referral', required: true },
    orderId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'Order' },
    orderAmount: { type: Number, required: true },
    commissionRate: { type: Number, required: true },
    commissionAmount: { type: Number, required: true },
    level: { type: Number, enum: [1, 2, 3], required: true },
    status: {
        type: String,
        enum: ['pending', 'settled', 'withdrawn'],
        default: 'pending',
    },
    settledAt: { type: Date },
    withdrawnAt: { type: Date },
    withdrawMethod: { type: String, enum: ['wechat', 'alipay'] },
}, { timestamps: { createdAt: true, updatedAt: false } });
CommissionSchema.index({ userId: 1, createdAt: -1 });
CommissionSchema.index({ userId: 1, status: 1 });
CommissionSchema.index({ referralId: 1 });
exports.Commission = mongoose_1.default.model('Commission', CommissionSchema);
//# sourceMappingURL=Referral.js.map