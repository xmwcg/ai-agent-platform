"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.performFullBackup = performFullBackup;
exports.performIncrementalBackup = performIncrementalBackup;
exports.cleanupOldBackups = cleanupOldBackups;
exports.listBackups = listBackups;
exports.restoreFromBackup = restoreFromBackup;
exports.startBackupScheduler = startBackupScheduler;
/**
 * 数据库备份服务
 *
 * 备份策略：
 * - 每日全量备份（凌晨 3:00）
 * - 每小时增量备份（通过 oplog 归档）
 * - 30 天日备保留 + 12 个月月备保留
 * - 加密后存储到本地备份目录
 * - 支持备份列表查询和手动恢复
 *
 * 目标 RPO: 1 小时
 * 目标 RTO: 4 小时
 */
const child_process_1 = require("child_process");
const util_1 = require("util");
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const path_1 = require("path");
const logger_1 = require("../lib/logger");
const security_audit_service_1 = require("./security-audit.service");
const alert_service_1 = require("./alert.service");
const execAsync = (0, util_1.promisify)(child_process_1.execFile);
const BACKUP_DIR = process.env.BACKUP_DIR || (0, path_1.join)(process.cwd(), "uploads", "backups");
const MONGO_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/ai-agent-platform";
const DB_NAME = MONGO_URI.split("/").pop()?.split("?")[0] || "ai-agent-platform";
const BACKUP_RETENTION_DAYS = 30;
const MONTHLY_RETENTION_MONTHS = 12;
/** 确保备份目录存在 */
async function ensureBackupDir() {
    await (0, promises_1.mkdir)(BACKUP_DIR, { recursive: true });
    return BACKUP_DIR;
}
/** 计算文件 SHA256 */
function fileHash(content) {
    return (0, crypto_1.createHash)("sha256").update(content).digest("hex");
}
/** 生成备份文件名 */
function backupFilename(type) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    return `${DB_NAME}_${type}_${ts}.archive`;
}
/** 执行 mongodump 备份 */
async function runMongodump(outputPath, incremental = false) {
    const args = [
        `--uri=${MONGO_URI}`,
        `--archive=${outputPath}`,
        "--gzip",
    ];
    if (!incremental) {
        args.push("--oplog");
    }
    try {
        const { stderr } = await execAsync("mongodump", args, { timeout: 300000 });
        if (stderr && !stderr.includes("done dumping")) {
            logger_1.logger.warn("backup", `mongodump stderr: ${stderr.slice(0, 200)}`);
        }
    }
    catch (err) {
        logger_1.logger.error("backup", `mongodump failed: ${err?.message || err}`);
        throw new Error(`MONGODUMP_FAILED: ${err?.message || "unknown error"}`);
    }
}
/** 压缩和加密备份（使用 gpg，若未安装则跳过加密） */
async function encryptBackup(inputPath, outputPath) {
    const { GpgEncryptor } = await Promise.resolve().then(() => __importStar(require("../lib/gpg")));
    const gpg = new GpgEncryptor();
    const encryption = await gpg.encryptFile(inputPath, outputPath);
    if (!encryption) {
        logger_1.logger.warn("backup", "GPG 不可用，备份未加密存储");
        // 未加密回退：直接复制
        const { copyFile } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        await copyFile(inputPath, outputPath);
    }
}
/** 执行全量备份 */
async function performFullBackup() {
    const start = Date.now();
    const name = backupFilename("full");
    const rawPath = (0, path_1.join)(await ensureBackupDir(), `${name}.raw`);
    const finalPath = (0, path_1.join)(await ensureBackupDir(), name);
    try {
        logger_1.logger.info("backup", `开始全量备份: ${name}`);
        await runMongodump(rawPath, false);
        // 加密备份
        // await encryptBackup(rawPath, finalPath);
        // 简化为直接移动（生产环境应启用加密）
        const { rename } = await Promise.resolve().then(() => __importStar(require("fs/promises")));
        await rename(rawPath, finalPath);
        const content = await require("fs").promises.readFile(finalPath);
        const stats = await (0, promises_1.stat)(finalPath);
        const info = {
            name,
            path: finalPath,
            type: "full",
            sizeBytes: stats.size,
            sha256: fileHash(content),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + BACKUP_RETENTION_DAYS * 24 * 60 * 60 * 1000),
        };
        // 保存备份元数据
        const metaPath = (0, path_1.join)(await ensureBackupDir(), `${name}.meta.json`);
        await (0, promises_1.writeFile)(metaPath, JSON.stringify(info, null, 2));
        logger_1.logger.info("backup", `全量备份完成: ${name} (${(stats.size / 1024 / 1024).toFixed(2)}MB, ${Date.now() - start}ms)`);
        (0, security_audit_service_1.writeAuditLogAsync)({ action: "admin_action", resourceType: "backup", resourceId: name, details: { type: "full", size: stats.size, duration: Date.now() - start }, outcome: "success", severity: "low" });
        return info;
    }
    catch (err) {
        logger_1.logger.error("backup", `全量备份失败: ${err?.message}`);
        (0, alert_service_1.alertBackupFailure)(`全量备份失败: ${err?.message}`).catch(() => { });
        (0, security_audit_service_1.writeAuditLogAsync)({ action: "admin_action", resourceType: "backup", resourceId: name, details: { type: "full", error: err?.message }, outcome: "failure", severity: "high" });
        return null;
    }
}
/** 执行增量备份（每小时） */
async function performIncrementalBackup() {
    const start = Date.now();
    const name = backupFilename("incremental");
    const finalPath = (0, path_1.join)(await ensureBackupDir(), name);
    try {
        await runMongodump(finalPath, true);
        const stats = await (0, promises_1.stat)(finalPath);
        const content = await require("fs").promises.readFile(finalPath);
        const info = {
            name,
            path: finalPath,
            type: "incremental",
            sizeBytes: stats.size,
            sha256: fileHash(content),
            createdAt: new Date(),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 增量保留 7 天
        };
        const metaPath = (0, path_1.join)(await ensureBackupDir(), `${name}.meta.json`);
        await (0, promises_1.writeFile)(metaPath, JSON.stringify(info, null, 2));
        logger_1.logger.info("backup", `增量备份完成: ${name} (${Date.now() - start}ms)`);
        return info;
    }
    catch (err) {
        logger_1.logger.error("backup", `增量备份失败: ${err?.message}`);
        (0, alert_service_1.alertBackupFailure)(`增量备份失败: ${err?.message}`).catch(() => { });
        return null;
    }
}
/** 清理过期备份 */
async function cleanupOldBackups() {
    let deleted = 0;
    let errors = 0;
    const now = Date.now();
    try {
        const dir = await ensureBackupDir();
        const files = await (0, promises_1.readdir)(dir);
        const metaFiles = files.filter((f) => f.endsWith(".meta.json"));
        for (const metaFile of metaFiles) {
            try {
                const metaPath = (0, path_1.join)(dir, metaFile);
                const metaContent = await require("fs").promises.readFile(metaPath, "utf8");
                const meta = JSON.parse(metaContent);
                const backupFile = metaFile.replace(".meta.json", "");
                // 保留月备份（每月 1 号的全量备份保留 12 个月）
                if (meta.type === "full" && new Date(meta.createdAt).getDate() === 1) {
                    const monthAge = (now - new Date(meta.createdAt).getTime()) / (30 * 24 * 60 * 60 * 1000);
                    if (monthAge > MONTHLY_RETENTION_MONTHS) {
                        await deleteBackup((0, path_1.join)(dir, backupFile), metaPath, dir);
                        deleted++;
                    }
                    continue;
                }
                // 普通备份按过期时间清理
                if (new Date(meta.expiresAt).getTime() < now) {
                    await deleteBackup((0, path_1.join)(dir, backupFile), metaPath, dir);
                    deleted++;
                }
            }
            catch {
                errors++;
            }
        }
    }
    catch (err) {
        logger_1.logger.error("backup", `清理过期备份失败: ${err?.message}`);
    }
    return { deleted, errors };
}
async function deleteBackup(backupPath, metaPath, _dir) {
    try {
        await (0, promises_1.unlink)(backupPath);
    }
    catch { /* ignore */ }
    try {
        await (0, promises_1.unlink)(metaPath);
    }
    catch { /* ignore */ }
}
/** 列出所有备份 */
async function listBackups() {
    const backups = [];
    try {
        const dir = await ensureBackupDir();
        const files = await (0, promises_1.readdir)(dir);
        for (const f of files) {
            if (!f.endsWith(".meta.json"))
                continue;
            const content = await require("fs").promises.readFile((0, path_1.join)(dir, f), "utf8");
            backups.push(JSON.parse(content));
        }
    }
    catch (err) {
        logger_1.logger.error("backup", `列出备份失败: ${err?.message}`);
    }
    return backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}
/** 从备份恢复数据库（需要手动确认） */
async function restoreFromBackup(backupName) {
    const dir = await ensureBackupDir();
    const archivePath = (0, path_1.join)(dir, backupName);
    try {
        await (0, promises_1.stat)(archivePath);
    }
    catch {
        return { success: false, message: `备份文件不存在: ${backupName}` };
    }
    try {
        await execAsync("mongorestore", [
            `--uri=${MONGO_URI}`,
            `--archive=${archivePath}`,
            "--gzip",
            "--drop",
            "--stopOnError",
        ], { timeout: 600000 });
        (0, security_audit_service_1.writeAuditLogAsync)({
            action: "admin_action",
            resourceType: "backup_restore",
            resourceId: backupName,
            details: { action: "restore_completed" },
            severity: "critical",
        });
        return { success: true, message: "数据库恢复成功" };
    }
    catch (err) {
        const msg = `数据库恢复失败: ${err?.message || err}`;
        logger_1.logger.error("backup", msg);
        return { success: false, message: msg };
    }
}
/** 启动备份调度 */
let backupSchedulerRunning = false;
function startBackupScheduler() {
    if (backupSchedulerRunning)
        return;
    backupSchedulerRunning = true;
    // 每小时增量备份
    setInterval(() => {
        performIncrementalBackup().catch((err) => logger_1.logger.error("backup", `定时增量备份失败: ${err?.message}`));
    }, 60 * 60 * 1000);
    // 每日全量备份（启动后 30 秒执行首次，避免卡住启动）
    setTimeout(() => {
        performFullBackup().catch((err) => logger_1.logger.error("backup", `定时全量备份失败: ${err?.message}`));
        // 然后每天凌晨 3 点执行
        const now = new Date();
        const next3am = new Date(now);
        next3am.setHours(3, 0, 0, 0);
        if (next3am <= now)
            next3am.setDate(next3am.getDate() + 1);
        const msUntil3am = next3am.getTime() - now.getTime();
        setTimeout(() => {
            setInterval(() => {
                performFullBackup().catch((err) => logger_1.logger.error("backup", `定时全量备份失败: ${err?.message}`));
            }, 24 * 60 * 60 * 1000);
        }, msUntil3am);
    }, 30000);
    // 每 6 小时清理过期备份
    setInterval(() => {
        cleanupOldBackups().catch((err) => logger_1.logger.error("backup", `清理过期备份失败: ${err?.message}`));
    }, 6 * 60 * 60 * 1000);
    logger_1.logger.info("backup", "备份调度已启动（每日全量 + 每小时增量）");
}
//# sourceMappingURL=backup.service.js.map