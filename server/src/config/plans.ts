/**
 * NexMind Platform — 套餐与积分包配置（桥梁模块）
 *
 * 聚合 billing.ts 的套餐定义与 credits-pricing.ts 的积分包定义，
 * 提供支付控制器与履约服务所需的统一导出接口。
 *
 * @author NexMind Team
 * @license MIT
 */

import { PLANS as BILLING_PLANS, Plan, PlanId } from "./billing";
import { CREDITS_PACKAGES } from "./credits-pricing";

// ============== 导出（统一命名） ==============

/** 套餐配置表（从 billing.ts 重新导出） */
export const PLANS = BILLING_PLANS as Record<string, Plan>;

/** 积分包商品列表（从 credits-pricing.ts 重新导出，统一命名为 CREDIT_PACKAGES） */
export const CREDIT_PACKAGES = CREDITS_PACKAGES;

// ============== 套餐信息查询（履约服务兼容层） ==============

/** 履约服务期望的扁平套餐视图 */
export interface PlanInfo {
  key: string;
  name: string;
  credits: number;
  monthlyQuota: number;
}

/**
 * 根据套餐 ID 查询套餐信息
 * 兼容 billing-order-fulfillment.service 和 payment.service 的调用方式
 */
export function getPlanInfo(planKey: string): PlanInfo | null {
  const plan = BILLING_PLANS[planKey as PlanId];
  if (!plan) return null;

  // 计算 monthlyQuota：取所有限额中的典型值（AI 对话限额作为默认月度配额）
  const monthlyQuota =
    plan.limits?.ai_chat !== undefined && plan.limits.ai_chat >= 0
      ? plan.limits.ai_chat
      : 999999;

  return {
    key: plan.id,
    name: plan.name,
    credits: plan.credits,
    monthlyQuota,
  };
}
