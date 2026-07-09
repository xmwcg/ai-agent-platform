import crypto from 'crypto';
import { ApiUsageLog } from '../models/ApiUsageLog';

/** API 密钥生成 / 哈希 / 配额计量 —— 开放 API 市场按量计费基座 */
const PREFIX = 'rx_live_';

export interface ApiKeyQuotaState {
  quotaDaily: number;
  usedToday: number;
  lastReset: Date;
}

export function generateApiKey(): { plain: string; prefix: string; hash: string } {
  const plain = PREFIX + crypto.randomBytes(24).toString('hex');
  return { plain, prefix: plain.slice(0, PREFIX.length + 8), hash: hashKey(plain) };
}

export function hashKey(plain: string): string {
  return crypto.createHash('sha256').update(plain).digest('hex');
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** 按自然日重置用量，返回是否发生重置 */
export function resetQuotaIfNeeded(key: ApiKeyQuotaState, now: Date = new Date()): boolean {
  if (!isSameDay(new Date(key.lastReset), now)) {
    key.usedToday = 0;
    key.lastReset = now;
    return true;
  }
  return false;
}

export function isWithinQuota(key: ApiKeyQuotaState, now: Date = new Date()): boolean {
  resetQuotaIfNeeded(key, now);
  return key.usedToday < key.quotaDaily;
}

export function remainingQuota(key: ApiKeyQuotaState, now: Date = new Date()): number {
  resetQuotaIfNeeded(key, now);
  return Math.max(0, key.quotaDaily - key.usedToday);
}

/** 累加用量（调用方需先确认 isWithinQuota） */
export function applyUsage(key: ApiKeyQuotaState, by = 1, now: Date = new Date()): void {
  resetQuotaIfNeeded(key, now);
  key.usedToday += by;
}

/** 记录 API 调用日志（异步，不阻塞主流程），支撑用量报表与账单导出 */
export async function logApiUsage(params: {
  keyId: string;
  ownerId: string;
  prefix: string;
  resource?: string;
  promptBytes?: number;
  replyBytes?: number;
  status?: 'success' | 'quota_exceeded' | 'error';
  creditsDeducted?: number;
}): Promise<void> {
  try {
    await ApiUsageLog.create({
      keyId: params.keyId,
      ownerId: params.ownerId,
      prefix: params.prefix,
      resource: params.resource || 'chat',
      promptBytes: params.promptBytes,
      replyBytes: params.replyBytes,
      status: params.status || 'success',
      creditsDeducted: params.creditsDeducted,
      timestamp: new Date(),
    });
  } catch {
    // 日志写入失败不影响主流程
  }
}
