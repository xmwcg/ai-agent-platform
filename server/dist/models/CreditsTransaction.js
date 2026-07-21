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
exports.CreditsTransaction = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const CreditsTransactionSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true },
    type: {
        type: String,
        enum: [
            'purchase',
            'grant',
            'deduction',
            'refund',
            'reversal',
            'freeze',
            'unfreeze',
            'adjustment',
            'expire',
        ],
        required: true,
    },
    amount: { type: Number, required: true },
    balanceBefore: { type: Number },
    balanceAfter: { type: Number, required: true },
    idempotencyKey: { type: String },
    businessType: { type: String },
    businessId: { type: String },
    sourceOrderNo: { type: String },
    relatedTransactionId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'CreditsTransaction' },
    status: {
        type: String,
        enum: ['pending', 'committed', 'reversed', 'failed'],
        default: 'committed',
    },
    operatorId: { type: String },
    auditReason: { type: String, maxlength: 500 },
    resource: { type: String },
    apiKeyId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'ApiKey' },
    orderNo: { type: String },
    description: { type: String },
}, {
    timestamps: { createdAt: true, updatedAt: false },
});
// 复合索引：按用户 + 时间倒序查询变动明细
CreditsTransactionSchema.index({ userId: 1, createdAt: -1 });
// 按用户 + 变动类型过滤
CreditsTransactionSchema.index({ userId: 1, type: 1 });
// 仅当调用方真正提供字符串幂等键时参与唯一约束。
// compound sparse 索引会因为 userId 始终存在而仍索引缺失的 idempotencyKey（记为 null），
// 导致同一用户的第二条普通流水误报 E11000。
CreditsTransactionSchema.index({ userId: 1, idempotencyKey: 1 }, {
    unique: true,
    partialFilterExpression: { idempotencyKey: { $type: 'string' } },
});
CreditsTransactionSchema.index({ userId: 1, businessType: 1, businessId: 1, type: 1 });
exports.CreditsTransaction = mongoose_1.default.model('CreditsTransaction', CreditsTransactionSchema);
//# sourceMappingURL=CreditsTransaction.js.map