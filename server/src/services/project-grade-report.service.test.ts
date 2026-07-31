const mockResolveUserPlan = jest.fn();
const mockReportFind = jest.fn();
const mockReportFindOne = jest.fn();
const mockReportCreate = jest.fn();
const mockEvaluationFindOne = jest.fn();
const mockSnapshotFind = jest.fn();
const mockFindingFind = jest.fn();
const mockAuditCreate = jest.fn();

jest.mock('../middleware/subscription', () => ({
  resolveUserPlan: mockResolveUserPlan,
}));

jest.mock('../models/ProjectGradeReport', () => ({
  ProjectGradeReport: {
    find: mockReportFind,
    findOne: mockReportFindOne,
    create: mockReportCreate,
  },
}));

jest.mock('../models/EvaluationRun', () => ({
  EvaluationRun: {
    findOne: mockEvaluationFindOne,
  },
}));

jest.mock('../models/ProjectGradeScoreSnapshot', () => ({
  ProjectGradeScoreSnapshot: {
    find: mockSnapshotFind,
  },
}));

jest.mock('../models/ProjectGradeFinding', () => ({
  ProjectGradeFinding: {
    find: mockFindingFind,
  },
}));

jest.mock('../models/ProjectGradeAuditLog', () => ({
  ProjectGradeAuditLog: {
    create: mockAuditCreate,
  },
}));

import { PLANS } from '../config/billing';
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

const run = {
  runId: 'run-123456',
  projectId: project.projectId,
  ownerId: project.ownerId,
  teamId: undefined,
  projectionStatus: 'ready',
  evaluationInputKind: 'baseline',
  projectType: 'ai_application',
  grade: 'A',
  normalizedScore: 88.5,
  finalTotalScore: 885,
  releaseGate: {
    status: 'PASS',
    highestSeverity: 'NONE',
    scoreCap: 1000,
    blockedForRelease: false,
    blockedForPaidSale: false,
    reasons: [],
  },
};

const snapshots = [
  {
    dimensionKey: 'security',
    label: '安全',
    weight: 400,
    rawScore: 350,
    normalizedScore: 87.5,
  },
  {
    dimensionKey: 'product_strategy',
    label: '产品策略',
    weight: 600,
    rawScore: 535,
    normalizedScore: 89.2,
  },
];

const findings = [
  { severity: 'P3', dimensionKey: 'zeta', title: 'P3 issue' },
  { severity: 'P1', dimensionKey: 'beta', title: 'P1 beta' },
  { severity: 'P2', dimensionKey: 'gamma', title: 'P2 issue' },
  { severity: 'P0', dimensionKey: 'omega', title: 'P0 omega' },
  { severity: 'P1', dimensionKey: 'alpha', title: 'P1 alpha' },
  { severity: 'P0', dimensionKey: 'alpha', title: 'P0 alpha' },
];

function createReportDocument(input: Record<string, any>) {
  const document: Record<string, any> = { ...input };
  document.save = jest.fn(async () => document);
  return document;
}

function createService() {
  const service = new ProjectGradeService(
    process.cwd(),
    { scanRegisteredUrl: jest.fn() } as any,
    { scan: jest.fn() } as any
  );
  const projectAccess = jest
    .spyOn(service, 'getProjectForUser')
    .mockResolvedValue(project as any);
  return { service, projectAccess };
}

function mockReadyProjection() {
  mockEvaluationFindOne.mockResolvedValue(run);
  mockSnapshotFind.mockReturnValue({
    sort: jest.fn().mockResolvedValue(snapshots),
  });
  mockFindingFind.mockResolvedValue(findings);
}

function expectAppError(error: unknown, statusCode: number, code: string) {
  expect(error).toBeInstanceOf(AppError);
  expect(error).toMatchObject({ statusCode, code });
}

describe('ProjectGrade formal report lifecycle service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-23T02:00:00.000Z'));
    mockResolveUserPlan.mockResolvedValue({ plan: 'pro', expired: false });
    mockReportFindOne.mockResolvedValue(null);
    mockReadyProjection();
    mockAuditCreate.mockImplementation(async (input) => input);
    mockReportCreate.mockImplementation(async (input) => createReportDocument(input));
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('lists reports only after viewer authorization and clamps the service limit', async () => {
    const { service, projectAccess } = createService();
    const report = createReportDocument({
      reportId: 'report-123456',
      publicId: 'rpt_project_123456',
      runId: run.runId,
      projectId: project.projectId,
      title: 'Existing report',
      projectName: project.name,
      projectKind: 'ai_application',
      verdict: 'A',
      externalScore: 88.5,
      internalScore: 885,
      gateBlocked: null,
      isPublic: true,
      publishedAt: new Date('2026-07-22T00:00:00.000Z'),
      expiresAt: new Date('2026-08-21T00:00:00.000Z'),
      sharedCount: 0,
    });
    const limit = jest.fn().mockResolvedValue([report]);
    const sort = jest.fn().mockReturnValue({ limit });
    mockReportFind.mockReturnValue({ sort });

    const result = await service.listProjectReports(project.projectId, 'member-1234', 500);

    expect(projectAccess).toHaveBeenCalledWith(project.projectId, 'member-1234', 'viewer');
    expect(mockReportFind).toHaveBeenCalledWith({
      projectId: project.projectId,
      ownerUserId: project.ownerId,
      tenantId: project.ownerId,
    });
    expect(sort).toHaveBeenCalledWith({ publishedAt: -1 });
    expect(limit).toHaveBeenCalledWith(100);
    expect(result[0]).toMatchObject({ publicId: report.publicId, isPublic: true });
  });

  it('fails before entitlement and persistence work when admin authorization is denied', async () => {
    const { service, projectAccess } = createService();
    projectAccess.mockRejectedValue(
      new AppError(403, 'Project administrator permission required', 'PROJECT_GRADE_PROJECT_FORBIDDEN')
    );

    const pending = service.publishProjectReport(project.projectId, run.runId, 'member-1234');
    await expect(pending).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_PROJECT_FORBIDDEN',
    });
    expect(projectAccess).toHaveBeenCalledWith(project.projectId, 'member-1234', 'admin');
    expect(mockResolveUserPlan).not.toHaveBeenCalled();
    expect(mockReportFindOne).not.toHaveBeenCalled();
  });

  it('rejects a plan without formal report publication entitlement', async () => {
    const { service } = createService();
    mockResolveUserPlan.mockResolvedValue({ plan: 'free', expired: false });

    await expect(
      service.publishProjectReport(project.projectId, run.runId, project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 402,
      code: 'PROJECT_GRADE_REPORT_PUBLISH_PLAN_REQUIRED',
    });
    expect(mockReportFindOne).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('requires a ready server-side evaluation projection', async () => {
    const { service } = createService();
    mockEvaluationFindOne.mockResolvedValue(null);

    await expect(
      service.publishProjectReport(project.projectId, run.runId, project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_GRADE_REPORT_RUN_NOT_READY',
    });
    expect(mockReportCreate).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('publishes only server projections with plan validity, sorted findings, null NONE gate and audit events', async () => {
    const { service, projectAccess } = createService();

    const result = await service.publishProjectReport(
      project.projectId,
      run.runId,
      project.ownerId,
      {
        title: ' Customer-ready report ',
        externalScore: 100,
        dimensionSnapshot: [{ dimensionKey: 'client', normalizedScore: 100 }],
        findingHighlights: [],
      } as any
    );

    expect(projectAccess).toHaveBeenCalledWith(project.projectId, project.ownerId, 'admin');
    expect(mockReportCreate).toHaveBeenCalledTimes(1);
    const created = mockReportCreate.mock.calls[0][0];
    expect(created).toMatchObject({
      runId: run.runId,
      projectId: project.projectId,
      tenantId: project.ownerId,
      ownerUserId: project.ownerId,
      publicationVersion: 1,
      title: 'Customer-ready report',
      projectName: project.name,
      projectKind: 'ai_application',
      verdict: run.grade,
      externalScore: run.normalizedScore,
      internalScore: run.finalTotalScore,
      gateBlocked: null,
      isPublic: true,
      publishedBy: project.ownerId,
      sharedCount: 0,
      immutable: true,
    });
    expect(created.dimensionSnapshot).toEqual([
      expect.objectContaining({ dimensionKey: 'product_strategy', normalizedScore: 89.2 }),
      expect.objectContaining({ dimensionKey: 'security', normalizedScore: 87.5 }),
    ]);
    expect(created.findingHighlights).toEqual([
      expect.objectContaining({ severity: 'P0', dimensionKey: 'alpha' }),
      expect.objectContaining({ severity: 'P0', dimensionKey: 'omega' }),
      expect.objectContaining({ severity: 'P1', dimensionKey: 'alpha' }),
      expect.objectContaining({ severity: 'P1', dimensionKey: 'beta' }),
      expect.objectContaining({ severity: 'P2', dimensionKey: 'gamma' }),
    ]);
    expect(created.contentFingerprint).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(created.expiresAt.getTime() - created.publishedAt.getTime()).toBe(
      PLANS.pro.projectGrade.reportValidityDays * 24 * 60 * 60 * 1000
    );
    expect(result).toMatchObject({
      publicId: created.publicId,
      externalScore: run.normalizedScore,
      internalScore: run.finalTotalScore,
      gateBlocked: null,
      contentFingerprint: created.contentFingerprint,
    });
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditCreate.mock.calls[0][0]).toMatchObject({
      action: 'report_publish',
      outcome: 'attempted',
      targetType: 'report',
      fromStatus: 'unpublished',
      toStatus: 'public',
      metadata: {
        runId: run.runId,
        plan: 'pro',
        reportValidityDays: PLANS.pro.projectGrade.reportValidityDays,
        contentFingerprint: created.contentFingerprint,
      },
    });
    expect(mockAuditCreate.mock.calls[1][0]).toMatchObject({
      action: 'report_publish',
      outcome: 'succeeded',
      metadata: expect.objectContaining({ publicId: created.publicId }),
    });
  });

  it('rejects a duplicate active public report before reading the evaluation projection', async () => {
    const { service } = createService();
    mockReportFindOne.mockResolvedValue(
      createReportDocument({
        isPublic: true,
        expiresAt: new Date('2026-08-01T00:00:00.000Z'),
      })
    );

    await expect(
      service.publishProjectReport(project.projectId, run.runId, project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_REPORT_ALREADY_PUBLISHED',
    });
    expect(mockEvaluationFindOne).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('reuses publicId and immutable content when a revoked report is republished', async () => {
    const { service } = createService();
    let createdDocument: Record<string, any> | undefined;
    mockReportCreate.mockImplementationOnce(async (input) => {
      createdDocument = createReportDocument(input);
      return createdDocument;
    });

    const first = await service.publishProjectReport(
      project.projectId,
      run.runId,
      project.ownerId
    );
    expect(createdDocument).toBeDefined();
    const immutableBefore = {
      publicId: createdDocument!.publicId,
      contentFingerprint: createdDocument!.contentFingerprint,
      title: createdDocument!.title,
      dimensionSnapshot: createdDocument!.dimensionSnapshot,
      findingHighlights: createdDocument!.findingHighlights,
    };

    createdDocument!.isPublic = false;
    createdDocument!.revokedAt = new Date('2026-07-23T03:00:00.000Z');
    createdDocument!.revokedBy = 'admin-previous';
    createdDocument!.revocationReason = 'temporary correction';
    mockReportFindOne.mockResolvedValueOnce(createdDocument);
    jest.setSystemTime(new Date('2026-07-24T02:00:00.000Z'));

    const second = await service.publishProjectReport(
      project.projectId,
      run.runId,
      project.ownerId,
      { title: 'attempted replacement title' }
    );

    expect(mockReportCreate).toHaveBeenCalledTimes(1);
    expect(createdDocument!.save).toHaveBeenCalledTimes(1);
    expect(second.publicId).toBe(first.publicId);
    expect(second).toMatchObject({ isPublic: true, revokedAt: undefined, revokedBy: undefined });
    expect({
      publicId: createdDocument!.publicId,
      contentFingerprint: createdDocument!.contentFingerprint,
      title: createdDocument!.title,
      dimensionSnapshot: createdDocument!.dimensionSnapshot,
      findingHighlights: createdDocument!.findingHighlights,
    }).toEqual(immutableBefore);
    expect(createdDocument!.expiresAt.getTime() - createdDocument!.publishedAt.getTime()).toBe(
      PLANS.pro.projectGrade.reportValidityDays * 24 * 60 * 60 * 1000
    );
    expect(mockAuditCreate.mock.calls[2][0]).toMatchObject({
      action: 'report_publish',
      outcome: 'attempted',
      targetId: first.publicId,
      fromStatus: 'revoked',
    });
  });

  it('rejects republishing when the immutable projection fingerprint changed', async () => {
    const { service } = createService();
    const existing = createReportDocument({
      reportId: 'report-123456',
      publicId: 'rpt_project_123456',
      runId: run.runId,
      projectId: project.projectId,
      publicationVersion: 1,
      contentFingerprint: `sha256:${'b'.repeat(64)}`,
      title: `${project.name} · AIbak 智评通正式评估报告`,
      projectName: project.name,
      projectKind: 'ai_application',
      verdict: run.grade,
      externalScore: run.normalizedScore,
      internalScore: run.finalTotalScore,
      gateBlocked: null,
      dimensionSnapshot: snapshots,
      findingHighlights: findings.slice(0, 5),
      isPublic: false,
      expiresAt: new Date('2026-07-22T00:00:00.000Z'),
      sharedCount: 0,
    });
    mockReportFindOne.mockResolvedValue(existing);

    await expect(
      service.publishProjectReport(project.projectId, run.runId, project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_REPORT_CONTENT_MISMATCH',
    });
    expect(existing.save).not.toHaveBeenCalled();
    expect(mockAuditCreate).not.toHaveBeenCalled();
  });

  it('maps duplicate-key publication races to a stable conflict and records a failed audit event', async () => {
    const { service } = createService();
    mockReportCreate.mockRejectedValue({ code: 11000 });

    let error: unknown;
    try {
      await service.publishProjectReport(project.projectId, run.runId, project.ownerId);
    } catch (caught) {
      error = caught;
    }

    expectAppError(error, 409, 'PROJECT_GRADE_REPORT_ALREADY_EXISTS');
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditCreate.mock.calls[1][0]).toMatchObject({
      action: 'report_publish',
      outcome: 'failed',
      errorCode: 'PROJECT_GRADE_REPORT_ALREADY_EXISTS',
    });
  });

  it('fails closed when the attempted audit event cannot be written', async () => {
    const { service } = createService();
    mockAuditCreate.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.publishProjectReport(project.projectId, run.runId, project.ownerId)
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
    });
    expect(mockReportCreate).not.toHaveBeenCalled();
  });

  it('revokes public access without deleting immutable report content and writes attempted/succeeded audit events', async () => {
    const { service, projectAccess } = createService();
    const report = createReportDocument({
      reportId: 'report-123456',
      publicId: 'rpt_project_123456',
      runId: run.runId,
      projectId: project.projectId,
      title: 'Existing report',
      projectName: project.name,
      projectKind: 'ai_application',
      verdict: 'A',
      externalScore: 88.5,
      internalScore: 885,
      gateBlocked: null,
      isPublic: true,
      publishedAt: new Date('2026-07-22T00:00:00.000Z'),
      expiresAt: new Date('2026-08-21T00:00:00.000Z'),
      sharedCount: 0,
      contentFingerprint: `sha256:${'a'.repeat(64)}`,
    });
    mockReportFindOne.mockResolvedValue(report);

    const result = await service.revokeProjectReport(
      project.projectId,
      report.publicId,
      project.ownerId,
      'customer requested correction'
    );

    expect(projectAccess).toHaveBeenCalledWith(project.projectId, project.ownerId, 'admin');
    expect(report.save).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      publicId: report.publicId,
      isPublic: false,
      revokedBy: project.ownerId,
      revocationReason: 'customer requested correction',
      contentFingerprint: report.contentFingerprint,
    });
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    expect(mockAuditCreate.mock.calls[0][0]).toMatchObject({
      action: 'report_revoke',
      outcome: 'attempted',
      targetType: 'report',
      targetId: report.publicId,
      fromStatus: 'public',
      toStatus: 'revoked',
      reason: 'customer requested correction',
    });
    expect(mockAuditCreate.mock.calls[1][0]).toMatchObject({
      action: 'report_revoke',
      outcome: 'succeeded',
      metadata: expect.objectContaining({ reportId: report.reportId }),
    });
  });

  it('does not execute revocation when the attempted audit event fails', async () => {
    const { service } = createService();
    const report = createReportDocument({
      reportId: 'report-123456',
      publicId: 'rpt_project_123456',
      runId: run.runId,
      projectId: project.projectId,
      isPublic: true,
      contentFingerprint: `sha256:${'a'.repeat(64)}`,
    });
    mockReportFindOne.mockResolvedValue(report);
    mockAuditCreate.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.revokeProjectReport(
        project.projectId,
        report.publicId,
        project.ownerId,
        'customer requested correction'
      )
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
    });
    expect(report.save).not.toHaveBeenCalled();
    expect(report.isPublic).toBe(true);
  });

  it('produces a stable fingerprint independent of dimension and finding input order', () => {
    const { service } = createService();
    const base = {
      publicationVersion: 1,
      runId: run.runId,
      projectId: project.projectId,
      projectName: project.name,
      projectKind: 'ai_application',
      title: 'Stable report',
      verdict: 'A',
      externalScore: 88.5,
      internalScore: 885,
      gateBlocked: null,
      dimensionSnapshot: snapshots,
      findingHighlights: findings.slice(0, 5),
    };

    const first = (service as any).computeProjectGradeReportFingerprint(base);
    const second = (service as any).computeProjectGradeReportFingerprint({
      ...base,
      dimensionSnapshot: [...base.dimensionSnapshot].reverse(),
      findingHighlights: [...base.findingHighlights].reverse(),
    });

    expect(first).toBe(second);
    expect(first).toMatch(/^sha256:[a-f0-9]{64}$/);
  });
});
