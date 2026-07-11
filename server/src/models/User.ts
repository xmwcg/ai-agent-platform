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
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
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
      sparse: true, // 允许为空，但非空时唯一
      trim: true,
    },
    wechatOpenid: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
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
  },
  { timestamps: true }
);

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