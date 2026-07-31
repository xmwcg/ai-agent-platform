/**
 * 用户行为日志工具：fire-and-forget 写入，不阻塞主流程。
 *
 * 用法：
 *   import { logActivity } from "../services/activity-logger";
 *   logActivity({ event: "page_view", category: "engagement", userId: "xxx", metadata: { page: "/pricing" } });
 */

import { UserActivityLog } from "../models/UserActivityLog";

export interface ActivityLogEntry {
  event: string;
  category: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
  ip?: string;
  userAgent?: string;
  referrer?: string;
}

export function logActivity(entry: ActivityLogEntry): void {
  UserActivityLog.create({
    userId: entry.userId,
    sessionId: entry.sessionId,
    event: entry.event,
    category: entry.category,
    metadata: entry.metadata,
    ip: entry.ip,
    userAgent: entry.userAgent,
    referrer: entry.referrer,
    timestamp: new Date(),
  }).catch(() => {
    // fire-and-forget: activity log failure never blocks primary flow
  });
}