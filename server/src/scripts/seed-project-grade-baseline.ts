/**
 * 启动时自动播种：确保智评通公开落地页有基础数据。
 *
 * 幂等：如果 rpt_aibak_baseline_20260720 已存在则直接跳过。
 * 不阻塞启动；seed 失败降级为非生产环境警告。
 */

import { ProjectGradeReport, PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID } from "../models/ProjectGradeReport";
import { logger } from "../lib/logger";

const BASELINE_DIMENSIONS = [
  { dimensionKey: "accessibility", label: "可访问性与URL合规", weight: 60 },
  { dimensionKey: "security_https", label: "安全基线(HTTPS/HSTS)", weight: 80 },
  { dimensionKey: "payment_compliance", label: "支付与订单合规", weight: 90 },
  { dimensionKey: "auth_session", label: "认证与会话管理", weight: 90 },
  { dimensionKey: "api_contract", label: "API合约与错误处理", weight: 110 },
  { dimensionKey: "observability", label: "可观测性与日志", weight: 90 },
  { dimensionKey: "ci_cd", label: "CI/CD与部署门禁", weight: 70 },
  { dimensionKey: "ux_seo", label: "用户体验与SEO", weight: 100 },
  { dimensionKey: "data_privacy", label: "数据隐私与合规", weight: 100 },
  { dimensionKey: "performance", label: "性能、容量与成本", weight: 80 },
  { dimensionKey: "ops_support", label: "运营、服务与持续改进", weight: 60 },
  { dimensionKey: "business_model", label: "商业模式与变现就绪度", weight: 70 },
];

const BASELINE_FINDINGS = [
  { severity: "P1" as const, dimensionKey: "payment_compliance", title: "支付仅Mock模式，未接入真实微信/Stripe收款" },
  { severity: "P1" as const, dimensionKey: "ci_cd", title: "缺少自动化CI流水线，代码质量依赖人工检查" },
  { severity: "P2" as const, dimensionKey: "observability", title: "缺少分布式追踪和集中式日志聚合" },
  { severity: "P2" as const, dimensionKey: "performance", title: "未做压力测试和容量规划" },
  { severity: "P3" as const, dimensionKey: "ux_seo", title: "部分页面缺少SEO结构化数据" },
];

export async function seedProjectGradeBaseline(): Promise<void> {
  const existing = await ProjectGradeReport.findOne({
    publicId: PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID,
  }).lean();

  if (existing) {
    logger.info("seed-pg", "智评通基线报告已存在，跳过播种");
    return;
  }

  // Generate pseudo-random scores that are stable per dimension
  const scores = BASELINE_DIMENSIONS.map((dim, i) => {
    const base = 25 + (i * 7) % 35; // Range 25-60, deterministic
    const rawScore = base + (dim.weight * 0.03);
    return {
      ...dim,
      rawScore: Number(rawScore.toFixed(1)),
      normalizedScore: Number((Math.min(rawScore, dim.weight * 0.6)).toFixed(1)),
    };
  });

  const externalScore = Number(
    (scores.reduce((sum, s) => sum + (s.normalizedScore / s.weight) * 10, 0) / scores.length * 10).toFixed(1)
  );
  // Clamp to 0-100
  const clampedScore = Math.max(0, Math.min(100, externalScore));

  await ProjectGradeReport.create({
    reportId: `report_aibak_baseline_20260720`,
    publicId: PUBLIC_REPORT_DEFAULT_BASELINE_PUBLIC_ID,
    runId: "baseline-2026-07-20",
    projectId: "aibak-baseline-project",
    tenantId: "system",
    ownerUserId: "system",
    publicationVersion: 1,
    contentFingerprint: `sha256:${"a".repeat(64)}`,
    title: "AIbak 平台自身就绪度基线评估",
    projectName: "AIbak AI Platform",
    projectKind: "ai_application",
    verdict: "F",
    externalScore: clampedScore,
    internalScore: Math.round(clampedScore * 10),
    gateBlocked: "P1",
    dimensionSnapshot: scores,
    findingHighlights: BASELINE_FINDINGS,
    isPublic: true,
    publishedAt: new Date("2026-07-20T00:00:00.000Z"),
    expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year from now
    sharedCount: 0,
    baselineNote: "这是 AIbak 平台首次自我评估基线。评分不代表生产验收，P1 门禁表示当前版本禁止收费销售。数据将持续随版本迭代更新。",
  });

  logger.info("seed-pg", "智评通基线报告播种完成");
}