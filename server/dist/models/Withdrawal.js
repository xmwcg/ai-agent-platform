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
exports.Withdrawal = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const field_crypto_1 = require("../lib/field-crypto");
const withdrawalSchema = new mongoose_1.Schema({
    userId: { type: mongoose_1.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    amount: { type: Number, required: true },
    amountCents: { type: Number, required: true },
    method: { type: String, enum: ['wechat', 'alipay'], default: 'wechat' },
    account: { type: String, select: false }, // 默认查询不返回密文字段
    status: { type: String, enum: ['pending', 'approved', 'rejected', 'paid'], default: 'pending' },
    note: { type: String },
}, { timestamps: true });
// 🔒 提现账号加密（P0 安全加固）
withdrawalSchema.pre('save', function (next) {
    try {
        const raw = this.account;
        if (raw && !raw.startsWith('enc::')) {
            this.set('account', (0, field_crypto_1.encryptField)(raw));
        }
        next();
    }
    catch (err) {
        next(err);
    }
});
// 返回 JSON 时掩码账号（仅展示后 4 位）
withdrawalSchema.set('toJSON', {
    transform: (_doc, ret) => {
        if (ret.account) {
            try {
                const decrypted = (0, field_crypto_1.decryptField)(ret.account);
                // 掩码：仅展示后 4 位，其余显示为 ****
                ret.account = decrypted.length > 4
                    ? `****${decrypted.slice(-4)}`
                    : '****';
            }
            catch {
                ret.account = '****'; // 解密失败绝不泄露半密文
            }
        }
        delete ret.__v;
        return ret;
    },
});
/** 获取收款账号明文（仅供后端内部使用，如打款时）。 */
withdrawalSchema.methods.getDecryptedAccount = function () {
    if (!this.account)
        return null;
    try {
        return (0, field_crypto_1.decryptField)(this.account);
    }
    catch {
        return null;
    }
};
exports.Withdrawal = mongoose_1.default.model('Withdrawal', withdrawalSchema);
//# sourceMappingURL=Withdrawal.js.map