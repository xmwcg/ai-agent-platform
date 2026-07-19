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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.User = void 0;
const mongoose_1 = __importStar(require("mongoose"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const field_crypto_1 = require("../lib/field-crypto");
// 生成 8 位随机推荐码
function generateReferralCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}
const userSchema = new mongoose_1.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true,
        minlength: 6,
    },
    name: {
        type: String,
        required: true,
        trim: true,
    },
    avatar: {
        type: String,
        default: '',
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    isBanned: {
        type: Boolean,
        default: false,
        index: true,
    },
    provider: {
        type: String,
        enum: ['local', 'github', 'wechat', 'douyin'],
        default: 'local',
    },
    providerId: {
        type: String,
        default: null,
    },
    phone: {
        type: String, // AES-256-GCM 密文存储（不再是明文）
        select: false, // 默认查询不返回密文字段
    },
    phoneHash: {
        type: String,
        unique: true,
        sparse: true, // 未设置手机号的用户不参与唯一约束
        index: true,
    },
    wechatOpenid: {
        type: String,
        unique: true,
        sparse: true,
    },
    douyinOpenid: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
    },
    douyinUnionid: {
        type: String,
        sparse: true,
    },
    // 商业变现字段
    plan: {
        type: String,
        enum: ['free', 'pro', 'max', 'team'],
        default: 'free',
    },
    membershipExpiresAt: {
        type: Date,
        default: null,
    },
    credits: {
        type: Number,
        default: 0,
    },
    // 推荐/分销字段
    referralCode: {
        type: String,
        unique: true,
    },
    referredBy: {
        type: mongoose_1.Schema.Types.ObjectId,
        ref: 'User',
        sparse: true,
        default: null,
    },
    commissionBalance: {
        type: Number,
        default: 0,
    },
    totalCommissionEarned: {
        type: Number,
        default: 0,
    },
    commissionWithdrawn: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });
// 注册时自动生成推荐码
userSchema.pre('save', async function (next) {
    if (!this.referralCode) {
        let code = generateReferralCode();
        // 碰撞重试（最多 5 次）
        let attempts = 0;
        while (attempts < 5) {
            const existing = await mongoose_1.default.model('User').findOne({ referralCode: code });
            if (!existing)
                break;
            code = generateReferralCode();
            attempts++;
        }
        this.referralCode = code;
    }
    // 注册时处理推荐关系
    if (this.isNew && this.referredBy) {
        // 验证 referrer 存在
        const referrer = await mongoose_1.default.model('User').findById(this.referredBy);
        if (!referrer) {
            this.referredBy = undefined;
        }
    }
    next();
});
// 🔒 敏感字段加密：phone → phoneEncrypted + phoneHash（P0 安全加固）
userSchema.pre('save', async function (next) {
    // 仅当 phone 字段被修改（新增/更新）时才重新加密和 hash
    if (!this.isModified('phone'))
        return next();
    try {
        const raw = this.phone;
        if (raw && !raw.startsWith('enc::')) {
            // 明文 → 密文 + hash
            this.set('phone', (0, field_crypto_1.encryptField)((0, field_crypto_1.normalizePhone)(raw)));
            this.set('phoneHash', (0, field_crypto_1.phoneHash)(raw));
        }
        // 如果已经以 enc:: 开头（已加密），保持 phoneHash 不变
        next();
    }
    catch (err) {
        next(err);
    }
});
// 保存前加密密码
userSchema.pre('save', async function (next) {
    if (!this.isModified('password'))
        return next();
    try {
        const salt = await bcrypt_1.default.genSalt(10);
        this.password = await bcrypt_1.default.hash(this.password, salt);
        next();
    }
    catch (err) {
        next(err);
    }
});
// 密码比对方法
userSchema.methods.comparePassword = async function (candidatePassword) {
    return bcrypt_1.default.compare(candidatePassword, this.password);
};
// 返回 JSON 时隐藏密码、掩码手机号、不暴露密文
userSchema.set('toJSON', {
    transform: (_doc, ret) => {
        delete ret.password;
        // 手机号掩码展示（如 138****0000）
        if (ret.phone) {
            try {
                const decrypted = (0, field_crypto_1.decryptField)(ret.phone);
                ret.phone = (0, field_crypto_1.maskPhone)(decrypted);
            }
            catch {
                ret.phone = '****'; // 解密失败（如密钥不匹配），绝不泄露密文
            }
        }
        // 不向前端暴露 phoneHash
        delete ret.phoneHash;
        // 不向前端暴露密文的 __v
        delete ret.__v;
        return ret;
    },
});
/** 获取手机号明文（仅供后端内部使用，不得直接返回前端）。 */
userSchema.methods.getDecryptedPhone = function () {
    if (!this.phone)
        return null;
    try {
        return (0, field_crypto_1.decryptField)(this.phone);
    }
    catch {
        return null; // 解密失败（密钥轮换过渡期），返回 null
    }
};
exports.User = mongoose_1.default.model('User', userSchema);
//# sourceMappingURL=User.js.map