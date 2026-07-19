"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * 将上线切换前的 User.credits 迁移为 legacy_protected 额度批次。
 *
 * 用法：
 *   npm run migrate:credit-lots -- --batch=2026-07-17-query-center --dry-run
 *   npm run migrate:credit-lots -- --batch=2026-07-17-query-center
 *
 * 安全约束：
 * - 幂等：同一用户 + batch 只迁移一次；
 * - 不改 User.credits，只建立与切换时余额等额的历史保护批次；
 * - 用户已有额度批次但与缓存余额不一致时立即标记失败，不自动修正；
 * - 每位用户独立事务，单个失败不会产生半条迁移记录。
 */
const mongoose_1 = __importDefault(require("mongoose"));
const dotenv_1 = __importDefault(require("dotenv"));
const CreditLot_1 = require("../models/CreditLot");
const CreditsTransaction_1 = require("../models/CreditsTransaction");
const User_1 = require("../models/User");
const logger_1 = require("../lib/logger");
dotenv_1.default.config();
function getArg(name) {
    const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
    if (exact)
        return exact.slice(name.length + 1);
    const index = process.argv.indexOf(name);
    return index >= 0 ? process.argv[index + 1] : undefined;
}
const DRY_RUN = process.argv.includes('--dry-run');
const BATCH = getArg('--batch') || '2026-07-17-query-center';
const LIMIT = Math.max(0, Number(getArg('--limit') || 0));
async function main() {
    const uri = process.env.MONGODB_URI;
    if (!uri)
        throw new Error('缺少 MONGODB_URI，拒绝执行额度迁移');
    logger_1.logger.info('credit-migration', DRY_RUN ? '额度迁移演练启动' : '额度迁移启动', {
        batch: BATCH,
        limit: LIMIT || 'all',
        uri: uri.replace(/\/\/.*@/, '//<credentials>@'),
    });
    await mongoose_1.default.connect(uri, { serverSelectionTimeoutMS: 10000 });
    let scanned = 0;
    let migratable = 0;
    let migrated = 0;
    let alreadyTracked = 0;
    let zeroBalance = 0;
    let failed = 0;
    const failures = [];
    const query = User_1.User.find({}).select('_id credits').sort({ _id: 1 });
    if (LIMIT > 0)
        query.limit(LIMIT);
    const cursor = query.cursor();
    for await (const user of cursor) {
        scanned++;
        const userId = user._id;
        const cachedBalance = Number(user.credits || 0);
        const idempotencyKey = `legacy-migration:${BATCH}:${String(userId)}`;
        if (cachedBalance < 0 || !Number.isSafeInteger(cachedBalance)) {
            failed++;
            failures.push({ userId: String(userId), reason: `非法缓存余额 ${cachedBalance}` });
            continue;
        }
        const existingMarker = await CreditLot_1.CreditLot.findOne({ userId, idempotencyKey }).lean();
        if (existingMarker) {
            alreadyTracked++;
            continue;
        }
        const existingLots = await CreditLot_1.CreditLot.find({
            userId,
            status: 'active',
            remainingAmount: { $gt: 0 },
        })
            .select('remainingAmount')
            .lean();
        const lotBalance = existingLots.reduce((sum, lot) => sum + Number(lot.remainingAmount || 0), 0);
        if (existingLots.length > 0) {
            if (lotBalance === cachedBalance) {
                alreadyTracked++;
            }
            else {
                failed++;
                failures.push({
                    userId: String(userId),
                    reason: `已有批次余额 ${lotBalance} 与缓存余额 ${cachedBalance} 不一致`,
                });
            }
            continue;
        }
        if (cachedBalance === 0) {
            zeroBalance++;
            continue;
        }
        migratable++;
        if (DRY_RUN)
            continue;
        const session = await mongoose_1.default.startSession();
        try {
            await session.withTransaction(async () => {
                const freshUser = await User_1.User.findById(userId).select('credits').session(session);
                if (!freshUser || Number(freshUser.credits || 0) !== cachedBalance) {
                    throw new Error('迁移期间用户余额发生变化');
                }
                const lotCount = await CreditLot_1.CreditLot.countDocuments({ userId }).session(session);
                if (lotCount !== 0)
                    throw new Error('迁移期间已出现额度批次');
                await CreditLot_1.CreditLot.create([
                    {
                        userId,
                        sourceType: 'legacy_protected',
                        originalAmount: cachedBalance,
                        remainingAmount: cachedBalance,
                        idempotencyKey,
                        status: 'active',
                        migrationBatch: BATCH,
                        auditReason: `商业额度分账切换：保护迁移前余额 ${cachedBalance}`,
                    },
                ], { session });
                await CreditsTransaction_1.CreditsTransaction.create([
                    {
                        userId,
                        type: 'adjustment',
                        amount: 0,
                        balanceBefore: cachedBalance,
                        balanceAfter: cachedBalance,
                        idempotencyKey,
                        businessType: 'legacy_credit_migration',
                        businessId: BATCH,
                        status: 'committed',
                        operatorId: 'system:migrate-credit-lots',
                        auditReason: `批次 ${BATCH}；原余额 ${cachedBalance}；不改变用户缓存余额`,
                        description: '历史积分余额迁移为受保护额度批次',
                    },
                ], { session });
            });
            migrated++;
        }
        catch (error) {
            failed++;
            failures.push({
                userId: String(userId),
                reason: error instanceof Error ? error.message : String(error),
            });
        }
        finally {
            await session.endSession();
        }
    }
    logger_1.logger.info('credit-migration', '额度迁移结束', {
        dryRun: DRY_RUN,
        batch: BATCH,
        scanned,
        migratable,
        migrated,
        alreadyTracked,
        zeroBalance,
        failed,
    });
    if (failures.length > 0) {
        for (const item of failures.slice(0, 20)) {
            logger_1.logger.error('credit-migration', `用户 ${item.userId} 迁移失败: ${item.reason}`);
        }
        throw new Error(`额度迁移存在 ${failed} 个失败用户，已拒绝以成功状态退出`);
    }
    console.log(`✅ 额度迁移${DRY_RUN ? '演练' : ''}完成：扫描 ${scanned}，可迁移 ${migratable}，已迁移 ${migrated}，已跟踪 ${alreadyTracked}，零余额 ${zeroBalance}`);
}
main()
    .then(async () => {
    await mongoose_1.default.disconnect();
    process.exit(0);
})
    .catch(async (error) => {
    logger_1.logger.error('credit-migration', '脚本失败', error instanceof Error ? error.message : String(error));
    try {
        await mongoose_1.default.disconnect();
    }
    catch {
        // ignore disconnect failures
    }
    process.exit(1);
});
//# sourceMappingURL=migrate-credit-lots.js.map