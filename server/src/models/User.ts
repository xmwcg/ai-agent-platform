import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';
import {
  phoneHash,
  maskPhone,
  encryptField,
  decryptField,
  normalizePhone,
} from '../lib/field-crypto';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  phone?: string;          // 密文存储（AES-256-GCM），toJSON 时掩码展示
  phoneHash?: string;      // HMAC-SHA256 确定性 hash，用于 unique 索引 + 登录查找
  wechatOpenid?: string;
  role: 'user' | 'admin';
  provider: string;
  providerId?: string;
  // 商业变现字段
  plan: 'free' | 'pro' | 'max';
  membershipExpiresAt?: Date;
  credits: number; // 剩余 AI 积分
  // 推荐/分销字段
  referralCode: string;        // 唯一推荐码
  referredBy?: mongoose.Types.ObjectId; // 推荐人 ID
  commissionBalance: number;   // 佣金余额（分）
  totalCommissionEarned: number; // 累计佣金（分）
  commissionWithdrawn: number;   // 已提现佣金（分），用于计算可提现余额
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
  /** 获取手机号明文（仅供后端内部使用，不得直接返回前端） */
  getDecryptedPhone(): string | null;
}

// 生成 8 位随机推荐码
function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

const userSchema = new Schema<IUser>(
  {
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
    provider: {
      type: String,
      enum: ['local', 'github', 'wechat'],
      default: 'local',
    },
    providerId: {
      type: String,
      default: null,
    },
    phone: {
      type: String,           // AES-256-GCM 密文存储（不再是明文）
      select: false,          // 默认查询不返回密文字段
    },
    phoneHash: {
      type: String,
      unique: true,
      sparse: true,           // 未设置手机号的用户不参与唯一约束
      index: true,
    },
    wechatOpenid: {
      type: String,
      unique: true,
      sparse: true,
    },
    // 商业变现字段
    plan: {
      type: String,
      enum: ['free', 'pro', 'max'],
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
      type: Schema.Types.ObjectId,
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
  },
  { timestamps: true }
);

// 注册时自动生成推荐码
userSchema.pre('save', async function (next) {
  if (!this.referralCode) {
    let code = generateReferralCode();
    // 碰撞重试（最多 5 次）
    let attempts = 0;
    while (attempts < 5) {
      const existing = await mongoose.model('User').findOne({ referralCode: code });
      if (!existing) break;
      code = generateReferralCode();
      attempts++;
    }
    this.referralCode = code;
  }

  // 注册时处理推荐关系
  if (this.isNew && this.referredBy) {
    // 验证 referrer 存在
    const referrer = await mongoose.model('User').findById(this.referredBy);
    if (!referrer) {
      this.referredBy = undefined;
    }
  }

  next();
});

// 🔒 敏感字段加密：phone → phoneEncrypted + phoneHash（P0 安全加固）
userSchema.pre('save', async function (next) {
  // 仅当 phone 字段被修改（新增/更新）时才重新加密和 hash
  if (!this.isModified('phone')) return next();
  try {
    const raw = (this as any).phone;
    if (raw && !raw.startsWith('enc::')) {
      // 明文 → 密文 + hash
      this.set('phone', encryptField(normalizePhone(raw)));
      this.set('phoneHash', phoneHash(raw));
    }
    // 如果已经以 enc:: 开头（已加密），保持 phoneHash 不变
    next();
  } catch (err: any) {
    next(err);
  }
});

// 保存前加密密码
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (err: any) {
    next(err);
  }
});

// 密码比对方法
userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// 返回 JSON 时隐藏密码、掩码手机号、不暴露密文
userSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.password;
    // 手机号掩码展示（如 138****0000）
    if (ret.phone) {
      try {
        const decrypted = decryptField(ret.phone);
        ret.phone = maskPhone(decrypted);
      } catch {
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
userSchema.methods.getDecryptedPhone = function (): string | null {
  if (!this.phone) return null;
  try {
    return decryptField(this.phone);
  } catch {
    return null; // 解密失败（密钥轮换过渡期），返回 null
  }
};

export const User = mongoose.model<IUser>('User', userSchema);
