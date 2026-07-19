"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logSecretAudit = logSecretAudit;
exports.checkTestAbuse = checkTestAbuse;
const SecretAuditLog_1 = require("../models/SecretAuditLog");
const logger_1 = require("../lib/logger");
/**
 * 写入敏感密钥操作审计日志。
 * 设计为异步、失败不阻塞主业务（与 team-audit 一致）。
 */
async function logSecretAudit(entry) {
    try {
        await SecretAuditLog_1.SecretAuditLog.create({
            secretType: entry.secretType || 'model_config_api_key',
            ownerId: entry.ownerId,
            actorId: entry.actorId,
            targetId: entry.targetId,
            action: entry.action,
            ip: entry.ip || '',
            userAgent: entry.userAgent,
            result: entry.result || 'success',
            alert: entry.alert || false,
            detail: entry.detail || null,
        });
    }
    catch (e) {
        logger_1.logger.error('secret-audit', '写入密钥审计日志失败（已忽略，不阻塞主流程）', e.message);
    }
}
// ─── 异常告警：高频测试连接滑动窗口 ───────────────────────────────
// 单实例内存实现，简单可靠。多实例部署可改为 Redis（ioredis 已就绪）：
//   用 INCR + EXPIRE 对 `${actorId}` 计数即可。
const TEST_WINDOW_MS = 60000; // 滑动窗口 60 秒
const TEST_MAX = 20; // 窗口内超过 20 次测试连接即告警
const testHits = new Map();
/**
 * 检查某操作者是否在短时间内高频调用「测试连接」（疑似探测/滥用 apiKey）。
 * 命中返回 true，并打印告警日志（由调用方决定是否记入审计的 alert 字段）。
 */
function checkTestAbuse(actorId, ip) {
    const now = Date.now();
    const arr = (testHits.get(actorId) || []).filter((t) => now - t < TEST_WINDOW_MS);
    arr.push(now);
    testHits.set(actorId, arr);
    if (arr.length > TEST_MAX) {
        logger_1.logger.warn('secret-audit', `高频测试连接告警：actor=${actorId} ip=${ip} 在 ${TEST_WINDOW_MS / 1000}s 内触发 ${arr.length} 次`);
        return true;
    }
    return false;
}
//# sourceMappingURL=secret-audit.service.js.map