"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveSnapshot = saveSnapshot;
exports.saveHourlySnapshot = saveHourlySnapshot;
exports.loadLastSnapshot = loadLastSnapshot;
exports.getHistoricalSnapshots = getHistoricalSnapshots;
exports.startPersistence = startPersistence;
exports.stopPersistence = stopPersistence;
/**
 * APM 持久化模块 —— 定期将指标快照写入 MongoDB
 *
 * 解决重启丢失指标数据的问题：
 * - 每 5 分钟将当前指标快照写入 apm_metrics 集合
 * - 重启后从 MongoDB 恢复累计指标
 * - 历史快照保留 30 天，每小时保留一条
 */
const mongoose_1 = __importDefault(require("mongoose"));
const logger_1 = require("../lib/logger");
let persistenceInterval = null;
const COLLECTION = 'apm_metrics';
/** 保存当前快照到 MongoDB */
async function saveSnapshot(data) {
    try {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return;
        await db.collection(COLLECTION).updateOne({ key: 'current' }, { $set: { data, createdAt: new Date() } }, { upsert: true });
    }
    catch (err) {
        logger_1.logger.warn('apm', `持久化快照失败: ${err.message}`);
    }
}
/** 保存小时级快照（用于历史趋势） */
async function saveHourlySnapshot(data) {
    try {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return;
        const hourKey = 'hourly_' + new Date().toISOString().slice(0, 13).replace(/[:-]/g, '');
        await db.collection(COLLECTION).updateOne({ key: hourKey }, { $set: { data, createdAt: new Date() } }, { upsert: true });
    }
    catch (err) {
        logger_1.logger.warn('apm', `小时快照保存失败: ${err.message}`);
    }
}
/** 从 MongoDB 恢复上次快照（用于重启后显示历史数据） */
async function loadLastSnapshot() {
    try {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return null;
        const doc = await db.collection(COLLECTION).findOne({ key: 'current' });
        return doc ? { data: doc.data, createdAt: doc.createdAt } : null;
    }
    catch {
        return null;
    }
}
/** 获取指定时间范围内的历史快照 */
async function getHistoricalSnapshots(hours) {
    try {
        const db = mongoose_1.default.connection.db;
        if (!db)
            return [];
        const docs = await db.collection(COLLECTION)
            .find({ key: { $regex: /^hourly_/ } })
            .sort({ createdAt: -1 })
            .limit(hours)
            .toArray();
        return docs;
    }
    catch {
        return [];
    }
}
/** 启动定期持久化 */
let lastHourlySave = '';
function startPersistence(getData) {
    if (persistenceInterval)
        return;
    // 每 5 分钟保存当前快照
    persistenceInterval = setInterval(() => {
        const data = getData();
        saveSnapshot(data).catch(() => { });
        // 每小时额外保存一份
        const currentHour = new Date().toISOString().slice(0, 13);
        if (currentHour !== lastHourlySave) {
            lastHourlySave = currentHour;
            saveHourlySnapshot(data).catch(() => { });
        }
    }, 5 * 60 * 1000);
    logger_1.logger.info('apm', '指标持久化已启动（每 5 分钟）');
}
function stopPersistence() {
    if (persistenceInterval) {
        clearInterval(persistenceInterval);
        persistenceInterval = null;
    }
}
//# sourceMappingURL=apm-persistence.js.map