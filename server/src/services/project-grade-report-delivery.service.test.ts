const mockResolveUserPlan = jest.fn();
const mockReportFindOne = jest.fn();
const mockDeliveryCreate = jest.fn();
const mockDeliveryFind = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('../middleware/subscription', () => ({
  resolveUserPlan: mockResolveUserPlan,
}));

jest.mock('../models/ProjectGradeReport', () => ({
  ProjectGradeReport: {
    findOne: mockReportFindOne,
  },
}));

jest.mock('../models/ProjectGradeReportDelivery', () => ({
  ProjectGradeReportDelivery: {
    create: mockDeliveryCreate,
    find: mockDeliveryFind,
  },
}));

jest.mock('../models/ProjectGradeAuditLog', () => ({
  ProjectGradeAuditLog: {
    create: mockAuditCreate,
  },
}));

import { AppError } from '../lib/http-error';
import { ProjectGradeService } from './project-grade.service';

const project = {
  projectId: 'project-1234',
  ownerId: 'owner-1234',
  teamId: undefined,
  name: 'Customer Project',
  projectType: 'ai_application',
  projectUrl: 'https://example.com/',
  status: 'active',
};

function report(overrides: Record<string, unknown> = {}) {
  return {
    reportId: 'report-123456',
    publicId: 'rpt_project_123456',
    runId: 'run-123456',
    projectId: project.projectId,
    tenantId: project.ownerId,
    ownerUserId: project.ownerId,
    publicationVersion: 1,
    contentFingerprint: `sha256:${'a'.repeat(64)}`,
    title: 'Customer formal report',
    projectName: project.name,
    projectKind: 'ai_application',
    verdict: 'A',
    externalScore: 88.5,
    internalScore: 885,
    gateBlocked: null,
    dimensionSnapshot: [],
    findingHighlights: [],
    isPublic: true,
    publishedAt: new Date('2026-07-22T00:00:00.000Z'),
    publishedBy: project.ownerId,
    expiresAt: new Date('2026-08-22T00:00:00.000Z'),
    sharedCount: 0,
    immutable: true,
    ...overrides,
  };
}

function artifact(branding: 'aibak' | 'white_label' = 'aibak') {
  const buffer = Buffer.from('%PDF-1.7 test');
  return {
    buffer,
    documentFingerprint: `sha256:${'b'.repeat(64)}`,
    byteLength: buffer.byteLength,
    fileName: 'Customer-Project-rpt_project_123456.pdf',
    generatedAt: new Date('2026-07-23T02:00:00.000Z'),
    branding,
  };
}

function createService(renderer = jest.fn(async (_report, options) => artifact(options.branding))) {
  const service = new ProjectGradeService(
    process.cwd(),
    { scanRegisteredUrl: jest.fn() } as any,
    { scan: jest.fn() } as any,
    renderer as any
  );
  const projectAccess = jest.spyOn(service, 'getProjectForUser').mockResolvedValue(project as any);
  return { service, renderer, projectAccess };
}

function expectAppError(error: unknown, statusCode: number, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ statusCode, code });
}

describe('ProjectGrade formal report PDF delivery service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T02:00:00.000Z'));
    mockResolveUserPlan.mockResolvedValue({ plan: 'pro', expired: false });
    mockReportFindOne.mockResolvedValue(report());
    mockAuditCreate.mockImplementation(async (input) => input);
    mockDeliveryCreate.mockImplementation(async (input) => input);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('fails before report lookup and rendering when the plan has no PDF entitlement', async () => {
    const { service, renderer } = createService();
    mockResolveUserPlan.mockResolvedValue({ plan: 'free', expired: false });

    let error: unknown;
    try {
      await service.deliverProjectReportPdf(
        project.projectId,
        'rpt_project_123456',
        project.ownerId
      );
    } catch (caught) {
      error = caught;
    }

    expectAppError(error, 402, 'PROJECT_GRADE_REPORT_DOWNLOAD_PLAN_REQUIRED');
    expect(mockReportFindOne).not.toHaveBeenCalled();
    expect(renderer).not.toHaveBeenCalled();
  });

  it.each([
    [
      report({ isPublic: false, revokedAt: new Date('2026-07-23T01:00:00.000Z') }),
      409,
      'PROJECT_GRADE_REPORT_DOWNLOAD_REVOKED',
    ],
    [
      report({ expiresAt: new Date('2026-07-23T01:59:59.000Z') }),
      410,
      'PROJECT_GRADE_REPORT_DOWNLOAD_EXPIRED',
    ],
    [report({ contentFingerprint: undefined }), 409, 'PROJECT_GRADE_REPORT_FINGERPRINT_MISSING'],
  ])(
    'rejects an ineligible report lifecycle before PDF rendering',
    async (storedReport, statusCode, code) => {
      const { service, renderer } = createService();
      mockReportFindOne.mockResolvedValue(storedReport);

      let error: unknown;
      try {
        await service.deliverProjectReportPdf(
          project.projectId,
          'rpt_project_123456',
          project.ownerId
        );
      } catch (caught) {
        error = caught;
      }

      expectAppError(error, statusCode as number, code as string);
      expect(renderer).not.toHaveBeenCalled();
      expect(mockDeliveryCreate).not.toHaveBeenCalled();
    }
  );

  it('renders a branded Pro PDF, persists an immutable delivery record and writes audit endpoints', async () => {
    const { service, renderer, projectAccess } = createService();

    const result = await service.deliverProjectReportPdf(
      project.projectId,
      'rpt_project_123456',
      project.ownerId
    );

    expect(projectAccess).toHaveBeenCalledWith(project.projectId, project.ownerId, 'viewer');
    expect(renderer).toHaveBeenCalledWith(
      expect.objectContaining({ publicId: 'rpt_project_123456' }),
      { branding: 'aibak', generatedAt: new Date('2026-07-23T02:00:00.000Z') }
    );
    expect(mockDeliveryCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        reportId: 'report-123456',
        requestedBy: project.ownerId,
        format: 'pdf',
        planId: 'pro',
        branding: 'aibak',
        contentFingerprint: `sha256:${'a'.repeat(64)}`,
        documentFingerprint: `sha256:${'b'.repeat(64)}`,
      })
    );
    expect(result.delivery).toMatchObject({
      publicId: 'rpt_project_123456',
      branding: 'aibak',
      planId: 'pro',
    });
    expect(result.artifact.buffer.subarray(0, 4).toString()).toBe('%PDF');
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditCreate.mock.calls[0][0]).toMatchObject({
      action: 'report_download',
      outcome: 'attempted',
      targetType: 'report',
      targetId: 'rpt_project_123456',
    });
    expect(mockAuditCreate.mock.calls[1][0]).toMatchObject({
      action: 'report_download',
      outcome: 'succeeded',
      metadata: expect.objectContaining({ documentFingerprint: `sha256:${'b'.repeat(64)}` }),
    });
  });

  it('uses white-label delivery for Max and Team report entitlements', async () => {
    for (const plan of ['max', 'team'] as const) {
      jest.clearAllMocks();
      mockResolveUserPlan.mockResolvedValue({ plan, expired: false });
      mockReportFindOne.mockResolvedValue(report());
      mockAuditCreate.mockImplementation(async (input) => input);
      mockDeliveryCreate.mockImplementation(async (input) => input);
      const renderer = jest.fn(async (_report, options) => artifact(options.branding));
      const { service } = createService(renderer);

      const result = await service.deliverProjectReportPdf(
        project.projectId,
        'rpt_project_123456',
        project.ownerId
      );

      expect(renderer).toHaveBeenCalledWith(expect.anything(), {
        branding: 'white_label',
        generatedAt: new Date('2026-07-23T02:00:00.000Z'),
      });
      expect(result.delivery.branding).toBe('white_label');
    }
  });

  it('fails closed and records a safe failed audit when PDF rendering fails', async () => {
    const renderer = jest.fn(async (_report: any, _options: any): Promise<any> => {
      throw new Error('browser path C:/secret/chrome failed');
    });
    const { service } = createService(renderer);

    await expect(
      service.deliverProjectReportPdf(project.projectId, 'rpt_project_123456', project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_REPORT_PDF_UNAVAILABLE',
    });
    expect(mockDeliveryCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditCreate.mock.calls[1][0]).toMatchObject({
      action: 'report_download',
      outcome: 'failed',
      errorCode: 'PROJECT_GRADE_REPORT_PDF_UNAVAILABLE',
    });
    expect(JSON.stringify(mockAuditCreate.mock.calls[1][0])).not.toContain('C:/secret');
  });

  it('does not start the renderer when the attempted download audit cannot be persisted', async () => {
    const { service, renderer } = createService();
    mockAuditCreate.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.deliverProjectReportPdf(project.projectId, 'rpt_project_123456', project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
    });
    expect(renderer).not.toHaveBeenCalled();
    expect(mockDeliveryCreate).not.toHaveBeenCalled();
  });

  it('lists delivery records only after admin authorization and clamps the limit', async () => {
    const stored = {
      deliveryId: 'delivery-123456',
      reportId: 'report-123456',
      publicId: 'rpt_project_123456',
      projectId: project.projectId,
      requestedBy: project.ownerId,
      format: 'pdf',
      planId: 'pro',
      branding: 'aibak',
      contentFingerprint: `sha256:${'a'.repeat(64)}`,
      documentFingerprint: `sha256:${'b'.repeat(64)}`,
      fileName: 'report.pdf',
      byteLength: 1024,
      reportPublishedAt: new Date('2026-07-22T00:00:00.000Z'),
      reportExpiresAt: new Date('2026-08-22T00:00:00.000Z'),
      deliveredAt: new Date('2026-07-23T02:00:00.000Z'),
    };
    const limit = jest.fn().mockResolvedValue([stored]);
    const sort = jest.fn().mockReturnValue({ limit });
    mockDeliveryFind.mockReturnValue({ sort });
    const { service, projectAccess } = createService();

    const deliveries = await service.listProjectReportDeliveries(
      project.projectId,
      'rpt_project_123456',
      project.ownerId,
      999
    );

    expect(projectAccess).toHaveBeenCalledWith(project.projectId, project.ownerId, 'admin');
    expect(limit).toHaveBeenCalledWith(100);
    expect(deliveries).toEqual([stored]);
  });
});
