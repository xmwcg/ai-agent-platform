const mockPdf = jest.fn();
const mockSetContent = jest.fn();
const mockEmulateMediaType = jest.fn();
const mockNewPage = jest.fn();
const mockClose = jest.fn();
const mockLaunch = jest.fn();

jest.mock('puppeteer', () => ({
  __esModule: true,
  default: { launch: mockLaunch },
}));

import {
  buildProjectGradeReportHtml,
  renderProjectGradeReportPdf,
} from './project-grade-report-pdf.service';

function report(overrides: Record<string, unknown> = {}) {
  return {
    reportId: 'report-123456',
    publicId: 'rpt_project_123456',
    runId: 'run-123456',
    projectId: 'project-1234',
    tenantId: 'owner-1234',
    ownerUserId: 'owner-1234',
    publicationVersion: 1,
    contentFingerprint: `sha256:${'a'.repeat(64)}`,
    title: '<script>alert(1)</script> 正式报告',
    projectName: '客户 / AI 项目',
    projectKind: 'ai_application',
    verdict: 'A',
    externalScore: 88.5,
    internalScore: 885,
    gateBlocked: 'P1',
    dimensionSnapshot: [
      {
        dimensionKey: 'security',
        label: '安全 <核心>',
        weight: 100,
        rawScore: 88,
        normalizedScore: 88,
      },
    ],
    findingHighlights: [{ severity: 'P1', dimensionKey: 'security', title: '修复 <script> 注入' }],
    assessmentScope: { mode: 'baseline', note: '不构成生产验收' },
    isPublic: true,
    publishedAt: new Date('2026-07-22T00:00:00.000Z'),
    expiresAt: new Date('2026-08-22T00:00:00.000Z'),
    sharedCount: 0,
    immutable: true,
    ...overrides,
  } as any;
}

describe('ProjectGrade PDF renderer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPdf.mockResolvedValue(Buffer.from('%PDF-1.7 generated'));
    mockSetContent.mockResolvedValue(undefined);
    mockEmulateMediaType.mockResolvedValue(undefined);
    mockNewPage.mockResolvedValue({
      setContent: mockSetContent,
      emulateMediaType: mockEmulateMediaType,
      pdf: mockPdf,
    });
    mockClose.mockResolvedValue(undefined);
    mockLaunch.mockResolvedValue({ newPage: mockNewPage, close: mockClose });
  });

  it('escapes report-controlled HTML and keeps the immutable fingerprints visible', () => {
    const html = buildProjectGradeReportHtml(report(), {
      branding: 'aibak',
      generatedAt: new Date('2026-07-23T02:00:00.000Z'),
    });

    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    expect(html).toContain('安全 &lt;核心&gt;');
    expect(html).toContain(`sha256:${'a'.repeat(64)}`);
    expect(html).toContain('AIbak 智评通');
    expect(html).toContain('生产环境验收');
  });

  it('removes AIbak branding for white-label entitlements', () => {
    const html = buildProjectGradeReportHtml(report({ title: '客户报告' }), {
      branding: 'white_label',
      generatedAt: new Date('2026-07-23T02:00:00.000Z'),
    });

    expect(html).toContain('项目正式评估报告');
    expect(html).not.toContain('AIbak 智评通正式评估报告');
    expect(html).not.toContain('aibak.site');
  });

  it('renders an A4 PDF, computes an exact document fingerprint and always closes the browser', async () => {
    const result = await renderProjectGradeReportPdf(report(), {
      branding: 'aibak',
      generatedAt: new Date('2026-07-23T02:00:00.000Z'),
    });

    expect(mockLaunch).toHaveBeenCalledWith(
      expect.objectContaining({
        headless: true,
        args: expect.arrayContaining(['--no-sandbox', '--disable-dev-shm-usage']),
      })
    );
    expect(mockSetContent).toHaveBeenCalledWith(expect.stringContaining('<!doctype html>'), {
      waitUntil: 'networkidle0',
      timeout: 30000,
    });
    expect(mockPdf).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'A4', printBackground: true })
    );
    expect(result.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(result.documentFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.byteLength).toBe(result.buffer.byteLength);
    expect(result.fileName).toBe('客户-AI-项目-rpt_project_123456.pdf');
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('closes the browser when PDF generation fails', async () => {
    mockPdf.mockRejectedValue(new Error('render failed'));
    await expect(renderProjectGradeReportPdf(report(), { branding: 'aibak' })).rejects.toThrow(
      'render failed'
    );
    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
