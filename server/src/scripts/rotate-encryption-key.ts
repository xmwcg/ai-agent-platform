/**
 * 密钥轮换脚本（ENCRYPTION_KEY 安全换 key，不丢数据）
 * ================================================================
 * 场景：当前 ENCRYPTION_KEY 疑似泄露或按合规要求定期轮换。
 * 该脚本用「旧密钥」解密全部 ModelConfig.apiKey，再用「新密钥」重加密写回。
 *
 * 用法：
 *   1) 在 .env 同时设置：
 *        ENCRYPTION_KEY=<新 32 字节 hex>
 *        ENCRYPTION_KEY_PREV=<旧 32 字节 hex>
 *      然后：npm run rotate-key
 *
 *   2) 或用命令行参数（同样生效）：
 *        npm run rotate-key -- --old <旧hex> --new <新hex>
 *
 *   3) 先演练（不写库，仅统计+校验）：
 *        npm run rotate-key -- --dry-run
 *
 * 安全约定：
 *   - 失败即停：任一条记录解密或重加密异常，脚本立即退出，绝不全量破坏。
 *   - 幂等：已用新密钥加密的记录自动跳过，可重复执行。
 *   - 明文兼容：历史未加密的明文也会被新密钥加密落库（加固）。
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { ModelConfig } from '../models/ModelConfig';
import { keyFromHex, decryptSecret, encryptSecret } from '../lib/crypto';
import { logger } from '../lib/logger';

dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');

function getArg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function resolveKeys(): Buffer {
  const argOld = getArg('--old');
  const argNew = getArg('--new');
  // 命令行参数优先写入 env，使 decryptSecret 的「旧密钥回退」逻辑生效
  if (argNew) process.env.ENCRYPTION_KEY = argNew;
  if (argOld) process.env.ENCRYPTION_KEY_PREV = argOld;

  const newHex = process.env.ENCRYPTION_KEY;
  if (!newHex) {
    console.error('❌ 缺少新密钥：请设置 ENCRYPTION_KEY（或传入 --new <hex>）');
    process.exit(1);
  }
  return keyFromHex(newHex);
}

async function main(): Promise<void> {
  const newKey = resolveKeys();
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform';

  logger.info('rotate-key', DRY_RUN ? '演练模式（不写库）启动' : '密钥轮换启动', {
    uri: MONGODB_URI.replace(/\/\/.*@/, '//<credentials>@'),
    hasPrevKey: !!process.env.ENCRYPTION_KEY_PREV || !!getArg('--old'),
  });

  await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  logger.info('rotate-key', 'MongoDB 已连接');

  const configs = await ModelConfig.find({}).select('_id apiKey createdBy').lean();
  logger.info('rotate-key', `扫描到 ${configs.length} 条模型配置`);

  let rotated = 0;
  let skipped = 0;
  let empty = 0;
  let failed = 0;

  for (const cfg of configs) {
    const id = String((cfg as any)._id);
    const cipher: string = (cfg as any).apiKey || '';
    if (!cipher) {
      empty++;
      continue;
    }

    // 幂等：已经是新密钥加密的密文，直接跳过
    if (cipher.startsWith('enc::v1:')) {
      try {
        decryptSecret(cipher, { key: newKey });
        skipped++;
        continue;
      } catch {
        // 不是新密钥加密（通常是旧密钥），需要重加密
      }
    }

    try {
      // 解密：自动回退 ENCRYPTION_KEY_PREV / 明文兼容
      const plain = decryptSecret(cipher);
      const reEnc = encryptSecret(plain, { key: newKey });
      if (!DRY_RUN) {
        await ModelConfig.updateOne({ _id: id }, { $set: { apiKey: reEnc } });
      }
      rotated++;
      if (rotated % 50 === 0) logger.info('rotate-key', `已处理 ${rotated} 条...`);
    } catch (e) {
      failed++;
      logger.error('rotate-key', `记录 ${id} 处理失败，停止脚本以防止数据破坏`, (e as Error).message);
      // 失败即停：绝不全量破坏
      break;
    }
  }

  logger.info('rotate-key', '密钥轮换完成', { rotated, skipped, empty, failed, dryRun: DRY_RUN });

  if (failed > 0) {
    console.error(`❌ 轮换中断：成功 ${rotated} 条，失败 ${failed} 条。请排查上述错误后重跑（脚本幂等，可安全重跑）。`);
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(
    `✅ 密钥轮换${DRY_RUN ? '演练' : ''}完成：重加密 ${rotated} 条，已最新 ${skipped} 条，空值 ${empty} 条。`
  );
  await mongoose.disconnect();
  process.exit(0);
}

main().catch(async (e) => {
  logger.error('rotate-key', '脚本异常退出', (e as Error).message);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
