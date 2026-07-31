import mongoose, { Schema, Document } from 'mongoose';

/**
 * 站内通知（Notification）
 *
 * 三位一体触达体系的站内信部分：
 * - 邮件：email.service.ts（异步、带模板）
 * - 微信：notify.service.ts（模板消息）
 * - 站内信：本模型（即时、持久、可标记已读）
 *
 * 典型场景：
 * - 支付成功通知
 * - 报告生成完成
 * - 退款进度更新
 * - 订阅即将到期
 * - 佣金结算通知
 * - 系统公告
 */
export interface INotification extends Document {
  userId: mongoose.Types.ObjectId;
  type: 'payment_success' | 'report_ready' | 'refund_update' | 'subscription_expiry' | 'commission_settled' | 'system_notice' | 'referral_bonus';
  title: string;
  body: string;
  link?: string;           // 点击跳转链接
  isRead: boolean;
  readAt?: Date;
  metadata?: Record<string, unknown>;  // 扩展数据（orderNo/reportId等）
  createdAt: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: {
      type: String,
      enum: ['payment_success', 'report_ready', 'refund_update', 'subscription_expiry', 'commission_settled', 'system_notice', 'referral_bonus'],
      required: true,
    },
    title: { type: String, required: true },
    body: { type: String, required: true },
    link: { type: String },
    isRead: { type: Boolean, default: false, index: true },
    readAt: { type: Date },
    metadata: { type: Schema.Types.Mixed },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

// 复合索引：用户+已读状态+时间，用于高效查询未读计数
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// ─── 便捷创建函数 ──────────────────────────────

export interface CreateNotificationInput {
  userId: string;
  type: INotification['type'];
  title: string;
  body: string;
  link?: string;
  metadata?: Record<string, unknown>;
}

export async function createNotification(input: CreateNotificationInput): Promise<INotification> {
  return Notification.create({
    userId: new mongoose.Types.ObjectId(input.userId),
    type: input.type,
    title: input.title,
    body: input.body,
    link: input.link,
    metadata: input.metadata,
  });
}

/** 批量创建（同一类型通知给多个用户） */
export async function createBulkNotifications(inputs: CreateNotificationInput[]): Promise<INotification[]> {
  return Notification.insertMany(
    inputs.map((i) => ({
      userId: new mongoose.Types.ObjectId(i.userId),
      type: i.type,
      title: i.title,
      body: i.body,
      link: i.link,
      metadata: i.metadata,
    }))
  ) as unknown as INotification[];
}

/** 获取用户未读计数 */
export async function getUnreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ userId, isRead: false });
}

/** 获取通知列表（分页），最新在前 */
export async function getNotifications(
  userId: string,
  page = 1,
  pageSize = 20
): Promise<{ items: INotification[]; total: number; unreadCount: number }> {
  const [items, total, unreadCount] = await Promise.all([
    Notification.find({ userId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Notification.countDocuments({ userId }),
    getUnreadCount(userId),
  ]);
  return { items: items as unknown as INotification[], total, unreadCount };
}

/** 标记单条为已读 */
export async function markRead(notificationId: string, userId: string): Promise<void> {
  await Notification.updateOne(
    { _id: notificationId, userId },
    { isRead: true, readAt: new Date() }
  );
}

/** 全部标记已读 */
export async function markAllRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
}
