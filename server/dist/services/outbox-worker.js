"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OutboxWorker = void 0;
/**
 * Outbox Worker — 后台处理事务型发件箱事件
 *
 * - 定时拉取 pending 事件并执行
 * - 支持重试次数和指数退避
 * - 超过最大重试次数移入死信
 */
const OutboxEvent_1 = require("../models/OutboxEvent");
const Order_1 = require("../models/Order");
const logger_1 = require("../lib/logger");
const logic_1 = require("../routes/billing/logic");
const MAX_CONCURRENT = 5;
const POLL_INTERVAL_MS = 10000;
const BACKOFF_BASE_MS = 5000;
let running = false;
class OutboxWorker {
    static start() {
        if (running)
            return;
        running = true;
        logger_1.logger.info("outbox", "Outbox Worker 启动");
        OutboxWorker.poll();
    }
    static stop() {
        running = false;
        logger_1.logger.info("outbox", "Outbox Worker 停止");
    }
    static async poll() {
        while (running) {
            try {
                const events = await OutboxEvent_1.OutboxEvent.find({
                    status: "pending",
                    nextRetryAt: { $lte: new Date() },
                })
                    .limit(MAX_CONCURRENT)
                    .sort({ nextRetryAt: 1 });
                if (events.length > 0) {
                    logger_1.logger.info("outbox", "处理 " + events.length + " 个待处理事件");
                    await Promise.allSettled(events.map((event) => OutboxWorker.processEvent(event)));
                }
            }
            catch (err) {
                const message = err instanceof Error ? err.message : String(err);
                logger_1.logger.error("outbox", "轮询异常: " + message);
            }
            await OutboxWorker.sleep(POLL_INTERVAL_MS);
        }
    }
    static async processEvent(event) {
        try {
            event.status = "processing";
            await event.save();
            switch (event.eventType) {
                case "payment_confirmed":
                    await OutboxWorker.handlePaymentConfirmed(event);
                    break;
                case "refund_confirmed":
                    await OutboxWorker.handleRefundConfirmed(event);
                    break;
                case "credits_reversed":
                    await OutboxWorker.handleCreditsReversed(event);
                    break;
                case "order_expired":
                    await OutboxWorker.handleOrderExpired(event);
                    break;
                default:
                    logger_1.logger.warn("outbox", "未知事件类型: " + event.eventType);
                    event.status = "done";
                    event.completedAt = new Date();
                    await event.save();
            }
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_1.logger.error("outbox", "处理失败: " + event.eventType + " aggregateId=" + event.aggregateId, err);
            event.attempts += 1;
            event.lastError = message;
            if (event.attempts >= event.maxAttempts) {
                event.status = "dead";
                logger_1.logger.error("outbox", "事件移入死信: " + event.eventType + " aggregateId=" + event.aggregateId);
            }
            else {
                const delay = BACKOFF_BASE_MS * Math.pow(5, event.attempts - 1);
                event.nextRetryAt = new Date(Date.now() + delay);
                event.status = "pending";
            }
            await event.save();
        }
    }
    static async handlePaymentConfirmed(event) {
        const { orderNo, orderType, plan, packageId, userId } = event.payload;
        if (orderType === "credits_pack" && packageId) {
            await (0, logic_1.grantCreditsPack)(userId, packageId, orderNo);
        }
        else {
            await (0, logic_1.activateSubscription)(userId, plan, "monthly", orderNo);
        }
        event.status = "done";
        event.completedAt = new Date();
        await event.save();
        logger_1.logger.info("outbox", "支付确认履约完成: orderNo=" + orderNo);
    }
    static async handleRefundConfirmed(event) {
        const { refundNo, status } = event.payload;
        event.status = "done";
        event.completedAt = new Date();
        await event.save();
        logger_1.logger.info("outbox", "退款确认完成: refundNo=" + refundNo + " status=" + status);
    }
    static async handleCreditsReversed(event) {
        event.status = "done";
        event.completedAt = new Date();
        await event.save();
        logger_1.logger.info("outbox", "积分冲正确认: " + event.aggregateId);
    }
    static async handleOrderExpired(event) {
        const order = await Order_1.Order.findOne({ orderNo: event.aggregateId });
        if (order && order.paymentStatus === "pending") {
            order.paymentStatus = "closed";
            order.status = "expired";
            await order.save();
        }
        event.status = "done";
        event.completedAt = new Date();
        await event.save();
        logger_1.logger.info("outbox", "订单过期处理: orderNo=" + event.aggregateId);
    }
    static sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
exports.OutboxWorker = OutboxWorker;
//# sourceMappingURL=outbox-worker.js.map