/**
 * 计费业务函数层（从 routes/billing.ts 抽离，降低单文件复杂度）
 * 包含：订单号生成、支付渠道解析、订阅激活、积分包充值、订单创建校验。
 * 路由 handler 在 routes/billing.ts 及其子模块中调用本层，保持关注点分离。
 */
import crypto from 'crypto';
import mongoose from 'mongoose';
import { User } from '../../models/User';
import { PaymentProvider, BillingPeriod, BillingSourceProduct, BILLING_SOURCE_PRODUCTS } from '../../models/Order';
import { PlanId, getPlan } from '../../config/billing';
import { CREDITS_PACKAGES } from '../../config/credits-pricing';
import { AppError } from '../../lib/http-error';
import { ValidationSchema } from '../../lib/validation';
import { logger } from '../../lib/logger';
import { activateReferralOnPayment } from '../../services/referral.service';
import { grantCredits } from '../../services/credit-ledger.service';

// 创建订单输入校验（plan 限定已知套餐，period 限定月/年）
// productPackageId 是产品专用 id（如 zpt_enterprise / ts_team / jwt_pro），便于后端按 sourceProduct + packageId 履约；
// plan 字段依然限定 free/pro/max/team —— 产品专用 id 不直接作为 plan，必须由前端映射后传入。
export const createOrderSchema: ValidationSchema = {
  plan: { type: 'string', oneOf: ['free', 'pro', 'max', 'team'] },
  period: { type: 'string', oneOf: ['monthly', 'yearly'] },
  provider: { type: 'string', oneOf: ['mock', 'wechat', 'stripe', 'alipay'] },
  sourceProduct: { type: 'string', oneOf: [...BILLING_SOURCE_PRODUCTS] },
  productPackageId: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' },
  // 兼容已发布前端使用的旧字段；路由层会统一持久化为 Order.packageId。
  packageId: { type: 'string', minLength: 1, maxLength: 64, pattern: '^[A-Za-z0-9_-]+$' },
  returnTo: { type: 'string', maxLength: 512 },
  idempotencyKey: { type: 'string', minLength: 8, maxLength: 128, pattern: '^[A-Za-z0-9._:-]+$' },
};

/** 将订单来源归一化到受支持产品；未知值安全回退到平台。 */
export function resolveBillingSourceProduct(value: unknown): BillingSourceProduct {
  return typeof value === 'string' && BILLING_SOURCE_PRODUCTS.includes(value as BillingSourceProduct)
    ? (value as BillingSourceProduct)
    : 'platform';
}

export const PROJECT_GRADE_BILLING_RETURN_TO = '/project-grade/projects';
export const PROJECT_GRADE_UPGRADE_URL = `/pricing?source=project-grade&returnTo=${encodeURIComponent(PROJECT_GRADE_BILLING_RETURN_TO)}`;

/**
 * 归一化产品套餐 id。productPackageId 是正式字段；packageId 仅用于兼容旧前端。
 * 两个字段同时提供时必须一致，避免幂等重试或客户端篡改造成套餐歧义。
 */
export function resolveProductPackageId(input: {
  productPackageId?: unknown;
  packageId?: unknown;
}): string {
  const canonical = typeof input.productPackageId === 'string' ? input.productPackageId.trim() : '';
  const legacy = typeof input.packageId === 'string' ? input.packageId.trim() : '';
  if (canonical && legacy && canonical !== legacy) {
    throw new AppError(400, '产品套餐参数不一致', 'PRODUCT_PACKAGE_ID_CONFLICT');
  }
  return canonical || legacy;
}

/** 仅接受站内绝对路径，拒绝协议相对 URL、反斜杠、控制字符和跨域 URL。 */
export function normalizeBillingReturnTo(value: unknown, sourceProduct: BillingSourceProduct): string | undefined {
  const fallback = sourceProduct === 'project_grade' ? PROJECT_GRADE_BILLING_RETURN_TO : undefined;
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value !== 'string' || value.length > 512) {
    throw new AppError(400, '支付完成返回路径不合法', 'INVALID_BILLING_RETURN_TO');
  }
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || /[\u0000-\u001f\u007f]/.test(value)) {
    throw new AppError(400, '支付完成返回路径不合法', 'INVALID_BILLING_RETURN_TO');
  }
  try {
    const base = new URL('https://aibak.site');
    const parsed = new URL(value, base);
    if (parsed.origin !== base.origin) {
      throw new AppError(400, '支付完成返回路径不合法', 'INVALID_BILLING_RETURN_TO');
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(400, '支付完成返回路径不合法', 'INVALID_BILLING_RETURN_TO');
  }
}


/** 高熵、按创建时间大致可排序的全局订单号。 */
export function genOrderNo(): string {
  const timePart = Date.now().toString(36).toUpperCase().padStart(9, '0');
  const randomPart = crypto.randomBytes(10).toString('hex').toUpperCase();
  return `AI${timePart}${randomPart}`;
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

/** 激活订阅：套餐、有效期、免费额度批次和积分流水在同一事务中提交。 */
export async function activateSubscription(
  userId: string,
  plan: PlanId,
  period: BillingPeriod,
  orderNo?: string
): Promise<void> {
  const planConfig = getPlan(plan);
  if (planConfig.credits > 0 && !orderNo) {
    throw new AppError(409, '订单缺少履约编号，请稍后重试', 'SUBSCRIPTION_ORDER_REQUIRED');
  }

  const durationMs = period === 'yearly' ? 365 * 86400 * 1000 : 30 * 86400 * 1000;
  const session = await mongoose.startSession();
  let fulfilled = false;

  try {
    await session.withTransaction(async () => {
      const currentUser = await User.findById(userId).session(session);
      if (!currentUser) throw new AppError(404, '用户不存在', 'USER_NOT_FOUND');

      const now = Date.now();
      const currentExpiry = currentUser.membershipExpiresAt?.getTime() || 0;
      const membershipExpiresAt = new Date(Math.max(now, currentExpiry) + durationMs);

      if (planConfig.credits > 0) {
        const ledgerResult = await grantCredits({
          userId,
          amount: planConfig.credits,
          idempotencyKey: `subscription-fulfillment:${orderNo}`,
          businessType: 'subscription_fulfillment',
          businessId: orderNo!,
          sourceOrderNo: orderNo,
          sourceType: 'subscription_free',
          transactionType: 'grant',
          expiresAt: membershipExpiresAt,
          description: `${planConfig.name}订阅赠送 ${planConfig.credits} 积分`,
          auditReason: `订阅订单 ${orderNo} 权益履约`,
          session,
        });
        if (ledgerResult.idempotent) return;
      }

      await User.updateOne(
        { _id: userId },
        {
          $set: {
            plan,
            membershipExpiresAt,
            // 新购买/续费明确恢复自动续订状态，避免历史取消标记误导用户。
            subscriptionCancelAtPeriodEnd: false,
            subscriptionCanceledAt: null,
          },
        },
        { session }
      );
      fulfilled = true;
    });
  } finally {
    await session.endSession();
  }

  // 推荐佣金失败不回滚已完成的主权益，但必须等待并记录失败，禁止悬空任务。
  if (fulfilled && plan !== 'free') {
    try {
      await activateReferralOnPayment(
        userId,
        period === 'yearly' ? planConfig.priceYearly : planConfig.priceMonthly,
        orderNo
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('billing', `推荐佣金激活失败: ${message}`);
    }
  }
}

/** 积分包支付成功后充值，额度批次、余额缓存和流水同事务且按订单幂等。 */
export async function grantCreditsPack(userId: string, packageId: string, orderNo: string): Promise<number> {
  const pkg = CREDITS_PACKAGES.find((item) => item.id === packageId);
  if (!pkg) throw new AppError(400, '未知积分包', 'UNKNOWN_CREDITS_PACKAGE');
  if (!orderNo) throw new AppError(409, '订单缺少履约编号，请稍后重试', 'CREDITS_ORDER_REQUIRED');

  const result = await grantCredits({
    userId,
    amount: pkg.credits,
    idempotencyKey: `credit-pack-fulfillment:${orderNo}`,
    businessType: 'credit_pack_fulfillment',
    businessId: orderNo,
    sourceOrderNo: orderNo,
    sourceType: 'purchase',
    transactionType: 'purchase',
    description: `购买 ${pkg.name}`,
    auditReason: `积分包订单 ${orderNo} 权益履约`,
  });

  logger.info(
    'billing',
    `积分包充值${result.idempotent ? '幂等命中' : '成功'}: userId=${userId} package=${packageId} credits=+${pkg.credits} balance=${result.balanceAfter}`
  );
  return result.balanceAfter;
}
