import { Router, type Request, type Response } from 'express';
import { AppError, sendError } from '../lib/http-error';
import { projectGradeUrlScanService } from '../services/project-grade-url-scan.service';
import { publicProjectGradeScanLimiter } from '../middleware/rate-limit';
import {
  fetchPublicReportDetail,
  getLandingAggregates,
  incrementShareCount,
  listPublishedSummaries,
  generateBadgeFingerprint,
} from '../project-grade/public/public-report.service';

const router = Router();

const SHARE_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000; // 24h
const shareHits = new Map<string, { count: number; resetAt: number }>();
function readPublicUrlScanInput(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new AppError(400, '请求体格式无效', 'PROJECT_GRADE_PUBLIC_URL_SCAN_INVALID_INPUT');
  }
  const record = body as Record<string, unknown>;
  if (Object.keys(record).length !== 1 || typeof record.url !== 'string') {
    throw new AppError(400, '仅支持提交 url 字段', 'PROJECT_GRADE_PUBLIC_URL_SCAN_INVALID_INPUT');
  }
  const rawUrl = record.url.trim();
  if (!rawUrl || rawUrl.length > 2048) {
    throw new AppError(
      422,
      '请输入长度不超过 2048 的网址',
      'PROJECT_GRADE_PUBLIC_URL_SCAN_INVALID_INPUT'
    );
  }
  // 获客页允许直接输入域名；显式协议仍交由网络安全层仅放行 HTTP(S)。
  return /^[a-z][a-z0-9+.-]*:/i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
}

function summarizePublicUrlScan(
  scan: Awaited<ReturnType<typeof projectGradeUrlScanService.scanPublicUrl>>
) {
  const pass = scan.checks.filter((item) => item.status === 'pass').length;
  const warning = scan.checks.filter((item) => item.status === 'warning').length;
  const fail = scan.checks.filter((item) => item.status === 'fail').length;
  const total = Math.max(1, scan.checks.length);
  const score = Math.max(0, Math.min(100, Math.round(((pass + warning * 0.5) / total) * 100)));
  const status = fail > 0 ? 'needs_attention' : warning > 0 ? 'needs_review' : 'healthy';
  return { score, status, pass, warning, fail };
}

function hitShareLimit(ip: string): boolean {
  const key = ip || 'unknown';
  const now = Date.now();
  const entry = shareHits.get(key);
  if (!entry || entry.resetAt <= now) {
    shareHits.set(key, { count: 1, resetAt: now + SHARE_RATE_LIMIT_WINDOW_MS });
    return false;
  }
  entry.count += 1;
  if (entry.count > 100) return true;
  return false;
}

/**
 * 匿名网址快速体检是获客入口：只返回本次 HTTP/静态 HTML 观察，不写入项目、报告或最终评分。
 * POST /api/project-grade/public/url-scan
 */
router.post(
  '/public/url-scan',
  publicProjectGradeScanLimiter,
  async (req: Request, res: Response) => {
    try {
      const url = readPublicUrlScanInput(req.body);
      const scan = await projectGradeUrlScanService.scanPublicUrl(url);
      const summary = summarizePublicUrlScan(scan);
      res.set('Cache-Control', 'no-store');
      res.json({
        ok: true,
        data: {
          title: scan.metadata.title || scan.finalUrl,
          summary: '已完成一次公网 HTTP 与静态 HTML 快速观察；登录后可保存项目并进行持续体检。',
          scan,
          summaryMetrics: summary,
          persisted: false,
          productionAcceptance: false,
        },
      });
    } catch (err) {
      sendError(res, err);
    }
  }
);

/**
 * 公开 Landing — 任何角色（含未登录）都能访问。仅返回公开报告聚合数据。
 * GET /api/project-grade/public/landing
 */
router.get('/public/landing', async (_req: Request, res: Response) => {
  try {
    const aggregates = await getLandingAggregates();
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json({
      ok: true,
      data: aggregates,
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 公开报告列表 — 仅返回脱敏后的概要。SEO 友好。
 * GET /api/project-grade/public/reports
 */
router.get('/public/reports', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 12;
    const summaries = await listPublishedSummaries(limit);
    res.set('Cache-Control', 'public, max-age=60, s-maxage=120');
    res.json({
      ok: true,
      data: summaries,
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 单份公开评分报告 — 任何角色（含未登录）都能访问，用于对外露出。
 * GET /api/project-grade/public/reports/:publicId
 */
router.get('/public/reports/:publicId', async (req: Request, res: Response) => {
  try {
    const detail = await fetchPublicReportDetail(req.params.publicId || '');
    if (!detail) {
      throw new AppError(
        404,
        '公开评分报告不存在或已过期',
        'PROJECT_GRADE_PUBLIC_REPORT_NOT_FOUND'
      );
    }
    res.set('Cache-Control', 'public, max-age=300, s-maxage=600');
    res.json({
      ok: true,
      data: detail,
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 公开分享计数 — 记录扫码 / 链接分享次数。24h 限频。
 * POST /api/project-grade/public/reports/:publicId/share
 */
router.post('/public/reports/:publicId/share', async (req: Request, res: Response) => {
  try {
    const ip =
      ((req.headers['x-forwarded-for'] as string) || '').split(',')[0].trim() ||
      req.socket.remoteAddress ||
      'unknown';
    if (hitShareLimit(ip)) {
      throw new AppError(429, '今日分享次数已达上限', 'PROJECT_GRADE_PUBLIC_SHARE_RATE_LIMITED');
    }
    const detail = await fetchPublicReportDetail(req.params.publicId || '');
    if (!detail) {
      throw new AppError(404, '公开评分报告不存在', 'PROJECT_GRADE_PUBLIC_REPORT_NOT_FOUND');
    }
    const next = await incrementShareCount(req.params.publicId || '');
    res.json({
      ok: true,
      data: {
        publicId: req.params.publicId,
        sharedCount: next ?? detail.sharedCount + 1,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * SVG 评分徽章 — 可被微信 / 百度 / 小红书爬虫读取。
 * GET /api/project-grade/public/badge/:publicId.svg
 */
router.get('/public/badge/:publicId.svg', async (req: Request, res: Response) => {
  try {
    const detail = await fetchPublicReportDetail(req.params.publicId || '');
    if (!detail) {
      throw new AppError(404, '评分徽章目标报告不存在', 'PROJECT_GRADE_PUBLIC_BADGE_NOT_FOUND');
    }
    const score = Math.round(detail.externalScore);
    const verdict = detail.verdict;
    const fingerprint = generateBadgeFingerprint(detail.publicId, detail.externalScore);
    const fillColor = verdictColor(verdict);
    const svg = buildBadgeSvg({
      label: 'AIbak 智评通',
      score,
      verdict,
      projectName: detail.projectName.slice(0, 28),
      fingerprint,
    });
    res.set({
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=600',
      'X-Badge-Fingerprint': fingerprint,
    });
    res.send(svg);
  } catch (err) {
    sendError(res, err);
  }
});

function verdictColor(verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F'): string {
  switch (verdict) {
    case 'S':
      return '#0a7f3f';
    case 'A':
      return '#3b82f6';
    case 'B':
      return '#06b6d4';
    case 'C':
      return '#f59e0b';
    case 'D':
      return '#f97316';
    case 'F':
    default:
      return '#dc2626';
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

interface BadgeInput {
  label: string;
  score: number;
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  projectName: string;
  fingerprint: string;
}

function buildBadgeSvg(input: BadgeInput): string {
  const fill = verdictColor(input.verdict);
  const label = escapeXml(input.label);
  const project = escapeXml(input.projectName);
  const scoreText = `${input.verdict} · ${input.score}/100`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="280" height="56" role="img" aria-label="${label}: ${project} ${scoreText}">
  <title>${label} · ${project} · ${scoreText}</title>
  <rect x="0" y="0" width="160" height="56" fill="#0f172a" />
  <rect x="160" y="0" width="120" height="56" fill="${fill}" />
  <text x="14" y="22" font-family="Inter, 'Segoe UI', sans-serif" font-size="13" fill="#94a3b8">${label}</text>
  <text x="14" y="42" font-family="Inter, 'Segoe UI', sans-serif" font-size="15" font-weight="700" fill="#f8fafc">${project}</text>
  <text x="220" y="32" font-family="Inter, 'Segoe UI', sans-serif" font-size="20" font-weight="800" fill="#ffffff" text-anchor="middle">${input.verdict}</text>
  <text x="220" y="48" font-family="Inter, 'Segoe UI', sans-serif" font-size="11" fill="#f8fafc" text-anchor="middle">${input.score}/100</text>
  <metadata>badge-fingerprint=${input.fingerprint}</metadata>
</svg>`;
}

export default router;
