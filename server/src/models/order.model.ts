/**
 * NexMind Platform — 订单数据模型
 *
 * 管理用户支付订单、套餐订阅、积分充值记录。
 *
 * @author NexMind Team
 * @license MIT
 */

import mongoose, { Schema, Document } from "mongoose";

// ============== 订单接口 ==============

export interface IOrder extends Document {
  userId: mongoose.Types.ObjectId;
  orderNo: string;
  type: "plan_upgrade" | "credits_purchase" | "product_purchase";
  plan?: "free" | "pro" | "max" | "enterprise";
  creditsAmount?: number; productId?: string; // 产品 ID（金网通等）
  amount: number;          // 实际支付金额（分）
  originalAmount: number;  // 原价（分）
  currency: string;
  status: "pending" | "paid" | "expired" | "refunded" | "cancelled";
  paymentMethod: "wechat" | "alipay" | "stripe";
  paymentTransactionId?: string;
  paymentTime?: Date;
  paidAt?: Date;
  expiresAt?: Date;
  metadata?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// ============== Schema ==============

const OrderSchema = new Schema<IOrder>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orderNo: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["plan_upgrade", "credits_purchase", "product_purchase"],
      required: true,
    },
    plan: {
      type: String,
      enum: ["free", "pro", "max", "enterprise"],
    },
    creditsAmount: {
      type: Number,
    },
    amount: {
      type: Number,
      required: true,
    },
    originalAmount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: "CNY",
    },
    status: {
      type: String,
      enum: ["pending", "paid", "expired", "refunded", "cancelled"],
      default: "pending",
      index: true,
    },
    paymentMethod: {
      type: String,
      enum: ["wechat", "alipay", "stripe"],
      required: true,
    },
    paymentTransactionId: {
      type: String,
    },
    paymentTime: {
      type: Date,
    },
    paidAt: {
      type: Date,
    },
    expiresAt: {
      type: Date,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    timestamps: true,
  }
);

// ============== 生成订单号 ==============

export function generateOrderNo(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, "");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `NM${dateStr}${random}`;
}

export const Order = mongoose.models["Order"] as mongoose.Model<IOrder> || mongoose.model<IOrder>("Order", OrderSchema);

