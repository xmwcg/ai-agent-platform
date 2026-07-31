/**
 * 课程权益字段兼容迁移（前向迁移，默认只预览）
 *
 * 历史错误 Schema 曾把 freePreviewChapters / requiredPlan 嵌套到 isPublished 下。
 * 本脚本把已有文档归一化为：
 * - isPublished: boolean
 * - freePreviewChapters: number
 * - requiredPlan: free | pro | max
 *
 * 使用：
 *   npm run migrate:course-entitlements          # 只统计，不写库
 *   npm run migrate:course-entitlements -- --apply # 执行迁移
 *
 * 这是不可逆的前向修复：迁移前应先完成 MongoDB 备份；不应回写错误嵌套结构。
 */
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { connectMongoDB } from '../config/database';
import { Course } from '../models/Course';

dotenv.config();

export function buildCourseEntitlementMigrationPipeline(): Record<string, unknown>[] {
  return [
    {
      $set: {
        freePreviewChapters: {
          $cond: [
            { $eq: [{ $type: '$freePreviewChapters' }, 'number'] },
            '$freePreviewChapters',
            { $ifNull: ['$isPublished.freePreviewChapters', 2] },
          ],
        },
        requiredPlan: {
          $let: {
            vars: {
              candidate: { $ifNull: ['$requiredPlan', '$isPublished.requiredPlan'] },
            },
            in: {
              $cond: [
                { $in: ['$$candidate', ['free', 'pro', 'max']] },
                '$$candidate',
                { $cond: [{ $gt: [{ $ifNull: ['$price', 0] }, 0] }, 'pro', 'free'] },
              ],
            },
          },
        },
        isPublished: {
          $cond: [
            { $eq: [{ $type: '$isPublished' }, 'bool'] },
            '$isPublished',
            {
              $cond: [
                { $eq: [{ $type: '$isPublished.default' }, 'bool'] },
                '$isPublished.default',
                false,
              ],
            },
          ],
        },
      },
    },
  ];
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectMongoDB();

  const collection = Course.collection;
  const total = await collection.countDocuments({});
  const malformedPublished = await collection.countDocuments({ isPublished: { $type: 'object' } });
  const missingPreview = await collection.countDocuments({ freePreviewChapters: { $exists: false } });
  const missingPlan = await collection.countDocuments({ requiredPlan: { $exists: false } });

  console.log(JSON.stringify({
    mode: apply ? 'apply' : 'dry-run',
    total,
    malformedPublished,
    missingPreview,
    missingPlan,
  }, null, 2));

  if (!apply) {
    console.log('DRY_RUN_OK：未修改数据库；确认备份后追加 --apply 执行。');
    return;
  }

  const result = await collection.updateMany({}, buildCourseEntitlementMigrationPipeline());
  console.log(`MIGRATION_OK matched=${result.matchedCount} modified=${result.modifiedCount}`);
}

if (require.main === module) {
  main()
    .catch((error) => {
      console.error('MIGRATION_ERROR', error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await mongoose.disconnect().catch(() => undefined);
    });
}
