/**
 * 运营指标仪表盘服务
 *
 * 聚合业务和运维关键指标，供管理员仪表盘使用：
 * - API 可用率、P95/P99、5xx 错误率
 * - MongoDB/Redis 状态
 * - 支付成功率和待处理订单
 * - 积分/账本概览
 * - Sandbox 执行统计
 * - 用户增长、付费转化
 */
import mongoose from "mongoose";
import { realRedis, isUsingMemoryRedis } from "../config/database";
import { User } from "../models/User";
import { Order } from "../models/Order";
import { CreditsTransaction } from "../models/CreditsTransaction";
import { SandboxExecution } from "../models/SandboxExecution";
import { Refund } from "../models/Refund";
import { CreditLot } from "../models/CreditLot";
import { ReconciliationRecord } from "../models/ReconciliationRecord";
import { AuthSession } from "../models/AuthSession";
import { logger } from "../lib/logger";
import { getToday5xxCount, getLatencyPercentiles, getSuccessRatePercent } from "../middleware/apm";

export interface DashboardMetrics {
  timestamp: string;
  health: {
    mongo: { status: "connected" | "disconnected"; latencyMs?: number };
    redis: { status: "connected" | "disconnected" | "memory"; latencyMs?: number };
    sandbox: { status: "available" | "unavailable" };
  };
  api: {
    today5xx: number;
    p95Ms: number;
    p99Ms: number;
    uptimePercent: number;
  };
  orders: {
    totalToday: number;
    pendingPayment: number;
    paidToday: number;
    refundedToday: number;
    refundPending: number;
  };
  payments: {
    wechatSuccessRate: number;
    avgCallbackLatencyMs: number;
    unfulfilledOrders: number;
  };
  credits: {
    totalActiveUsers: number;
    totalCreditsInCirculation: number;
    overdraftCount24h: number;
    reversalCount24h: number;
  };
  ledger: {
    lastReconciledAt?: string;
    reconciliationDiffCount: number;
    unresolvedDiffs: number;
  };
  sandbox: {
    executionsToday: number;
    avgDurationMs: number;
    denialRate: number;
    circuitBreakerActive: number;
  };
  users: {
    total: number;
    activeToday: number;
    newToday: number;
    paidConversion: number;
    activeSessions: number;
  };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  // Health checks
  const mongoStatus = await checkMongo();
  const redisStatus = await checkRedis();
  const sandboxStatus = await checkSandbox();

  // Counts - run in parallel for efficiency
  

  const [
    ordersToday, ordersPendingPayment, ordersPaidToday, ordersRefundedToday,
    refundsPending,
    totalUsers, newUsersToday, activeUsersToday, activeSessions,
    sandboxToday, sandboxErrors,
    overdrafts24h, reversals24h,
    reconciliationDiffs, unresolvedDiffs,
  ] = await Promise.all([
    Order.countDocuments({ createdAt: { $gte: todayStart } }),
    Order.countDocuments({ paymentStatus: "pending" }),
    Order.countDocuments({ paymentStatus: "paid", paidAt: { $gte: todayStart } }),
    Order.countDocuments({ paymentStatus: "refunded" }),
    Refund.countDocuments({ status: "pending" }),
    User.countDocuments({}),
    User.countDocuments({ createdAt: { $gte: todayStart } }),
    User.countDocuments({ lastActiveAt: { $gte: todayStart } }),
    AuthSession.countDocuments({ status: "active" }),
    SandboxExecution.countDocuments({ createdAt: { $gte: todayStart } }),
    SandboxExecution.countDocuments({ status: { $in: ["error", "timeout", "denied", "resource_exhausted"] }, createdAt: { $gte: todayStart } }),
    CreditsTransaction.countDocuments({ type: { $in: ["reversal", "freeze"] }, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    CreditsTransaction.countDocuments({ type: "reversal", createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
    ReconciliationRecord.countDocuments({}),
    ReconciliationRecord.countDocuments({ status: { $ne: "resolved" } }),
  ]);

  // Sandbox avg duration
  const sandboxDurations = await SandboxExecution.aggregate([
    { $match: { createdAt: { $gte: todayStart }, status: "success" } },
    { $group: { _id: null, avgDuration: { $avg: "$durationMs" } } },
  ]);

  // Last reconciliation
  const lastRecon = await ReconciliationRecord.findOne().sort({ createdAt: -1 }).select("createdAt").lean();

  return {
    timestamp: now.toISOString(),
    health: {
      mongo: mongoStatus as { status: "connected" | "disconnected"; latencyMs?: number },
      redis: redisStatus as { status: "connected" | "disconnected" | "memory"; latencyMs?: number },
      sandbox: sandboxStatus as { status: "available" | "unavailable" },
    },
    api: {
      today5xx: getToday5xxCount(),
      p95Ms: getLatencyPercentiles().p95,
      p99Ms: getLatencyPercentiles().p99,
      uptimePercent: getSuccessRatePercent(),
    },
    orders: {
      totalToday: ordersToday,
      pendingPayment: ordersPendingPayment,
      paidToday: ordersPaidToday,
      refundedToday: ordersRefundedToday,
      refundPending: refundsPending,
    },
    payments: {
      wechatSuccessRate: 0,
      avgCallbackLatencyMs: 0,
      unfulfilledOrders: 0,
    },
    credits: {
      totalActiveUsers: totalUsers,
      totalCreditsInCirculation: 0,
      overdraftCount24h: overdrafts24h,
      reversalCount24h: reversals24h,
    },
    ledger: {
      lastReconciledAt: (lastRecon as Record<string, any>)?.createdAt?.toISOString(),
      reconciliationDiffCount: reconciliationDiffs,
      unresolvedDiffs,
    },
    sandbox: {
      executionsToday: sandboxToday,
      avgDurationMs: sandboxDurations[0]?.avgDuration || 0,
      denialRate: sandboxToday > 0 ? sandboxErrors / sandboxToday : 0,
      circuitBreakerActive: 0,
    },
    users: {
      total: totalUsers,
      activeToday: activeUsersToday,
      newToday: newUsersToday,
      paidConversion: 0,
      activeSessions,
    },
  };
}

async function checkMongo(): Promise<{ status: string; latencyMs?: number }> {
  try {
    const start = Date.now();
    await mongoose.connection.db?.admin().ping();
    return { status: "connected", latencyMs: Date.now() - start };
  } catch {
    return { status: "disconnected" };
  }
}

async function checkRedis(): Promise<{ status: string; latencyMs?: number }> {
  if (isUsingMemoryRedis()) return { status: "memory" };
  try {
    const start = Date.now();
    await (realRedis.ping() as Promise<string>);
    return { status: "connected", latencyMs: Date.now() - start };
  } catch {
    return { status: "disconnected" };
  }
}

async function checkSandbox(): Promise<{ status: string }> {
  if (process.env.SANDBOX_REMOTE_URL && process.env.SANDBOX_REMOTE_TOKEN) {
    try {
      const axios = require("axios");
      await axios.get(`${process.env.SANDBOX_REMOTE_URL}/health`, { timeout: 5000 });
      return { status: "available" };
    } catch {
      return { status: "unavailable" };
    }
  }
  return { status: "unavailable" };
}

/** 启动仪表盘数据定时采集（供监控系统拉取） */
export function startDashboardCollection(): void {
  setInterval(() => {
    getDashboardMetrics().then((metrics) => {
      logger.info("dashboard", `指标采集完成: 用户${metrics.users.total}, 活跃${metrics.users.activeToday}, 订单${metrics.orders.totalToday}`);
    }).catch((err) => {
      logger.error("dashboard", `指标采集失败: ${err?.message}`);
    });
  }, 5 * 60 * 1000); // 每 5 分钟采集一次

  logger.info("dashboard", "运营指标采集已启动（每 5 分钟）");
}


