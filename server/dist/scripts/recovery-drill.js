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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const backup_service_1 = require("../services/backup.service");
const alert_service_1 = require("../services/alert.service");
const security_audit_service_1 = require("../services/security-audit.service");
const mongoose_1 = __importDefault(require("mongoose"));
async function runRecoveryDrill() {
    const start = Date.now();
    console.log('=== 数据库恢复演练开始 ===');
    console.log(`时间: ${new Date().toISOString()}`);
    const report = {
        timestamp: new Date().toISOString(),
        backupUsed: '',
        backupDate: null,
        checks: {
            userCount: { expected: 0, actual: 0, pass: false },
            orderCount: { expected: 0, actual: 0, pass: false },
            creditBalance: { expected: 0, actual: 0, pass: false },
            indexes: { expected: [], found: [], pass: false },
            attachments: { pass: false, message: '' },
        },
        totalDurationMs: 0,
        success: false,
    };
    try {
        // 1. 列出备份
        const backups = await (0, backup_service_1.listBackups)();
        if (backups.length === 0) {
            throw new Error('没有可用的备份文件');
        }
        const fullBackups = backups.filter(b => b.type === 'full');
        if (fullBackups.length === 0) {
            throw new Error('没有可用的全量备份');
        }
        const latest = fullBackups[0];
        report.backupUsed = latest.name;
        report.backupDate = new Date(latest.createdAt);
        console.log(`使用备份: ${latest.name} (${latest.createdAt})`);
        // 2. 获取当前生产数据统计（恢复校验的基准）
        const productionDb = mongoose_1.default.connection.db;
        if (!productionDb) {
            throw new Error('无法连接生产数据库');
        }
        const [prodUserCount, prodOrderCount, prodCreditsSum] = await Promise.all([
            productionDb.collection('users').countDocuments(),
            productionDb.collection('orders').countDocuments(),
            productionDb.collection('creditlots').aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
            ]).toArray().then(a => a[0]?.total || 0),
        ]);
        report.checks.userCount.expected = prodUserCount;
        report.checks.orderCount.expected = prodOrderCount;
        report.checks.creditBalance.expected = prodCreditsSum;
        console.log(`生产基准: ${prodUserCount} 用户, ${prodOrderCount} 订单, ${prodCreditsSum} 积分`);
        // 3. 恢复到隔离数据库（使用不同数据库名）
        const restoreDbName = 'ai-agent-platform-recovery-drill';
        const restoreUri = (process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform')
            .replace(/\/[^/]+(\?|$)/, `/${restoreDbName}$1`);
        // 创建临时连接
        const restoreConn = await mongoose_1.default.createConnection(restoreUri).asPromise();
        try {
            // 执行 mongorestore 到隔离数据库
            const backupFile = latest.path;
            const { execFile } = await Promise.resolve().then(() => __importStar(require('child_process')));
            const { promisify } = await Promise.resolve().then(() => __importStar(require('util')));
            const execAsync = promisify(execFile);
            await execAsync('mongorestore', [
                `--uri=${restoreUri}`,
                `--archive=${backupFile}`,
                '--gzip',
                '--drop',
                '--stopOnError',
            ], { timeout: 600000 });
            console.log('数据库恢复完成，开始完整性校验...');
            // 4. 校验恢复数据
            const restoreDb = restoreConn.db;
            // 用户数
            const restoredUsers = await restoreDb.collection('users').countDocuments();
            report.checks.userCount.actual = restoredUsers;
            report.checks.userCount.pass = Math.abs(restoredUsers - prodUserCount) <= Math.max(prodUserCount * 0.01, 5);
            console.log(`用户数: ${restoredUsers} / ${prodUserCount} → ${report.checks.userCount.pass ? 'PASS' : 'FAIL'}`);
            // 订单数
            const restoredOrders = await restoreDb.collection('orders').countDocuments();
            report.checks.orderCount.actual = restoredOrders;
            report.checks.orderCount.pass = Math.abs(restoredOrders - prodOrderCount) <= Math.max(prodOrderCount * 0.01, 5);
            console.log(`订单数: ${restoredOrders} / ${prodOrderCount} → ${report.checks.orderCount.pass ? 'PASS' : 'FAIL'}`);
            // 积分余额
            const restoredCredits = await restoreDb.collection('creditlots').aggregate([
                { $match: { status: 'active' } },
                { $group: { _id: null, total: { $sum: '$remainingAmount' } } },
            ]).toArray().then(a => a[0]?.total || 0);
            report.checks.creditBalance.actual = restoredCredits;
            report.checks.creditBalance.pass = Math.abs(restoredCredits - prodCreditsSum) <= Math.max(prodCreditsSum * 0.01, 100);
            console.log(`积分余额: ${restoredCredits} / ${prodCreditsSum} → ${report.checks.creditBalance.pass ? 'PASS' : 'FAIL'}`);
            // 索引校验
            const expectedIndexes = ['_id_', 'email_1', 'username_1'];
            const indexes = await restoreDb.collection('users').indexes();
            const indexNames = indexes.map(i => i.name);
            report.checks.indexes.expected = expectedIndexes;
            report.checks.indexes.found = indexNames;
            report.checks.indexes.pass = expectedIndexes.every(ei => indexNames.includes(ei));
            console.log(`索引: ${report.checks.indexes.pass ? 'PASS' : 'FAIL'}`);
            // 附件存在性（如果配置了 OSS）
            if (process.env.OSS_LOCAL_DIR) {
                const { stat } = await Promise.resolve().then(() => __importStar(require('fs/promises')));
                try {
                    await stat(process.env.OSS_LOCAL_DIR);
                    report.checks.attachments = { pass: true, message: 'OSS 目录存在' };
                }
                catch {
                    report.checks.attachments = { pass: false, message: 'OSS 目录不存在' };
                }
            }
            else {
                report.checks.attachments = { pass: true, message: '未配置 OSS，跳过' };
            }
            // 5. 判定结果
            report.success = report.checks.userCount.pass && report.checks.orderCount.pass
                && report.checks.creditBalance.pass && report.checks.indexes.pass;
            // 清理恢复数据库
            await restoreDb.dropDatabase();
        }
        finally {
            await restoreConn.close();
        }
    }
    catch (err) {
        report.error = err?.message || '未知错误';
        console.error(`恢复演练失败: ${report.error}`);
    }
    report.totalDurationMs = Date.now() - start;
    // 6. 输出报告
    console.log('\n=== 恢复演练报告 ===');
    console.log(JSON.stringify(report, null, 2));
    console.log(`总耗时: ${(report.totalDurationMs / 1000).toFixed(1)}s`);
    console.log(`结果: ${report.success ? 'PASS' : 'FAIL'}`);
    // 7. 记录审计和告警
    (0, security_audit_service_1.writeAuditLogAsync)({
        action: 'admin_action',
        resourceType: 'recovery_drill',
        resourceId: report.backupUsed,
        details: { success: report.success, checks: report.checks, durationMs: report.totalDurationMs },
        severity: report.success ? 'low' : 'high',
    });
    await (0, alert_service_1.alertRecoveryResult)(report.success, {
        backup: report.backupUsed,
        userCheck: report.checks.userCount.pass ? 'pass' : 'fail',
        orderCheck: report.checks.orderCount.pass ? 'pass' : 'fail',
        creditCheck: report.checks.creditBalance.pass ? 'pass' : 'fail',
        indexCheck: report.checks.indexes.pass ? 'pass' : 'fail',
        durationSec: Math.round(report.totalDurationMs / 1000),
        rto_met: report.totalDurationMs < 4 * 60 * 60 * 1000,
    });
    if (!report.success) {
        process.exit(1);
    }
}
runRecoveryDrill();
//# sourceMappingURL=recovery-drill.js.map