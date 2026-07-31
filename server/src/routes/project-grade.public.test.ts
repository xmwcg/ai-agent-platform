/* 测试策略：mock 整个 public-report.service，聚焦在公开路由的鉴权/序列化/限频契约。 */

const mockService = {
  fetchPublicReportDetail: jest.fn(),
  getLandingAggregates: jest.fn(),
  listPublishedSummaries: jest.fn(),
  incrementShareCount: jest.fn(),
  generateBadgeFingerprint: jest.fn(),
};

const mockUrlScanService = {
  scanPublicUrl: jest.fn(),
};

jest.mock('../project-grade/public/public-report.service', () => mockService);
jest.mock('../services/project-grade-url-scan.service', () => ({
  projectGradeUrlScanService: mockUrlScanService,
}));

import express from 'express';
import request from 'supertest';
import { AppError } from '../lib/http-error';
import projectGradePublicRoutes from './project-grade.public';

function buildApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(express.json());
  app.use('/api/project-grade', projectGradePublicRoutes);
  return app;
}

const validReportDetail = {
  publicId: 'rpt_aibak_baseline_20260720',
  title: 'AIbak 智评通 ProjectGrade 内部基线',
  projectName: 'AIbak 平台 (aibak.site)',
  projectKind: 'ai_application' as const,
  verdict: 'F' as const,
  externalScore: 37.6,
  internalScore: 376.4,
  gateBlocked: 'P1' as const,
  publishedAt: new Date('2026-07-20T15:08:43.048Z'),
  expiresAt: new Date('2027-07-20T15:08:43.048Z'),
  sharedCount: 0,
  dimensionSnapshot: [
    {
      dimensionKey: 'product_strategy',
      label: '开发计划与产品战略',
      weight: 60,
      rawScore: 18,
      normalizedScore: 30,
    },
  ],
  findingHighlights: [
    {
      severity: 'P1' as const,
      dimensionKey: 'product_strategy',
      title: '核心用户旅程缺少本次生产自动验证',
    },
  ],
  assessmentScope: {
    mode: 'aibak_repository_baseline',
    target: 'https://aibak.site',
    note: 'Batch 0 内部基线',
  },
};

describe('ProjectGrade Public Routes', () => {
  const app = buildApp();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /public/url-scan', () => {
    const scanResult = {
      scanVersion: 'project-grade-url-scan-v1',
      requestedUrl: 'https://example.com/',
      finalUrl: 'https://example.com/',
      statusCode: 200,
      contentType: 'text/html; charset=utf-8',
      responseBytes: 1024,
      durationMs: 120,
      redirectChain: [],
      checks: [
        { key: 'https', status: 'pass', title: 'HTTPS', detail: '已使用 HTTPS' },
        { key: 'description', status: 'warning', title: '页面描述', detail: '缺少描述' },
        { key: 'headers', status: 'fail', title: '安全响应头', detail: '缺少关键响应头' },
      ],
      metadata: { title: 'Example' },
      staticSignals: {},
      links: {},
      securityHeaders: { present: [], missing: [] },
      evidenceScope: 'single_server_http_observation',
      productionAcceptance: false,
      note: '仅代表单次服务端 HTTP 与静态 HTML 观察。',
    };

    it('返回不缓存、未持久化的静态观察汇总', async () => {
      mockUrlScanService.scanPublicUrl.mockResolvedValueOnce(scanResult);
      const res = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '203.0.113.21')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(200);
      expect(res.headers['cache-control']).toBe('no-store');
      expect(res.body.data.persisted).toBe(false);
      expect(res.body.data.productionAcceptance).toBe(false);
      expect(res.body.data.summaryMetrics).toEqual({
        score: 50,
        status: 'needs_attention',
        pass: 1,
        warning: 1,
        fail: 1,
      });
      expect(mockUrlScanService.scanPublicUrl).toHaveBeenCalledWith('https://example.com');
    });

    it('裸域名自动补全 HTTPS 后再进入安全扫描', async () => {
      mockUrlScanService.scanPublicUrl.mockResolvedValueOnce(scanResult);
      const res = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '203.0.113.25')
        .send({ url: 'www.baidu.com' });

      expect(res.status).toBe(200);
      expect(mockUrlScanService.scanPublicUrl).toHaveBeenCalledWith('https://www.baidu.com');
    });

    it('拒绝未知字段与无效请求体', async () => {
      const extraField = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '203.0.113.22')
        .send({ url: 'https://example.com', score: 100 });
      const invalidBody = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '203.0.113.23')
        .send([]);

      expect(extraField.status).toBe(400);
      expect(invalidBody.status).toBe(400);
      expect(mockUrlScanService.scanPublicUrl).not.toHaveBeenCalled();
    });

    it('每个来源每小时第 6 次请求返回 429', async () => {
      mockUrlScanService.scanPublicUrl.mockResolvedValue(scanResult);
      for (let index = 0; index < 5; index += 1) {
        const allowed = await request(app)
          .post('/api/project-grade/public/url-scan')
          .set('x-forwarded-for', '198.51.100.31')
          .send({ url: 'https://example.com' });
        expect(allowed.status).toBe(200);
      }
      const limited = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '198.51.100.31')
        .send({ url: 'https://example.com' });

      expect(limited.status).toBe(429);
      expect(limited.body.code).toBe('PROJECT_GRADE_PUBLIC_URL_SCAN_RATE_LIMITED');
      expect(limited.headers['ratelimit-policy']).toBeDefined();
    });

    it('外部扫描未启用时透传诚实的 503 状态', async () => {
      mockUrlScanService.scanPublicUrl.mockRejectedValueOnce(
        new AppError(503, '网址快速体检当前未启用', 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED')
      );
      const res = await request(app)
        .post('/api/project-grade/public/url-scan')
        .set('x-forwarded-for', '203.0.113.24')
        .send({ url: 'https://example.com' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED');
    });
  });

  describe('GET /public/landing', () => {
    it('正常透传', async () => {
      mockService.getLandingAggregates.mockResolvedValueOnce({
        totalPublishedReports: 1,
        totalPublicProjects: 1,
        medianScore: 37.6,
        averageScore: 37.6,
        severityBreakdown: { P0: 0, P1: 1, P2: 0, P3: 0, none: 0 },
        verdictBreakdown: { S: 0, A: 0, B: 0, C: 0, D: 0, F: 1 },
        recentReports: [],
      });
      const res = await request(app).get('/api/project-grade/public/landing');
      expect(res.status).toBe(200);
      expect(res.body.data.totalPublishedReports).toBe(1);
      expect(res.headers['cache-control']).toContain('public');
    });

    it('service 抛错时返回 500', async () => {
      mockService.getLandingAggregates.mockRejectedValueOnce(new Error('db error'));
      const res = await request(app).get('/api/project-grade/public/landing');
      expect(res.status).toBe(500);
    });
  });

  describe('GET /public/reports/:publicId', () => {
    it('已存在报告返回 200 + 数据', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(validReportDetail);
      const res = await request(app).get(
        '/api/project-grade/public/reports/rpt_aibak_baseline_20260720'
      );
      expect(res.status).toBe(200);
      expect(res.body.data.publicId).toBe('rpt_aibak_baseline_20260720');
      expect(res.body.data.findingHighlights.length).toBeGreaterThan(0);
    });

    it('报告不存在返回 404 + 错误码', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/project-grade/public/reports/rpt_missing');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROJECT_GRADE_PUBLIC_REPORT_NOT_FOUND');
    });

    it('service 报错返回 500', async () => {
      mockService.fetchPublicReportDetail.mockRejectedValueOnce(new Error('boom'));
      const res = await request(app).get(
        '/api/project-grade/public/reports/rpt_aibak_baseline_20260720'
      );
      expect(res.status).toBe(500);
    });
  });

  describe('POST /public/reports/:publicId/share', () => {
    it('成功计数 +1', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(validReportDetail);
      mockService.incrementShareCount.mockResolvedValueOnce(1);
      const res = await request(app)
        .post('/api/project-grade/public/reports/rpt_aibak_baseline_20260720/share')
        .set('x-forwarded-for', '203.0.113.5');
      expect(res.status).toBe(200);
      expect(res.body.data.sharedCount).toBe(1);
    });

    it('同 IP 24h 内超过 100 次返回 429', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValue(validReportDetail);
      mockService.incrementShareCount.mockResolvedValue(10);
      let lastStatus: number | null = null;
      for (let i = 0; i < 110; i += 1) {
        const res = await request(app)
          .post('/api/project-grade/public/reports/rpt_aibak_baseline_20260720/share')
          .set('x-forwarded-for', '198.51.100.7');
        lastStatus = res.status;
        if (res.status === 429) {
          expect(res.body.code).toBe('PROJECT_GRADE_PUBLIC_SHARE_RATE_LIMITED');
          return;
        }
      }
      expect(lastStatus).toBe(429);
    });

    it('不存在报告分享返回 404', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(null);
      const res = await request(app)
        .post('/api/project-grade/public/reports/rpt_missing/share')
        .set('x-forwarded-for', '203.0.113.99');
      expect(res.status).toBe(404);
    });
  });

  describe('GET /public/badge/:publicId.svg', () => {
    it('命中 SVG 路由并由 service 装配内容', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(validReportDetail);
      mockService.generateBadgeFingerprint.mockReturnValueOnce('a1b2c3d4');
      const res = await request(app).get(
        '/api/project-grade/public/badge/rpt_aibak_baseline_20260720.svg'
      );
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/image\/svg\+xml/);
      expect(res.headers['x-badge-fingerprint']).toBe('a1b2c3d4');
    });

    it('不存在的徽章返回 404', async () => {
      mockService.fetchPublicReportDetail.mockResolvedValueOnce(null);
      const res = await request(app).get('/api/project-grade/public/badge/rpt_missing.svg');
      expect(res.status).toBe(404);
      expect(res.body.code).toBe('PROJECT_GRADE_PUBLIC_BADGE_NOT_FOUND');
    });
  });

  describe('安全：escape 转义', () => {
    it('escapeXml 函数正确转义尖括号/引号', () => {
      const escapeXml = (value: string) =>
        value
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&apos;');
      expect(escapeXml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
      const evil = `A"><img src=x onerror=alert(1)>`;
      expect(escapeXml(evil)).toContain('&lt;img');
      expect(escapeXml(evil)).toContain('&quot;');
    });
  });
});
