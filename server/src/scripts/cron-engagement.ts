/**
 * 运营自动化定时任务 —— 用户召回与到期提醒
 *
 * 通过 cron 定时执行（建议每天凌晨 3:00），包含两个功能：
 *
 * A. 订阅到期提醒
 *    - 查询 User 集合，找到 membershipExpiresAt 在未来 7/3/1 天内的付费用户
 *    - 对每个用户发送提醒邮件（使用已有的 email.service.ts）
 *    - 每个用户每天只提醒一次（使用 lastExpiryNotifiedAt 防重）
 *
 * B. 未活跃用户召回
 *    - 查询 User 集合，找到 lastLoginAt 为 null 或 30 天未登录的注册用户
 *    - 对每个用户发送召回邮件
 *    - 控制每天最多发送 50 封（避免触达过度）
 *    - 发送后更新 lastReengagementEmailAt 字段
 *
 * 运行方式：npx ts-node src/scripts/cron-engagement.ts
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User } from "../models/User";
import { sendTransactionalEmail } from "../services/email.service";
import { logger } from "../lib/logger";

dotenv.config();

// ─── 配置 ────────────────────────────────────────

const REMINDER_WINDOWS_DAYS = [7, 3, 1];
const REENGAGEMENT_DAYS = 30;
const MAX_REENGAGEMENT_PER_RUN = 50;
const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@aibak.site";

// ─── 工具函数 ────────────────────────────────────

/** 判断两个日期是否在同一天（用于每日防重）。 */
function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getUTCFullYear() === b.getUTCFullYear() &&
    a.getUTCMonth() === b.getUTCMonth() &&
    a.getUTCDate() === b.getUTCDate()
  );
}

/** 格式化日期为可读字符串。 */
function fmtDate(d: Date): string {
  return d.toISOString().split("T")[0];
}

// ─── A. 订阅到期提醒 ─────────────────────────────

async function sendExpiryReminders(): Promise<number> {
  const now = new Date();
  let sentCount = 0;

  for (const windowDays of REMINDER_WINDOWS_DAYS) {
    const targetDate = new Date(now);
    targetDate.setUTCDate(targetDate.getUTCDate() + windowDays);

    // 范围：当天 00:00:00 ～ 23:59:59
    const dayStart = new Date(targetDate);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(targetDate);
    dayEnd.setUTCHours(23, 59, 59, 999);

    // 查找到期时间在窗口内、且计划为付费的用户
    const users = await User.find({
      plan: { $in: ["pro", "max", "team"] },
      membershipExpiresAt: { $gte: dayStart, $lte: dayEnd },
      isBanned: { $ne: true },
    }).lean();

    for (const user of users) {
      // 每日防重：今天已提醒过则跳过
      if (user.lastExpiryNotifiedAt && isSameDay(user.lastExpiryNotifiedAt, now)) {
        logger.info("cron-engagement", `[EXPIRY] 今天已提醒 ${user.email}，跳过`);
        continue;
      }

      const daysLabel = windowDays === 1 ? "明天" : `${windowDays} 天后`;
      const planName = user.plan.toUpperCase();

      // 使用 idempotencyKey（email + 日期 + 窗口天数）防重
      const idKey = `expiry_${user.email}_${fmtDate(dayStart)}_${windowDays}d`;

      const result = await sendTransactionalEmail({
        to: user.email,
        subject: `[AIbak] 你的 ${planName} 套餐将在 ${daysLabel} 到期`,
        html: `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:24px">
  <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-radius:12px">
    <h2 style="margin:0 0 16px">⏰ 套餐即将到期</h2>
    <p>Hi <strong>${user.name}</strong>，</p>
    <p>你的 <strong>${planName}</strong> 套餐将在 <strong>${daysLabel}</strong>（${fmtDate(targetDate)}）到期。</p>
    <p>到期后你将失去以下权益：</p>
    <ul>
      <li>无限 AI 对话额度</li>
      <li>智评通项目评估报告</li>
      <li>高级知识库管理功能</li>
    </ul>
    <p>建议尽快续费，保持权益不中断。</p>
    <div style="text-align:center;margin:24px 0">
      <a href="https://aibak.site/pricing" style="display:inline-block;padding:12px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">前往续费</a>
    </div>
    <p style="color:#999;font-size:12px;text-align:center">邮件 ID: ${idKey}</p>
  </div>
</div>`.trim(),
      });

      if (result.sent) {
        // 更新 lastExpiryNotifiedAt
        await User.updateOne(
          { _id: user._id },
          { $set: { lastExpiryNotifiedAt: now } }
        );
        sentCount++;
        logger.info(
          "cron-engagement",
          `[EXPIRY] 到期提醒已发送 → ${user.email} (${windowDays}d)`
        );
      } else {
        logger.warn(
          "cron-engagement",
          `[EXPIRY] 发送失败 → ${user.email}: ${result.error}`
        );
      }
    }
  }

  return sentCount;
}

// ─── B. 未活跃用户召回 ───────────────────────────

async function sendReengagementEmails(): Promise<number> {
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setUTCDate(cutoff.getUTCDate() - REENGAGEMENT_DAYS);

  // 查找 30 天未登录的用户：
  // - lastLoginAt 为 null（从未登录过）且在 30 天前注册
  // - 或者 lastLoginAt 早于 30 天前
  const users = await User.find({
    role: "user",
    isBanned: { $ne: true },
    emailVerified: true,
    $or: [
      { lastLoginAt: { $lt: cutoff } },
      {
        lastLoginAt: null,
        createdAt: { $lt: cutoff },
      },
    ],
  })
    .sort({ lastReengagementEmailAt: 1 }) // 优先从未召回过的
    .limit(MAX_REENGAGEMENT_PER_RUN)
    .lean();

  let sentCount = 0;

  for (const user of users) {
    // 每日防重：今天已发过召回
    if (user.lastReengagementEmailAt && isSameDay(user.lastReengagementEmailAt, now)) {
      logger.info("cron-engagement", `[REENGAGE] 今天已召回 ${user.email}，跳过`);
      continue;
    }

    const daysSinceLastLogin = user.lastLoginAt
      ? Math.floor(
          (now.getTime() - user.lastLoginAt.getTime()) / (1000 * 60 * 60 * 24)
        )
      : "30+";

    const idKey = `reengage_${user.email}_${fmtDate(now)}`;

    const result = await sendTransactionalEmail({
      to: user.email,
      subject: "[AIbak] 好久不见！我们为你准备了新功能 🚀",
      html: `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:24px">
  <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-radius:12px">
    <h2 style="margin:0 0 16px">👋 好久不见，${user.name}！</h2>
    <p>距离你上次登录已经过去 <strong>${daysSinceLastLogin}</strong> 天了，我们非常想念你！</p>
    <p>这段时间 AIbak 新增了不少功能：</p>
    <ul>
      <li>🤖 更强大的 AI 对话模型</li>
      <li>📊 智评通一键生成项目评估报告</li>
      <li>📚 知识库支持团队协作</li>
      <li>💰 推荐好友赚佣金</li>
    </ul>
    <p>快回来看看吧！</p>
    <div style="text-align:center;margin:24px 0">
      <a href="https://aibak.site/login" style="display:inline-block;padding:12px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">立即登录</a>
    </div>
    <p style="color:#999;font-size:12px;margin-top:16px;text-align:center">
      如果你不想再收到此类邮件，请<a href="https://aibak.site/settings/notifications" style="color:#667eea">取消订阅</a>。
      邮件 ID: ${idKey}
    </p>
  </div>
</div>`.trim(),
    });

    if (result.sent) {
      await User.updateOne(
        { _id: user._id },
        { $set: { lastReengagementEmailAt: now } }
      );
      sentCount++;
      logger.info(
        "cron-engagement",
        `[REENGAGE] 召回邮件已发送 → ${user.email}`
      );
    } else {
      logger.warn(
        "cron-engagement",
        `[REENGAGE] 发送失败 → ${user.email}: ${result.error}`
      );
    }
  }

  return sentCount;
}

// ─── 主函数 ──────────────────────────────────────

async function main(): Promise<void> {
  const startTime = Date.now();
  logger.info("cron-engagement", "=== 运营自动化任务开始 ===");

  // 连接 MongoDB
  const MONGODB_URI =
    process.env.MONGODB_URI || "mongodb://localhost:27017/ai-agent-platform";

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    logger.info("cron-engagement", "MongoDB 已连接");
  } catch (err: any) {
    logger.error("cron-engagement", `MongoDB 连接失败: ${err.message}`);
    process.exit(1);
  }

  try {
    // A. 订阅到期提醒
    const expirySent = await sendExpiryReminders();
    logger.info("cron-engagement", `[EXPIRY] 共发送 ${expirySent} 封到期提醒`);

    // B. 未活跃用户召回
    const reengagementSent = await sendReengagementEmails();
    logger.info("cron-engagement", `[REENGAGE] 共发送 ${reengagementSent} 封召回邮件`);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    logger.info(
      "cron-engagement",
      `=== 运营自动化任务完成（${expirySent} 提醒 + ${reengagementSent} 召回，耗时 ${elapsed}s）===`
    );
  } catch (err: any) {
    logger.error("cron-engagement", `任务执行异常: ${err.message}`, err);
  } finally {
    await mongoose.disconnect();
    logger.info("cron-engagement", "MongoDB 已断开");
    process.exit(0);
  }
}

main();