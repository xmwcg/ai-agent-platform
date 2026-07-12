import mongoose, { Schema, Document } from 'mongoose';
import bcrypt from 'bcrypt';

export interface IUser extends Document {
  email: string;
  password: string;
  name: string;
  avatar?: string;
  phone?: string;
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
      type: String,
      unique: true,
      sparse: true,
      trim: true,
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

// 返回 JSON 时隐藏密码
userSchema.set('toJSON', {
  transform: (_doc: any, ret: any) => {
    delete ret.password;
    return ret;
  },
});

export const User = mongoose.model<IUser>('User', userSchema);
