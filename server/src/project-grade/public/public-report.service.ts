import { createHash, randomBytes } from 'crypto';
import { ProjectGradeReport } from '../../models/ProjectGradeReport';

/**
 * Public report service — 用于公开 Landing / 公开报告 / SVG 评分徽章。
 *
 * 公开数据只能从 ProjectGradeReport 读，不直接对外暴露 EvaluationRun 与 Evidence
 * 原文，避免出现内部细节 / 凭据 / 路径泄漏。gradings / findings 仅保留高亮字段。
 */

const SSRF_ORIGIN_LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export interface PublicReportSummary {
  publicId: string;
  title: string;
  projectName: string;
  projectKind: 'website' | 'saas' | 'ai_application';
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: 'P0' | 'P1' | 'P2' | 'P3' | null;
  publishedAt: Date;
  expiresAt: Date;
  sharedCount: number;
  sourceProjectUrl?: string;
  baselineNote?: string;
}

export interface PublicReportDetail extends PublicReportSummary {
  dimensionSnapshot: Array<{
    dimensionKey: string;
    label: string;
    weight: number;
    rawScore: number;
    normalizedScore: number;
  }>;
  findingHighlights: Array<{
    severity: 'P0' | 'P1' | 'P2' | 'P3';
    dimensionKey: string;
    title: string;
  }>;
  assessmentScope?: { mode: string; target?: string; note: string };
}

export interface LandingAggregates {
  totalPublishedReports: number;
  totalPublicProjects: number;
  medianScore: number;
  averageScore: number;
  severityBreakdown: { P0: number; P1: number; P2: number; P3: number; none: number };
  verdictBreakdown: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', number>;
  recentReports: PublicReportSummary[];
}

export function generatePublicId(prefix = 'rpt'): string {
  const raw = randomBytes(8).toString('hex');
  return `${prefix}_${raw}`;
}

export function isLoopbackHost(host: string): boolean {
  if (!host) return false;
  return SSRF_ORIGIN_LOOPBACK_HOSTS.has(host.toLowerCase());
}

export async function fetchPublicReportDetail(publicId: string): Promise<PublicReportDetail | null> {
  const safeId = (publicId || '').trim();
  if (!safeId || safeId.length > 64) return null;

  const doc = await ProjectGradeReport.findOne({ publicId: safeId, isPublic: true })
    .select({
      publicId: 1,
      title: 1,
      projectName: 1,
      projectKind: 1,
      verdict: 1,
      externalScore: 1,
      internalScore: 1,
      gateBlocked: 1,
      publishedAt: 1,
      expiresAt: 1,
      sharedCount: 1,
      assessmentScope: 1,
      baselineNote: 1,
      dimensionSnapshot: 1,
      findingHighlights: 1,
    })
    .lean();

  if (!doc) return null;
  if (doc.expiresAt && doc.expiresAt.getTime() < Date.now()) return null;

  const safeScope = doc.assessmentScope
    ? {
        mode: String(doc.assessmentScope.mode || 'public_report'),
        target: doc.assessmentScope.target ? String(doc.assessmentScope.target) : undefined,
        note: String(doc.assessmentScope.note || '公开评估快照'),
      }
    : undefined;

  return {
    publicId: doc.publicId,
    title: doc.title,
    projectName: doc.projectName,
    projectKind: doc.projectKind,
    verdict: doc.verdict,
    externalScore: doc.externalScore,
    internalScore: doc.internalScore,
    gateBlocked: doc.gateBlocked,
    publishedAt: doc.publishedAt,
    expiresAt: doc.expiresAt,
    sharedCount: doc.sharedCount,
    assessmentScope: safeScope,
    baselineNote: doc.baselineNote || undefined,
    dimensionSnapshot: (doc.dimensionSnapshot || []).map((d) => ({
      dimensionKey: d.dimensionKey,
      label: d.label,
      weight: d.weight,
      rawScore: d.rawScore,
      normalizedScore: d.normalizedScore,
    })),
    findingHighlights: (doc.findingHighlights || []).slice(0, 5).map((f) => ({
      severity: f.severity,
      dimensionKey: f.dimensionKey,
      title: f.title,
    })),
  };
}

export async function listPublishedSummaries(limit = 12): Promise<PublicReportSummary[]> {
  const docs = await ProjectGradeReport.find({ isPublic: true, expiresAt: { $gt: new Date() } })
    .sort({ publishedAt: -1 })
    .limit(Math.max(1, Math.min(50, limit)))
    .select({
      publicId: 1,
      title: 1,
      projectName: 1,
      projectKind: 1,
      verdict: 1,
      externalScore: 1,
      internalScore: 1,
      gateBlocked: 1,
      publishedAt: 1,
      expiresAt: 1,
      sharedCount: 1,
      baselineNote: 1,
    })
    .lean();

  return docs.map((doc) => ({
    publicId: doc.publicId,
    title: doc.title,
    projectName: doc.projectName,
    projectKind: doc.projectKind,
    verdict: doc.verdict,
    externalScore: doc.externalScore,
    internalScore: doc.internalScore,
    gateBlocked: doc.gateBlocked,
    publishedAt: doc.publishedAt,
    expiresAt: doc.expiresAt,
    sharedCount: doc.sharedCount,
    baselineNote: doc.baselineNote || undefined,
  }));
}

export async function getLandingAggregates(): Promise<LandingAggregates> {
  const now = new Date();
  const docs = await ProjectGradeReport.find({ isPublic: true, expiresAt: { $gt: now } })
    .select({
      publicId: 1,
      title: 1,
      projectName: 1,
      projectKind: 1,
      verdict: 1,
      externalScore: 1,
      internalScore: 1,
      gateBlocked: 1,
      publishedAt: 1,
      expiresAt: 1,
      sharedCount: 1,
      baselineNote: 1,
    })
    .lean();

  if (docs.length === 0) {
    return {
      totalPublishedReports: 0,
      totalPublicProjects: 0,
      medianScore: 0,
      averageScore: 0,
      severityBreakdown: { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 },
      verdictBreakdown: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 0 },
      recentReports: [],
    };
  }

  const scores = docs.map((d) => d.externalScore).sort((a, b) => a - b);
  const median = scores.length % 2 === 0
    ? (scores[scores.length / 2 - 1] + scores[scores.length / 2]) / 2
    : scores[Math.floor(scores.length / 2)];
  const avg = scores.reduce((s, n) => s + n, 0) / scores.length;
  const projects = new Set(docs.map((d) => d.projectName)).size;

  const severityBreakdown = { P0: 0, P1: 0, P2: 0, P3: 0, none: 0 };
  const verdictBreakdown: Record<'S' | 'A' | 'B' | 'C' | 'D' | 'F', number> = {
    S: 0,
    A: 0,
    B: 0,
    C: 0,
    D: 0,
    F: 0,
  };
  for (const doc of docs) {
    if (doc.gateBlocked) severityBreakdown[doc.gateBlocked] += 1;
    else severityBreakdown.none += 1;
    verdictBreakdown[doc.verdict] = (verdictBreakdown[doc.verdict] || 0) + 1;
  }

  const recentReports: PublicReportSummary[] = docs
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, 6)
    .map((doc) => ({
      publicId: doc.publicId,
      title: doc.title,
      projectName: doc.projectName,
      projectKind: doc.projectKind,
      verdict: doc.verdict,
      externalScore: doc.externalScore,
      internalScore: doc.internalScore,
      gateBlocked: doc.gateBlocked,
      publishedAt: doc.publishedAt,
      expiresAt: doc.expiresAt,
      sharedCount: doc.sharedCount,
      baselineNote: doc.baselineNote || undefined,
    }));

  return {
    totalPublishedReports: docs.length,
    totalPublicProjects: projects,
    medianScore: median,
    averageScore: avg,
    severityBreakdown,
    verdictBreakdown,
    recentReports,
  };
}

export async function incrementShareCount(publicId: string): Promise<number | null> {
  const safeId = (publicId || '').trim();
  if (!safeId || safeId.length > 64) return null;
  const updated = await ProjectGradeReport.findOneAndUpdate(
    { publicId: safeId, isPublic: true },
    { $inc: { sharedCount: 1 } },
    { new: true, projection: { sharedCount: 1 } }
  );
  return updated ? updated.sharedCount : null;
}

/**
 * 为静态 URL 生成一个稳定的签名 token：签名会体现 publicId + 服务端密钥 + 时间错，
 * 用于防爬虫带外抓取；当前仅返回 fingerprint，不在接口签名上做严格防伪。
 */
export function generateBadgeFingerprint(publicId: string, score: number): string {
  const raw = `${publicId}:${score.toFixed(2)}`;
  return createHash('sha256').update(raw).digest('hex').slice(0, 8);
}