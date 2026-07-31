/**
 * APM 持久化模块 —— 定期将指标快照写入 MongoDB
 *
 * 解决重启丢失指标数据的问题：
 * - 每 5 分钟将当前指标快照写入 apm_metrics 集合
 * - 重启后从 MongoDB 恢复累计指标
 * - 历史快照保留 30 天，每小时保留一条
 */
import mongoose from 'mongoose';
import { logger } from '../lib/logger';

let persistenceInterval: ReturnType<typeof setInterval> | null = null;

const COLLECTION = 'apm_metrics';

/** 保存当前快照到 MongoDB */
export async function saveSnapshot(data: any): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    await db.collection(COLLECTION).updateOne(
      { key: 'current' },
      { $set: { data, createdAt: new Date() } },
      { upsert: true }
    );
  } catch (err: any) {
    logger.warn('apm', `持久化快照失败: ${err.message}`);
  }
}

/** 保存小时级快照（用于历史趋势） */
export async function saveHourlySnapshot(data: any): Promise<void> {
  try {
    const db = mongoose.connection.db;
    if (!db) return;
    const hourKey = 'hourly_' + new Date().toISOString().slice(0, 13).replace(/[:-]/g, '');
    await db.collection(COLLECTION).updateOne(
      { key: hourKey },
      { $set: { data, createdAt: new Date() } },
      { upsert: true }
    );
  } catch (err: any) {
    logger.warn('apm', `小时快照保存失败: ${err.message}`);
  }
}

/** 从 MongoDB 恢复上次快照（用于重启后显示历史数据） */
export async function loadLastSnapshot(): Promise<{ data: any; createdAt: Date } | null> {
  try {
    const db = mongoose.connection.db;
    if (!db) return null;
    const doc = await db.collection(COLLECTION).findOne({ key: 'current' });
    return doc ? { data: doc.data, createdAt: doc.createdAt } : null;
  } catch {
    return null;
  }
}

/** 获取指定时间范围内的历史快照 */
export async function getHistoricalSnapshots(hours: number): Promise<any[]> {
  try {
    const db = mongoose.connection.db;
    if (!db) return [];
    const docs = await db.collection(COLLECTION)
      .find({ key: { $regex: /^hourly_/ } })
      .sort({ createdAt: -1 })
      .limit(hours)
      .toArray();
    return docs;
  } catch {
    return [];
  }
}

/** 启动定期持久化 */
let lastHourlySave = '';

export function startPersistence(getData: () => any): void {
  if (persistenceInterval) return;

  // 每 5 分钟保存当前快照
  persistenceInterval = setInterval(() => {
    const data = getData();
    saveSnapshot(data).catch(() => {});

    // 每小时额外保存一份
    const currentHour = new Date().toISOString().slice(0, 13);
    if (currentHour !== lastHourlySave) {
      lastHourlySave = currentHour;
      saveHourlySnapshot(data).catch(() => {});
    }
  }, 5 * 60 * 1000);

  logger.info('apm', '指标持久化已启动（每 5 分钟）');
}

export function stopPersistence(): void {
  if (persistenceInterval) {
    clearInterval(persistenceInterval);
    persistenceInterval = null;
  }
}


