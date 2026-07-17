/**
 * 计费业务函数层（从 routes/billing.ts 抽离，降低单文件复杂度）
 * 包含：订单号生成、支付渠道解析、订阅激活、积分包充值、订单创建校验。
 * 路由 handler 在 routes/billing.ts 及其子模块中调用本层，保持关注点分离。
 */
import { User } from '../../models/User';
import { Order, PaymentProvider, BillingPeriod } from '../../models/Order';
import { CreditsTransaction } from '../../models/CreditsTransaction';
import { PLANS, PlanId, getPlan } from '../../config/billing';
import { CREDITS_PACKAGES } from '../../config/credits-pricing';
import { getPaymentGateway, isRealGateway } from '../../services/payment.service';
import { AppError } from '../../lib/http-error';
import { ValidationSchema } from '../../lib/validation';
import { logger } from '../../lib/logger';
import { activateReferralOnPayment } from '../../services/referral.service';

// 创建订单输入校验（plan 限定已知套餐，period 限定月/年）
export const createOrderSchema: ValidationSchema = {
  plan: { type: 'string', oneOf: ['free', 'pro', 'max', 'team'] },
  period: { type: 'string', oneOf: ['monthly', 'yearly'] },
  provider: { type: 'string', oneOf: ['mock', 'wechat', 'stripe', 'alipay'] },
};

/** 生成订单号：AI + 时间戳 + 随机 */
export function genOrderNo(): string {
  return `AI${Date.now()}${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`;
}

export function resolvePaymentProvider(input?: PaymentProvider): PaymentProvider {
  const configured = (process.env.DEFAULT_PAY_PROVIDER || (process.env.NODE_ENV === 'production' ? 'wechat' : 'mock')) as PaymentProvider;
  const provider = input || configured;
  if (!['mock', 'wechat', 'stripe', 'alipay'].includes(provider)) {
    throw new AppError(400, '不支持的支付渠道', 'UNSUPPORTED_PAYMENT_PROVIDER');
  }
  if (process.env.NODE_ENV === 'production' && provider !== 'wechat') {
    throw new AppError(400, '生产环境仅支持微信支付', 'PAYMENT_PROVIDER_DISABLED');
  }
  return provider;
}

/** 激活订阅：写入套餐、有效期、积分 */
export async function activateSubscription(userId: string, plan: PlanId, period: BillingPeriod, orderNo?: string): Promise<void> {
  const p = getPlan(plan);
  const now = Date.now();
  const durationMs = period === 'yearly' ? 365 * 86400 * 1000 : 30 * 86400 * 1000;
  const user = await User.findByIdAndUpdate(
    userId,
    {
      $set: {
        plan,
        membershipExpiresAt: new Date(now + durationMs),
      },
      $inc: { credits: p.credits },
    },
    { new: true }
  );
  // 记录订阅赠送积分明细（异步不阻塞）
  if (user && p.credits > 0) {
    void CreditsTransaction.create({
      userId: user._id,
      type: 'grant',
      amount: p.credits,
      balanceAfter: user.credits,
      orderNo,
      description: `${p.name}订阅赠送 ${p.credits} 积分`,
    });
  }
  // 异步处理推荐佣金激活（不阻塞订阅激活响应）
  if (user && plan !== 'free') {
    void activateReferralOnPayment(userId, period === 'yearly' ? p.priceYearly : p.priceMonthly, orderNo).catch((err) => {
      logger.error('billing', `推荐佣金激活失败: ${err.message}`);
    });
  }
}

/** 积分包支付成功后充值 */
export async function grantCreditsPack(userId: string, packageId: string, orderNo: string): Promise<number> {
  const pkg = CREDITS_PACKAGES.find((p) => p.id === packageId);
  if (!pkg) throw new Error(`未知积分包: ${packageId}`);
  const user = await User.findByIdAndUpdate(userId, { $inc: { credits: pkg.credits } }, { new: true });
  if (!user) throw new Error('用户不存在');
  // 记录积分购买明细（异步不阻塞）
  void CreditsTransaction.create({
    userId: user._id,
    type: 'purchase',
    amount: pkg.credits,
    balanceAfter: user.credits,
    orderNo,
    description: `购买 ${pkg.name}`,
  });
  logger.info('billing', `积分包充值成功: userId=${userId} package=${packageId} credits=+${pkg.credits} balance=${user.credits}`);
  return user.credits;
}
