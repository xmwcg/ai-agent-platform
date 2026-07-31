/**
 * 一次性基线迁移脚本 —— 把 Batch 0 baseline 落库成 12 个 ScoreSnapshot
 * + 1 个对外可分享 ProjectGradeReport (publicId='rpt_aibak_baseline_20260720')
 *
 * 用法：
 *   cd server
 *   npx ts-node --transpile-only src/scripts/migrate-baseline-2026-07-20.ts
 *
 * 幂等：脚本启动时检查 publicId 是否已存在；已存在则直接跳过。
 * 仅在 production / staging 数据库上执行。
 */

import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import {
  ProjectGradeReport,
  PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID,
  PUBLIC_REPORT_TTL_DAYS,
} from '../models/ProjectGradeReport';
import { ProjectGradeScoreSnapshot } from '../models/ProjectGradeScoreSnapshot';

interface Batch0Snapshot {
  dimensionKey: string;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  rules: Array<{
    ruleKey: string;
    title: string;
    weight: number;
    completion: number;
    evidenceLevel: string;
    evidenceFactor: number;
    awardedScore: number;
    notes: string;
    evidenceIds: string[];
  }>;
}

interface Batch0Json {
  runId: string;
  projectName: string;
  projectType: 'website' | 'saas' | 'ai_application';
  projectUrl: string;
  rulePackKey: string;
  rulePackVersion: string;
  assessedAt: string;
  rawTotalScore: number;
  finalTotalScore: number;
  normalizedScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  releaseGate: {
    status: string;
    highestSeverity: 'P0' | 'P1' | 'P2' | 'P3' | null;
    scoreCap: number;
    blockedForRelease: boolean;
    blockedForPaidSale: boolean;
    reasons: string[];
  };
  snapshots: Batch0Snapshot[];
  summary: string;
}

function findBaselineFile(): string {
  const candidates = [
    path.resolve(__dirname, '../../../docs/PROJECTGRADE-BATCH0-BASELINE-2026-07-20.json'),
    path.resolve(__dirname, '../../docs/PROJECTGRADE-BATCH0-BASELINE-2026-07-20.json'),
    path.resolve(process.cwd(), 'docs/PROJECTGRADE-BATCH0-BASELINE-2026-07-20.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  throw new Error('未找到 PROJECTGRADE-BATCH0-BASELINE-2026-07-20.json');
}

function severityGate(grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F', normalized: number): 'P0' | 'P1' | 'P2' | 'P3' | null {
  if (grade === 'F') {
    if (normalized <= 9) return 'P0';
    return 'P1';
  }
  if (grade === 'D') return 'P3';
  return null;
}

async function main() {
  const mongoUri =
    process.env.MONGO_URI ||
    process.env.MONGODB_URI ||
    'mongodb://127.0.0.1:27017/ai_agent_platform';
  await mongoose.connect(mongoUri);

  const filePath = findBaselineFile();
  const baseline = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Batch0Json;
  const baselineSystemRunId = baseline.runId;

  const existing = await ProjectGradeReport.findOne({
    publicId: PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID,
  });

  if (existing) {
    console.log(
      `[skip] publicId='${PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID}' 已存在，跳过迁移。`
    );
    await mongoose.disconnect();
    return;
  }

  const publishedAt = new Date(baseline.assessedAt);
  const expiresAt = new Date(publishedAt.getTime() + PUBLIC_REPORT_TTL_DAYS * 24 * 60 * 60 * 1000);

  const reportTenantId = 'tenant.aibak-baseline';
  const reportOwnerId = 'user.aibak-baseline-bootstrap';
  const reportProjectId = `seed.baseline.${baselineSystemRunId.slice(0, 8)}`;
  const reportRunId = `seed.baseline.run.${baselineSystemRunId}`;

  const findingHighlights = [
    {
      severity: 'P1' as const,
      dimensionKey: 'product_strategy',
      title: '核心用户旅程缺少本次生产自动验证',
    },
    {
      severity: 'P1' as const,
      dimensionKey: 'ai_quality',
      title: 'AI 核心能力缺少版本化测试集和生产证据',
    },
    {
      severity: 'P1' as const,
      dimensionKey: 'commerce_delivery',
      title: '支付、权益与交付闭环未在本次运行中验证',
    },
    {
      severity: 'P2' as const,
      dimensionKey: 'release_deployment',
      title: '正式发布四端版本一致性未验证',
    },
    {
      severity: 'P3' as const,
      dimensionKey: 'performance_capacity_cost',
      title: '性能、容量与成本维度原始分 11.3/60（最低维度）',
    },
  ];

  const severity = severityGate(baseline.grade, baseline.normalizedScore);

  await ProjectGradeReport.create({
    reportId: `rpt.${baselineSystemRunId}`,
    publicId: PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID,
    runId: reportRunId,
    projectId: reportProjectId,
    tenantId: reportTenantId,
    ownerUserId: reportOwnerId,
    title: 'AIbak 智评通 ProjectGrade 内部基线',
    projectName: 'AIbak 平台 (aibak.site)',
    projectKind: baseline.projectType,
    verdict: baseline.grade,
    externalScore: baseline.normalizedScore,
    internalScore: baseline.finalTotalScore,
    gateBlocked: severity,
    dimensionSnapshot: baseline.snapshots.map((d) => ({
      dimensionKey: d.dimensionKey,
      label: d.label,
      weight: d.weight,
      rawScore: d.rawScore,
      normalizedScore: d.normalizedScore,
    })),
    findingHighlights,
    assessmentScope: {
      mode: 'aibak_repository_baseline',
      target: baseline.projectUrl,
      note: baseline.summary,
    },
    baselineNote: baseline.summary,
    isPublic: true,
    publishedAt,
    expiresAt,
    sharedCount: 0,
    immutable: true,
  });

  for (const snapshot of baseline.snapshots) {
    for (const rule of snapshot.rules) {
      const snapshotId = `snap.${baselineSystemRunId}.${rule.ruleKey}`;
      await ProjectGradeScoreSnapshot.findOneAndUpdate(
        { snapshotId },
        {
          $setOnInsert: {
            snapshotId,
            runId: reportRunId,
            projectId: reportProjectId,
            targetId: `seed.baseline.target.${baselineSystemRunId.slice(0, 8)}`,
            ownerId: reportOwnerId,
            teamId: reportTenantId,
            rulePackKey: baseline.rulePackKey,
            rulePackVersion: baseline.rulePackVersion,
            dimensionKey: snapshot.dimensionKey,
            label: snapshot.label,
            weight: snapshot.weight,
            rawScore: snapshot.rawScore,
            normalizedScore: snapshot.normalizedScore,
            rules: [
              {
                ruleKey: rule.ruleKey,
                title: rule.title,
                weight: rule.weight,
                completion: rule.completion,
                evidenceLevel: rule.evidenceLevel,
                evidenceFactor: rule.evidenceFactor,
                awardedScore: rule.awardedScore,
                notes: rule.notes,
                evidenceIds: rule.evidenceIds,
              },
            ],
            assessedAt: publishedAt,
            projectionVersion: 1,
          },
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
  }

  console.log(
    `[ok] 已写入 ProjectGradeReport publicId=${PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID} (verdict=${baseline.grade}, external=${baseline.normalizedScore}/100)`
  );
  console.log(`[ok] 同步落库 ${baseline.snapshots.length} 个维度 / ${
    baseline.snapshots.reduce((s, d) => s + d.rules.length, 0)
  } 条规则快照`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error('[fatal]', err);
  try {
    await mongoose.disconnect();
  } catch {}
  process.exit(1);
});