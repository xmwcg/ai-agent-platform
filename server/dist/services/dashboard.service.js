"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDashboardMetrics = getDashboardMetrics;
exports.startDashboardCollection = startDashboardCollection;
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
const mongoose_1 = __importDefault(require("mongoose"));
const database_1 = require("../config/database");
const User_1 = require("../models/User");
const Order_1 = require("../models/Order");
const CreditsTransaction_1 = require("../models/CreditsTransaction");
const SandboxExecution_1 = require("../models/SandboxExecution");
const Refund_1 = require("../models/Refund");
const ReconciliationRecord_1 = require("../models/ReconciliationRecord");
const AuthSession_1 = require("../models/AuthSession");
const logger_1 = require("../lib/logger");
const apm_1 = require("../middleware/apm");
async function getDashboardMetrics() {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
    // Health checks
    const mongoStatus = await checkMongo();
    const redisStatus = await checkRedis();
    const sandboxStatus = await checkSandbox();
    // Counts - run in parallel for efficiency
    const [ordersToday, ordersPendingPayment, ordersPaidToday, ordersRefundedToday, refundsPending, totalUsers, newUsersToday, activeUsersToday, activeSessions, sandboxToday, sandboxErrors, overdrafts24h, reversals24h, reconciliationDiffs, unresolvedDiffs,] = await Promise.all([
        Order_1.Order.countDocuments({ createdAt: { $gte: todayStart } }),
        Order_1.Order.countDocuments({ paymentStatus: "pending" }),
        Order_1.Order.countDocuments({ paymentStatus: "paid", paidAt: { $gte: todayStart } }),
        Order_1.Order.countDocuments({ paymentStatus: "refunded" }),
        Refund_1.Refund.countDocuments({ status: "pending" }),
        User_1.User.countDocuments({}),
        User_1.User.countDocuments({ createdAt: { $gte: todayStart } }),
        User_1.User.countDocuments({ lastActiveAt: { $gte: todayStart } }),
        AuthSession_1.AuthSession.countDocuments({ status: "active" }),
        SandboxExecution_1.SandboxExecution.countDocuments({ createdAt: { $gte: todayStart } }),
        SandboxExecution_1.SandboxExecution.countDocuments({ status: { $in: ["error", "timeout", "denied", "resource_exhausted"] }, createdAt: { $gte: todayStart } }),
        CreditsTransaction_1.CreditsTransaction.countDocuments({ type: { $in: ["reversal", "freeze"] }, createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        CreditsTransaction_1.CreditsTransaction.countDocuments({ type: "reversal", createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }),
        ReconciliationRecord_1.ReconciliationRecord.countDocuments({}),
        ReconciliationRecord_1.ReconciliationRecord.countDocuments({ status: { $ne: "resolved" } }),
    ]);
    // Sandbox avg duration
    const sandboxDurations = await SandboxExecution_1.SandboxExecution.aggregate([
        { $match: { createdAt: { $gte: todayStart }, status: "success" } },
        { $group: { _id: null, avgDuration: { $avg: "$durationMs" } } },
    ]);
    // Last reconciliation
    const lastRecon = await ReconciliationRecord_1.ReconciliationRecord.findOne().sort({ createdAt: -1 }).select("createdAt").lean();
    return {
        timestamp: now.toISOString(),
        health: {
            mongo: mongoStatus,
            redis: redisStatus,
            sandbox: sandboxStatus,
        },
        api: {
            today5xx: (0, apm_1.getToday5xxCount)(),
            p95Ms: (0, apm_1.getLatencyPercentiles)().p95,
            p99Ms: (0, apm_1.getLatencyPercentiles)().p99,
            uptimePercent: (0, apm_1.getSuccessRatePercent)(),
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
            lastReconciledAt: lastRecon?.createdAt?.toISOString(),
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
async function checkMongo() {
    try {
        const start = Date.now();
        await mongoose_1.default.connection.db?.admin().ping();
        return { status: "connected", latencyMs: Date.now() - start };
    }
    catch {
        return { status: "disconnected" };
    }
}
async function checkRedis() {
    if ((0, database_1.isUsingMemoryRedis)())
        return { status: "memory" };
    try {
        const start = Date.now();
        await database_1.realRedis.ping();
        return { status: "connected", latencyMs: Date.now() - start };
    }
    catch {
        return { status: "disconnected" };
    }
}
async function checkSandbox() {
    if (process.env.SANDBOX_REMOTE_URL && process.env.SANDBOX_REMOTE_TOKEN) {
        try {
            const axios = require("axios");
            await axios.get(`${process.env.SANDBOX_REMOTE_URL}/health`, { timeout: 5000 });
            return { status: "available" };
        }
        catch {
            return { status: "unavailable" };
        }
    }
    return { status: "unavailable" };
}
/** 启动仪表盘数据定时采集（供监控系统拉取） */
function startDashboardCollection() {
    setInterval(() => {
        getDashboardMetrics().then((metrics) => {
            logger_1.logger.info("dashboard", `指标采集完成: 用户${metrics.users.total}, 活跃${metrics.users.activeToday}, 订单${metrics.orders.totalToday}`);
        }).catch((err) => {
            logger_1.logger.error("dashboard", `指标采集失败: ${err?.message}`);
        });
    }, 5 * 60 * 1000); // 每 5 分钟采集一次
    logger_1.logger.info("dashboard", "运营指标采集已启动（每 5 分钟）");
}
//# sourceMappingURL=dashboard.service.js.map