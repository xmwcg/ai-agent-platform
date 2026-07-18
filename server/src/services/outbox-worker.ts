/**
 * Outbox Worker — 后台处理事务型发件箱事件
 *
 * - 定时拉取 pending 事件并执行
 * - 支持重试次数和指数退避
 * - 超过最大重试次数移入死信
 */
import { OutboxEvent, OutboxStatus, OutboxEventType } from "../models/OutboxEvent";
import { Order } from "../models/Order";
import { logger } from "../lib/logger";
import { activateSubscription, grantCreditsPack } from "../routes/billing/logic";

const MAX_CONCURRENT = 5;
const POLL_INTERVAL_MS = 10000;
const BACKOFF_BASE_MS = 5000;

let running = false;

export class OutboxWorker {
  static start() {
    if (running) return;
    running = true;
    logger.info("outbox", "Outbox Worker 启动");
    OutboxWorker.poll();
  }

  static stop() {
    running = false;
    logger.info("outbox", "Outbox Worker 停止");
  }

  private static async poll() {
    while (running) {
      try {
        const events = await OutboxEvent.find({
          status: "pending",
          nextRetryAt: { $lte: new Date() },
        })
          .limit(MAX_CONCURRENT)
          .sort({ nextRetryAt: 1 });

        if (events.length > 0) {
          logger.info("outbox", "处理 " + events.length + " 个待处理事件");
          await Promise.allSettled(events.map((event) => OutboxWorker.processEvent(event)));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("outbox", "轮询异常: " + message);
      }

      await OutboxWorker.sleep(POLL_INTERVAL_MS);
    }
  }

  private static async processEvent(event: any) {
    try {
      event.status = "processing" as OutboxStatus;
      await event.save();

      switch (event.eventType as OutboxEventType) {
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
          logger.warn("outbox", "未知事件类型: " + event.eventType);
          event.status = "done" as OutboxStatus;
          event.completedAt = new Date();
          await event.save();
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error("outbox", "处理失败: " + event.eventType + " aggregateId=" + event.aggregateId, err);

      event.attempts += 1;
      event.lastError = message;

      if (event.attempts >= event.maxAttempts) {
        event.status = "dead" as OutboxStatus;
        logger.error("outbox", "事件移入死信: " + event.eventType + " aggregateId=" + event.aggregateId);
      } else {
        const delay = BACKOFF_BASE_MS * Math.pow(5, event.attempts - 1);
        event.nextRetryAt = new Date(Date.now() + delay);
        event.status = "pending" as OutboxStatus;
      }

      await event.save();
    }
  }

  private static async handlePaymentConfirmed(event: any) {
    const { orderNo, orderType, plan, packageId, userId } = event.payload;
    if (orderType === "credits_pack" && packageId) {
      await grantCreditsPack(userId, packageId, orderNo);
    } else {
      await activateSubscription(userId, plan, "monthly", orderNo);
    }
    event.status = "done" as OutboxStatus;
    event.completedAt = new Date();
    await event.save();
    logger.info("outbox", "支付确认履约完成: orderNo=" + orderNo);
  }

  private static async handleRefundConfirmed(event: any) {
    const { refundNo, status } = event.payload;
    event.status = "done" as OutboxStatus;
    event.completedAt = new Date();
    await event.save();
    logger.info("outbox", "退款确认完成: refundNo=" + refundNo + " status=" + status);
  }

  private static async handleCreditsReversed(event: any) {
    event.status = "done" as OutboxStatus;
    event.completedAt = new Date();
    await event.save();
    logger.info("outbox", "积分冲正确认: " + event.aggregateId);
  }

  private static async handleOrderExpired(event: any) {
    const order = await Order.findOne({ orderNo: event.aggregateId });
    if (order && order.paymentStatus === "pending") {
      order.paymentStatus = "closed";
      order.status = "expired";
      await order.save();
    }
    event.status = "done" as OutboxStatus;
    event.completedAt = new Date();
    await event.save();
    logger.info("outbox", "订单过期处理: orderNo=" + event.aggregateId);
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
