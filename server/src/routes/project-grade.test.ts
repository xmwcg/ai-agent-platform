import request from 'supertest';
import { AppError } from '../lib/http-error';

const mockRun = {
  runId: 'run-123456',
  projectName: 'AIbak baseline',
  projectType: 'ai_application',
  rulePackKey: 'aibak-projectgrade-core',
  rulePackVersion: '0.1.0',
  assessedAt: '2026-07-20T00:00:00.000Z',
  rawTotalScore: 100,
  finalTotalScore: 100,
  normalizedScore: 10,
  grade: 'F',
  releaseGate: {
    status: 'BLOCKED',
    highestSeverity: 'P1',
    scoreCap: 590,
    blockedForRelease: true,
    blockedForPaidSale: true,
    reasons: ['production evidence missing'],
  },
  snapshots: [],
  evidence: [],
  findings: [],
  productionVerified: false,
  summary: 'local repository evidence only',
};

const mockUrlScan = {
  scanVersion: 'url-quick-scan/0.2.0',
  requestedUrl: 'https://example.com/',
  finalUrl: 'https://example.com/',
  statusCode: 200,
  contentType: 'text/html; charset=utf-8',
  responseBytes: 1024,
  durationMs: 85,
  redirectChain: [],
  checks: [],
  metadata: { h1Count: 1 },
  staticSignals: {
    charset: 'utf-8',
    robots: 'index,follow',
    noindex: false,
    openGraphTitle: 'Example',
    openGraphDescription: 'Example description',
    images: { total: 1, missingAlt: 0 },
    buttons: { total: 1, missingAccessibleName: 0 },
    formControls: { total: 1, missingAccessibleName: 0 },
  },
  links: { total: 0, empty: 0, invalid: 0, internal: 0, external: 0 },
  securityHeaders: { present: [], missing: [] },
  evidenceScope: 'single_server_http_observation',
  productionAcceptance: false,
  note: 'single server observation only',
};

const mockProject = {
  projectId: 'project-1234',
  ownerId: 'owner-1234',
  name: 'Persisted project',
  projectType: 'ai_application',
  status: 'active',
};

const mockTarget = {
  targetId: 'target-1234',
  projectId: 'project-1234',
  kind: 'internal_repository',
  scopeKey: 'aibak_server_repository',
  status: 'active',
};

const mockGetRules = jest.fn(() => [
  {
    key: 'product_strategy.baseline',
    dimensionKey: 'product_strategy',
    weight: 60,
  },
]);
const mockNormalizeProjectType = jest.fn((value: string) => {
  if (['website', 'saas', 'ai_application'].includes(value)) return value;
  throw new Error('unsupported');
});
const mockCreateBaselineEvaluationRun = jest.fn(async () => mockRun);
const mockSyncDefaultRulePack = jest.fn(async () => ({
  rulePackKey: 'aibak-projectgrade-core',
  rulePackVersion: '0.1.0',
  rules: 12,
  matched: 0,
  modified: 0,
  upserted: 12,
}));
const mockCreateProject = jest.fn(async () => ({ project: mockProject, target: mockTarget }));
const mockListProjects = jest.fn(async () => [mockProject]);
const mockGetProjectForUser = jest.fn(async () => mockProject);
const mockRunProjectEvaluation = jest.fn(async () => mockRun);
const mockRunProjectUrlQuickScan = jest.fn(async () => mockUrlScan);
const mockUrlScanHistory = [
  {
    scanId: 'scan-123456',
    projectId: 'project-1234',
    status: 'succeeded',
    requestedUrl: 'https://example.com/',
    finalUrl: 'https://example.com/',
    scanVersion: 'url-quick-scan/0.2.0',
    statusCode: 200,
    durationMs: 85,
    evidenceScope: 'single_server_http_observation',
    productionAcceptance: false,
    createdAt: '2026-07-20T12:00:00.000Z',
  },
];
const mockListProjectUrlScanRuns = jest.fn(async () => mockUrlScanHistory);
const mockSourceScan = {
  scanId: 'source-scan-123456',
  projectId: 'project-1234',
  status: 'succeeded',
  rootKey: 'aibak_server_repository',
  scanVersion: 'source-snapshot/0.1.0',
  snapshotHash: `sha256:${'a'.repeat(64)}`,
  result: {
    scanVersion: 'source-snapshot/0.1.0',
    rootKey: 'aibak_server_repository',
    snapshotHash: `sha256:${'a'.repeat(64)}`,
    files: [],
    findings: [],
    routes: [],
    projectSignals: {
      hasTests: true,
      hasDocker: true,
      hasCi: true,
      hasLicense: true,
      hasPackageManifest: true,
    },
    summary: { filesScanned: 0, bytesScanned: 0, findings: 0, routes: 0 },
    skipped: {
      ignoredDirectories: 0,
      unsupportedExtensions: 0,
      binaryFiles: 0,
      symbolicLinks: 0,
    },
    limits: {
      maxFiles: 5000,
      maxFileBytes: 1048576,
      maxTotalBytes: 26214400,
      timeoutMs: 10000,
    },
    evidenceScope: 'authorized_local_source_snapshot',
    productionAcceptance: false,
    externalScanningEnabled: false,
    sourceContentPersisted: false,
    executedSourceCode: false,
    installedDependencies: false,
    networkAccessed: false,
  },
  evidenceScope: 'authorized_local_source_snapshot',
  productionAcceptance: false,
  createdAt: '2026-07-21T10:00:00.000Z',
};
const mockSourceScanHistory = [mockSourceScan];
const mockRunProjectSourceScan = jest.fn(async () => mockSourceScan);
const mockListProjectSourceScanRuns = jest.fn(async () => mockSourceScanHistory);
const mockEvidenceAdoption = {
  adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
  projectId: 'project-1234',
  targetId: 'target-1234',
  sourceScanId: 'source-scan-123456',
  draftSetHash: `sha256:${'f'.repeat(64)}`,
  adoptionVersion: 1,
  draftCount: 1,
  scoringDisposition: 'adopted_pending_evaluation',
  productionAcceptance: false,
  externalScanningEnabled: false,
};
const mockSourceEvidenceDraftPreview = {
  sourceScanId: 'source-scan-123456',
  sourceScanVersion: 'source-snapshot/0.1.0',
  snapshotHash: `sha256:${'a'.repeat(64)}`,
  draftSetHash: `sha256:${'f'.repeat(64)}`,
  projectionVersion: 1,
  scoringDisposition: 'draft_only_not_adopted',
  evidenceScope: 'authorized_local_source_snapshot',
  productionAcceptance: false,
  externalScanningEnabled: false,
  sourceContentPersisted: false,
  drafts: [],
};
const mockGetProjectSourceEvidenceDraftPreview = jest.fn(
  async () => mockSourceEvidenceDraftPreview
);
const mockListProjectSourceEvidenceAdoptions = jest.fn(async () => [mockEvidenceAdoption]);
const mockAdoptProjectSourceScanEvidence = jest.fn(async () => mockEvidenceAdoption);
const mockRunProjectEvaluationFromSourceEvidence = jest.fn(async () => mockRun);
const mockListProjectEvaluationRuns = jest.fn(async () => [mockRun]);
const mockGetEvaluationRunForUser = jest.fn(async () => mockRun);
const mockReport = {
  reportId: 'report-123456',
  publicId: 'rpt_project_123456',
  runId: 'run-123456',
  projectId: 'project-1234',
  title: 'AIbak 智评通正式报告',
  projectName: 'Persisted project',
  projectKind: 'ai_application',
  verdict: 'A',
  externalScore: 88.5,
  internalScore: 885,
  gateBlocked: null,
  isPublic: true,
  publishedAt: '2026-07-22T00:00:00.000Z',
  expiresAt: '2026-08-21T00:00:00.000Z',
  sharedCount: 0,
  contentFingerprint: `sha256:${'a'.repeat(64)}`,
};
const mockListProjectReports = jest.fn(async () => [mockReport]);
const mockPublishProjectReport = jest.fn(async () => mockReport);
const mockRevokeProjectReport = jest.fn(async () => ({
  ...mockReport,
  isPublic: false,
  revokedAt: '2026-07-22T01:00:00.000Z',
  revocationReason: 'customer requested correction',
}));
const mockReportDelivery = {
  deliveryId: 'delivery-123456',
  reportId: mockReport.reportId,
  publicId: mockReport.publicId,
  projectId: mockReport.projectId,
  requestedBy: 'member-1234',
  format: 'pdf',
  planId: 'pro',
  branding: 'aibak',
  contentFingerprint: mockReport.contentFingerprint,
  documentFingerprint: `sha256:${'b'.repeat(64)}`,
  fileName: 'Persisted-project-rpt_project_123456.pdf',
  byteLength: 15,
  reportPublishedAt: mockReport.publishedAt,
  reportExpiresAt: mockReport.expiresAt,
  deliveredAt: '2026-07-23T02:00:00.000Z',
};
const mockListProjectReportDeliveries = jest.fn(async () => [mockReportDelivery]);
const mockDeliverProjectReportPdf = jest.fn(async () => ({
  artifact: {
    buffer: Buffer.from('%PDF-1.7 test'),
    documentFingerprint: mockReportDelivery.documentFingerprint,
    byteLength: 15,
    fileName: mockReportDelivery.fileName,
    generatedAt: new Date(mockReportDelivery.deliveredAt),
    branding: 'aibak',
  },
  delivery: mockReportDelivery,
}));
const mockEvidence = { evidenceId: 'evidence-1234', projectId: 'project-1234' };
const mockFinding = {
  findingId: 'finding-1234',
  projectId: 'project-1234',
  currentStatus: 'open',
};
const mockTask = {
  taskId: 'task-123456',
  projectId: 'project-1234',
  status: 'open',
};
const mockListProjectEvidence = jest.fn(async () => [mockEvidence]);
const mockListProjectFindings = jest.fn(async () => [mockFinding]);
const mockUpdateFindingWorkflow = jest.fn(async () => mockFinding);
const mockListProjectRemediations = jest.fn(async () => [mockTask]);
const mockCreateRemediationTask = jest.fn(async () => mockTask);
const mockUpdateRemediationTask = jest.fn(async () => mockTask);
const mockRebuildEvaluationProjection = jest.fn(async () => mockRun);
const mockAuditEvent = {
  auditId: 'audit-1234',
  operationId: 'operation-1234',
  outcome: 'succeeded',
};
const mockListProjectAudit = jest.fn(async () => [mockAuditEvent]);

const mockRequireAuth = jest.fn((req: any, res: any, next: any) => {
  const userId = req.header('x-test-user');
  if (!userId) {
    res.status(401).json({ success: false, error: 'test authentication required' });
    return;
  }
  req.user = {
    id: userId,
    email: `${userId}@example.test`,
    role: req.header('x-test-role') || 'user',
  };
  next();
});

const mockOptionalAuth = jest.fn((req: any, _res: any, next: any) => {
  const userId = req.header('x-test-user');
  if (userId) {
    req.user = {
      id: userId,
      email: `${userId}@example.test`,
      role: req.header('x-test-role') || 'user',
    };
  }
  next();
});

const mockProjectGradeCapacity = jest.fn((_req: any, _res: any, next: any) => next());
const mockProjectGradeDailyQuota = jest.fn((_req: any, _res: any, next: any) => next());
const mockProjectGradeQuotaResourceUse = jest.fn();
const mockEnforceProjectGradeDailyQuota = jest.fn(
  (resource: string) => (req: any, res: any, next: any) => {
    mockProjectGradeQuotaResourceUse(resource);
    return mockProjectGradeDailyQuota(req, res, next);
  }
);
const mockGetProjectGradeEntitlementSnapshot = jest.fn(async () => ({
  plan: { id: 'free', name: '免费版', expired: false, upgradeUrl: '/pricing' },
  projects: { used: 1, limit: 1, remaining: 0 },
  daily: {},
  capabilities: {
    reportPublishEnabled: false,
    reportDownloadEnabled: false,
    reportValidityDays: 0,
    removeAibakBranding: false,
  },
  accounting: { timezone: 'UTC', resetsAt: '2026-07-23T00:00:00.000Z' },
}));

jest.mock('../middleware/project-grade-subscription', () => ({
  enforceProjectGradeProjectCapacity: mockProjectGradeCapacity,
  enforceProjectGradeDailyQuota: mockEnforceProjectGradeDailyQuota,
  getProjectGradeEntitlementSnapshot: mockGetProjectGradeEntitlementSnapshot,
}));

const mockRequireAdmin = jest.fn((req: any, res: any, next: any) => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ success: false, error: 'admin required' });
    return;
  }
  next();
});

jest.mock('../middleware/auth', () => ({
  requireAuth: mockRequireAuth,
  optionalAuth: mockOptionalAuth,
  requireAdmin: mockRequireAdmin,
}));

jest.mock('../services/project-grade.service', () => ({
  projectGradeService: {
    getRules: mockGetRules,
    normalizeProjectType: mockNormalizeProjectType,
    createBaselineEvaluationRun: mockCreateBaselineEvaluationRun,
    syncDefaultRulePack: mockSyncDefaultRulePack,
    createProject: mockCreateProject,
    listProjects: mockListProjects,
    getProjectForUser: mockGetProjectForUser,
    runProjectEvaluation: mockRunProjectEvaluation,
    runProjectUrlQuickScan: mockRunProjectUrlQuickScan,
    listProjectUrlScanRuns: mockListProjectUrlScanRuns,
    runProjectSourceScan: mockRunProjectSourceScan,
    listProjectSourceScanRuns: mockListProjectSourceScanRuns,
    getProjectSourceEvidenceDraftPreview: mockGetProjectSourceEvidenceDraftPreview,
    listProjectSourceEvidenceAdoptions: mockListProjectSourceEvidenceAdoptions,
    adoptProjectSourceScanEvidence: mockAdoptProjectSourceScanEvidence,
    runProjectEvaluationFromSourceEvidence: mockRunProjectEvaluationFromSourceEvidence,
    listProjectEvaluationRuns: mockListProjectEvaluationRuns,
    getEvaluationRunForUser: mockGetEvaluationRunForUser,
    listProjectReports: mockListProjectReports,
    listProjectReportDeliveries: mockListProjectReportDeliveries,
    deliverProjectReportPdf: mockDeliverProjectReportPdf,
    publishProjectReport: mockPublishProjectReport,
    revokeProjectReport: mockRevokeProjectReport,
    listProjectEvidence: mockListProjectEvidence,
    listProjectFindings: mockListProjectFindings,
    updateFindingWorkflow: mockUpdateFindingWorkflow,
    listProjectRemediations: mockListProjectRemediations,
    createRemediationTask: mockCreateRemediationTask,
    updateRemediationTask: mockUpdateRemediationTask,
    rebuildEvaluationProjection: mockRebuildEvaluationProjection,
    listProjectAudit: mockListProjectAudit,
  },
}));

import app from '../index';

describe('ProjectGrade Batch 0, Batch 1 and Batch 2 routes mounted in the application', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRules.mockReturnValue([
      {
        key: 'product_strategy.baseline',
        dimensionKey: 'product_strategy',
        weight: 60,
      },
    ]);
    mockNormalizeProjectType.mockImplementation((value: string) => {
      if (['website', 'saas', 'ai_application'].includes(value)) return value;
      throw new Error('unsupported');
    });
    mockCreateBaselineEvaluationRun.mockResolvedValue(mockRun);
    mockSyncDefaultRulePack.mockResolvedValue({
      rulePackKey: 'aibak-projectgrade-core',
      rulePackVersion: '0.1.0',
      rules: 12,
      matched: 0,
      modified: 0,
      upserted: 12,
    });
    mockCreateProject.mockResolvedValue({ project: mockProject, target: mockTarget });
    mockListProjects.mockResolvedValue([mockProject]);
    mockGetProjectForUser.mockResolvedValue(mockProject);
    mockRunProjectEvaluation.mockResolvedValue(mockRun);
    mockRunProjectUrlQuickScan.mockResolvedValue(mockUrlScan);
    mockListProjectUrlScanRuns.mockResolvedValue(mockUrlScanHistory);
    mockRunProjectSourceScan.mockResolvedValue(mockSourceScan);
    mockListProjectSourceScanRuns.mockResolvedValue(mockSourceScanHistory);
    mockGetProjectSourceEvidenceDraftPreview.mockResolvedValue(mockSourceEvidenceDraftPreview);
    mockListProjectSourceEvidenceAdoptions.mockResolvedValue([mockEvidenceAdoption]);
    mockAdoptProjectSourceScanEvidence.mockResolvedValue(mockEvidenceAdoption);
    mockListProjectEvaluationRuns.mockResolvedValue([mockRun]);
    mockGetEvaluationRunForUser.mockResolvedValue(mockRun);
    mockListProjectReports.mockResolvedValue([mockReport]);
    mockListProjectReportDeliveries.mockResolvedValue([mockReportDelivery]);
    mockDeliverProjectReportPdf.mockResolvedValue({
      artifact: {
        buffer: Buffer.from('%PDF-1.7 test'),
        documentFingerprint: mockReportDelivery.documentFingerprint,
        byteLength: 15,
        fileName: mockReportDelivery.fileName,
        generatedAt: new Date(mockReportDelivery.deliveredAt),
        branding: 'aibak',
      },
      delivery: mockReportDelivery,
    });
    mockPublishProjectReport.mockResolvedValue(mockReport);
    mockRevokeProjectReport.mockResolvedValue({
      ...mockReport,
      isPublic: false,
      revokedAt: '2026-07-22T01:00:00.000Z',
      revocationReason: 'customer requested correction',
    });
    mockListProjectEvidence.mockResolvedValue([mockEvidence]);
    mockListProjectFindings.mockResolvedValue([mockFinding]);
    mockUpdateFindingWorkflow.mockResolvedValue(mockFinding);
    mockListProjectRemediations.mockResolvedValue([mockTask]);
    mockCreateRemediationTask.mockResolvedValue(mockTask);
    mockUpdateRemediationTask.mockResolvedValue(mockTask);
    mockRebuildEvaluationProjection.mockResolvedValue(mockRun);
    mockListProjectAudit.mockResolvedValue([mockAuditEvent]);
  });

  it('returns the authenticated ProjectGrade entitlement snapshot', async () => {
    const response = await request(app)
      .get('/api/project-grade/entitlements')
      .set('x-test-user', 'owner-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.entitlements).toMatchObject({
      plan: { id: 'free', name: '免费版' },
      projects: { used: 1, limit: 1, remaining: 0 },
    });
    expect(mockGetProjectGradeEntitlementSnapshot).toHaveBeenCalledWith('owner-1234');
  });

  it('exposes scope limits without claiming production acceptance or external scanning', async () => {
    const response = await request(app).get('/api/project-grade');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      name: 'AIbak 智评通 ProjectGrade',
      batch: 0,
      supportedProjectTypes: ['website', 'saas', 'ai_application'],
      assessmentScope: { productionAcceptance: false },
      persistenceScope: {
        authenticatedOnly: true,
        immutableRunSnapshot: true,
        externalScanningEnabled: false,
      },
    });
  });

  it('returns the versioned rules collection', async () => {
    const response = await request(app).get('/api/project-grade/rules');

    expect(response.status).toBe(200);
    expect(response.body.data.rules).toHaveLength(1);
    expect(mockGetRules).toHaveBeenCalledTimes(1);
  });

  it('allows only an authenticated administrator to sync the default rule pack', async () => {
    const unauthenticated = await request(app).post('/api/project-grade/rules/sync');
    expect(unauthenticated.status).toBe(401);

    const nonAdmin = await request(app)
      .post('/api/project-grade/rules/sync')
      .set('x-test-user', 'member-1234');
    expect(nonAdmin.status).toBe(403);
    expect(mockSyncDefaultRulePack).not.toHaveBeenCalled();

    const admin = await request(app)
      .post('/api/project-grade/rules/sync')
      .set('x-test-user', 'admin-1234')
      .set('x-test-role', 'admin');
    expect(admin.status).toBe(200);
    expect(admin.body.data.productionAcceptance).toBe(false);
    expect(admin.body.data.result.rules).toBe(12);
    expect(mockSyncDefaultRulePack).toHaveBeenCalledTimes(1);
  });

  it('returns a temporary local-repository baseline without claiming production acceptance', async () => {
    const response = await request(app).get('/api/project-grade/baseline');

    expect(response.status).toBe(200);
    expect(response.body.data.run.productionVerified).toBe(false);
    expect(response.body.data.assessmentScope).toMatchObject({
      mode: 'aibak_repository_baseline',
      productionAcceptance: false,
    });
    expect(mockCreateBaselineEvaluationRun).toHaveBeenCalledWith();
  });

  it('validates required project metadata', async () => {
    const missingName = await request(app)
      .post('/api/project-grade/evaluate')
      .send({ projectType: 'ai_application' });
    expect(missingName.status).toBe(400);
    expect(missingName.body.code).toBe('PROJECT_GRADE_INVALID_PROJECT_NAME');

    const badUrl = await request(app)
      .post('/api/project-grade/evaluate')
      .send({ projectName: 'Demo', projectUrl: 'file:///etc/passwd' });
    expect(badUrl.status).toBe(400);
    expect(badUrl.body.code).toBe('PROJECT_GRADE_INVALID_PROJECT_URL');

    const credentialUrl = await request(app)
      .post('/api/project-grade/evaluate')
      .send({ projectName: 'Demo', projectUrl: 'https://user:secret@example.com/' });
    expect(credentialUrl.status).toBe(400);
    expect(credentialUrl.body.code).toBe('PROJECT_GRADE_INVALID_PROJECT_URL');
  });

  it('rejects project types outside the first supported set', async () => {
    const response = await request(app)
      .post('/api/project-grade/evaluate')
      .send({ projectName: 'API project', projectType: 'api_service' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('PROJECT_GRADE_UNSUPPORTED_PROJECT_TYPE');
    expect(mockCreateBaselineEvaluationRun).not.toHaveBeenCalled();
  });

  it('never persists an anonymous Batch 0 evaluation even when persist=true is submitted', async () => {
    const response = await request(app).post('/api/project-grade/evaluate').send({
      projectName: 'Anonymous project',
      projectType: 'saas',
      projectUrl: 'https://example.com/project',
      persist: true,
    });

    expect(response.status).toBe(200);
    expect(response.body.data.persisted).toBe(false);
    expect(response.body.data.assessmentScope.productionAcceptance).toBe(false);
    expect(mockCreateBaselineEvaluationRun).toHaveBeenCalledWith(
      'Anonymous project',
      'saas',
      'https://example.com/project'
    );
  });

  it('creates an authenticated project with the request user as immutable owner', async () => {
    const response = await request(app)
      .post('/api/project-grade/projects')
      .set('x-test-user', 'owner-1234')
      .send({
        projectName: ' Persisted project ',
        projectType: 'ai_application',
        description: ' Internal baseline ',
        projectUrl: 'https://example.com/app',
        teamId: 'team-1234',
      });

    expect(response.status).toBe(201);
    expect(response.body.data.persistenceScope.externalScanningEnabled).toBe(false);
    expect(mockCreateProject).toHaveBeenCalledWith({
      ownerId: 'owner-1234',
      teamId: 'team-1234',
      name: 'Persisted project',
      description: 'Internal baseline',
      projectType: 'ai_application',
      projectUrl: 'https://example.com/app',
    });
  });

  it('requires authentication and scans only the project registered URL', async () => {
    const unauthenticated = await request(app)
      .post('/api/project-grade/projects/project-1234/url-scan')
      .send({ projectUrl: 'http://127.0.0.1/admin' });

    expect(unauthenticated.status).toBe(401);
    expect(mockRunProjectUrlQuickScan).not.toHaveBeenCalled();

    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/url-scan')
      .set('x-test-user', 'member-1234')
      .send({ projectUrl: 'http://127.0.0.1/admin' });

    expect(response.status).toBe(200);
    expect(response.body.data.scan).toEqual(mockUrlScan);
    expect(response.body.data.persisted).toBe(true);
    expect(response.body.data.scope).toMatchObject({
      batch: 1,
      registeredProjectUrlOnly: true,
      externalScanningEnabled: true,
      productionAcceptance: false,
    });
    expect(mockRunProjectUrlQuickScan).toHaveBeenCalledWith('project-1234', 'member-1234');
    expect(mockRunProjectUrlQuickScan).toHaveBeenCalledTimes(1);
  });

  it('requires authentication and exposes viewer-readable URL scan history with bounded limits', async () => {
    const unauthenticated = await request(app).get(
      '/api/project-grade/projects/project-1234/url-scans?limit=20'
    );

    expect(unauthenticated.status).toBe(401);
    expect(mockListProjectUrlScanRuns).not.toHaveBeenCalled();

    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/url-scans?limit=20')
      .set('x-test-user', 'viewer-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.scans).toEqual(mockUrlScanHistory);
    expect(response.body.data.scope).toMatchObject({
      evidenceScope: 'single_server_http_observation',
      productionAcceptance: false,
    });
    expect(mockListProjectUrlScanRuns).toHaveBeenCalledWith('project-1234', 'viewer-1234', 20);

    const invalidLimit = await request(app)
      .get('/api/project-grade/projects/project-1234/url-scans?limit=51')
      .set('x-test-user', 'viewer-1234');
    expect(invalidLimit.status).toBe(400);
  });

  it('requires authentication and ignores all client path input for the authorized source scan', async () => {
    const maliciousBody = {
      rootKey: 'attacker-controlled-root',
      relativePath: '../../outside',
      absolutePath: 'C:\\private\\secrets',
    };
    const unauthenticated = await request(app)
      .post('/api/project-grade/projects/project-1234/source-scan')
      .send(maliciousBody);

    expect(unauthenticated.status).toBe(401);
    expect(mockRunProjectSourceScan).not.toHaveBeenCalled();

    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/source-scan')
      .set('x-test-user', 'admin-1234')
      .send(maliciousBody);

    expect(response.status).toBe(200);
    expect(response.body.data.scan).toEqual(mockSourceScan);
    expect(response.body.data).toMatchObject({
      persisted: true,
      scope: {
        batch: 2,
        serverRegisteredRootOnly: true,
        acceptedPathInput: false,
        evidenceScope: 'authorized_local_source_snapshot',
        productionAcceptance: false,
        externalScanningEnabled: false,
        sourceContentPersisted: false,
      },
    });
    expect(mockRunProjectSourceScan).toHaveBeenCalledTimes(1);
    expect(mockRunProjectSourceScan).toHaveBeenCalledWith('project-1234', 'admin-1234');
  });

  it('requires authentication and exposes viewer-readable source scan history with bounded limits', async () => {
    const unauthenticated = await request(app).get(
      '/api/project-grade/projects/project-1234/source-scans?limit=20'
    );

    expect(unauthenticated.status).toBe(401);
    expect(mockListProjectSourceScanRuns).not.toHaveBeenCalled();

    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/source-scans?limit=20')
      .set('x-test-user', 'viewer-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.scans).toEqual(mockSourceScanHistory);
    expect(response.body.data.scope).toMatchObject({
      evidenceScope: 'authorized_local_source_snapshot',
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
    });
    expect(mockListProjectSourceScanRuns).toHaveBeenCalledWith('project-1234', 'viewer-1234', 20);

    for (const limit of [0, 51]) {
      const invalidLimit = await request(app)
        .get(`/api/project-grade/projects/project-1234/source-scans?limit=${limit}`)
        .set('x-test-user', 'viewer-1234');
      expect(invalidLimit.status).toBe(400);
    }
  });

  it('returns source scan history persistence failures as a safe 503 response', async () => {
    mockRunProjectSourceScan.mockRejectedValueOnce(
      new AppError(
        503,
        'ProjectGrade 源码扫描历史暂不可用',
        'PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE'
      )
    );

    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/source-scan')
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: 'ProjectGrade 源码扫描历史暂不可用',
      code: 'PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE',
    });
  });

  it('returns the external scanning feature flag failure as a safe 503 response', async () => {
    mockRunProjectUrlQuickScan.mockRejectedValueOnce(
      new AppError(
        503,
        'ProjectGrade 网址快速体检当前未启用',
        'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED'
      )
    );

    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/url-scan')
      .set('x-test-user', 'member-1234');

    expect(response.status).toBe(503);
    expect(response.body).toMatchObject({
      success: false,
      error: 'ProjectGrade 网址快速体检当前未启用',
      code: 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED',
    });
  });

  it('exposes an authenticated admin draft preview with immutable non-production scope', async () => {
    const unauthenticated = await request(app).get(
      '/api/project-grade/projects/project-1234/source-scans/source-scan-123456/evidence-draft'
    );
    expect(unauthenticated.status).toBe(401);
    expect(mockGetProjectSourceEvidenceDraftPreview).not.toHaveBeenCalled();

    const response = await request(app)
      .get(
        '/api/project-grade/projects/project-1234/source-scans/source-scan-123456/evidence-draft'
      )
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.preview).toEqual(mockSourceEvidenceDraftPreview);
    expect(response.body.data.scope).toMatchObject({
      scoringDisposition: 'draft_only_not_adopted',
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
    });
    expect(mockGetProjectSourceEvidenceDraftPreview).toHaveBeenCalledWith(
      'project-1234',
      'admin-1234',
      'source-scan-123456'
    );
  });

  it('lists authenticated admin adoption manifests with bounded limits and no scoring claim', async () => {
    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/source-evidence-adoptions?limit=7')
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.adoptions).toEqual([mockEvidenceAdoption]);
    expect(response.body.data.scope).toMatchObject({
      scoringDisposition: 'adopted_pending_evaluation',
      evaluationRunCreated: false,
      productionAcceptance: false,
      externalScanningEnabled: false,
    });
    expect(mockListProjectSourceEvidenceAdoptions).toHaveBeenCalledWith(
      'project-1234',
      'admin-1234',
      7
    );
  });

  it('rejects malformed draft preview identifiers and adoption list limits before service access', async () => {
    const badScan = await request(app)
      .get('/api/project-grade/projects/project-1234/source-scans/bad/evidence-draft')
      .set('x-test-user', 'admin-1234');
    const badLimit = await request(app)
      .get('/api/project-grade/projects/project-1234/source-evidence-adoptions?limit=0')
      .set('x-test-user', 'admin-1234');

    expect(badScan.status).toBe(400);
    expect(badScan.body.code).toBe('PROJECT_GRADE_INVALID_SOURCESCANID');
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.code).toBe('PROJECT_GRADE_INVALID_LIMIT');
    expect(mockGetProjectSourceEvidenceDraftPreview).not.toHaveBeenCalled();
    expect(mockListProjectSourceEvidenceAdoptions).not.toHaveBeenCalled();
  });

  it('persists evaluations only through the authenticated project resource route', async () => {
    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/evaluations')
      .set('x-test-user', 'member-1234');

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      persisted: true,
      assessmentScope: { productionAcceptance: false },
      persistenceScope: { externalScanningEnabled: false },
    });
    expect(mockRunProjectEvaluation).toHaveBeenCalledWith('project-1234', 'member-1234');
  });

  it('fails closed for invalid resource identifiers and list limits', async () => {
    const badProject = await request(app)
      .get('/api/project-grade/projects/bad')
      .set('x-test-user', 'owner-1234');
    expect(badProject.status).toBe(400);
    expect(badProject.body.code).toBe('PROJECT_GRADE_INVALID_PROJECTID');

    const badLimit = await request(app)
      .get('/api/project-grade/projects/project-1234/evaluations?limit=0')
      .set('x-test-user', 'owner-1234');
    expect(badLimit.status).toBe(400);
    expect(badLimit.body.code).toBe('PROJECT_GRADE_INVALID_LIMIT');

    const badRun = await request(app)
      .get('/api/project-grade/evaluations/bad')
      .set('x-test-user', 'owner-1234');
    expect(badRun.status).toBe(400);
    expect(badRun.body.code).toBe('PROJECT_GRADE_INVALID_RUNID');

    expect(mockGetProjectForUser).not.toHaveBeenCalled();
    expect(mockListProjectEvaluationRuns).not.toHaveBeenCalled();
    expect(mockGetEvaluationRunForUser).not.toHaveBeenCalled();
  });

  it('requires authentication for all persisted evidence, finding and remediation APIs', async () => {
    const responses = await Promise.all([
      request(app).get('/api/project-grade/projects/project-1234/evidence'),
      request(app).get('/api/project-grade/projects/project-1234/findings'),
      request(app).get('/api/project-grade/projects/project-1234/audit'),
      request(app)
        .patch('/api/project-grade/projects/project-1234/findings/finding-1234/workflow')
        .send({ status: 'open', note: 'reopen after review' }),
      request(app).get('/api/project-grade/projects/project-1234/remediations'),
      request(app).post(
        '/api/project-grade/projects/project-1234/findings/finding-1234/remediations'
      ),
      request(app)
        .patch('/api/project-grade/projects/project-1234/remediations/task-123456')
        .send({ status: 'in_progress' }),
      request(app).post('/api/project-grade/evaluations/run-123456/projection/rebuild'),
    ]);

    expect(responses.map((response) => response.status)).toEqual([
      401, 401, 401, 401, 401, 401, 401, 401,
    ]);
    expect(mockListProjectEvidence).not.toHaveBeenCalled();
    expect(mockListProjectFindings).not.toHaveBeenCalled();
    expect(mockListProjectAudit).not.toHaveBeenCalled();
    expect(mockCreateRemediationTask).not.toHaveBeenCalled();
    expect(mockRebuildEvaluationProjection).not.toHaveBeenCalled();
  });

  it('lists projected evidence, findings and remediation tasks with bounded limits', async () => {
    const [evidence, findings, remediations] = await Promise.all([
      request(app)
        .get('/api/project-grade/projects/project-1234/evidence?limit=7')
        .set('x-test-user', 'viewer-1234'),
      request(app)
        .get('/api/project-grade/projects/project-1234/findings?limit=8')
        .set('x-test-user', 'viewer-1234'),
      request(app)
        .get('/api/project-grade/projects/project-1234/remediations?limit=9')
        .set('x-test-user', 'viewer-1234'),
    ]);

    expect(evidence.status).toBe(200);
    expect(findings.status).toBe(200);
    expect(remediations.status).toBe(200);
    expect(evidence.body.data.evidence).toEqual([mockEvidence]);
    expect(findings.body.data.findings).toEqual([mockFinding]);
    expect(remediations.body.data.remediations).toEqual([mockTask]);
    expect(evidence.body.data.persistenceScope.externalScanningEnabled).toBe(false);
    expect(mockListProjectEvidence).toHaveBeenCalledWith('project-1234', 'viewer-1234', 7);
    expect(mockListProjectFindings).toHaveBeenCalledWith('project-1234', 'viewer-1234', 8);
    expect(mockListProjectRemediations).toHaveBeenCalledWith('project-1234', 'viewer-1234', 9);
  });

  it('lists authenticated project audit events with a bounded limit and no production-acceptance claim', async () => {
    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/audit?limit=10')
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.audit).toEqual([mockAuditEvent]);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(response.body.data.persistenceScope.externalScanningEnabled).toBe(false);
    expect(mockListProjectAudit).toHaveBeenCalledWith('project-1234', 'admin-1234', 10);
  });

  it('creates a remediation task without claiming production acceptance', async () => {
    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/findings/finding-1234/remediations')
      .set('x-test-user', 'member-1234')
      .send({
        assigneeId: 'owner-1234',
        dueAt: '2026-07-21T00:00:00.000Z',
        slaHours: 24,
      });

    expect(response.status).toBe(201);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(mockCreateRemediationTask).toHaveBeenCalledWith(
      'project-1234',
      'finding-1234',
      'member-1234',
      {
        assigneeId: 'owner-1234',
        dueAt: new Date('2026-07-21T00:00:00.000Z'),
        slaHours: 24,
      }
    );
  });

  it('validates remediation identifiers, status, due date and SLA before calling the service', async () => {
    const badFinding = await request(app)
      .post('/api/project-grade/projects/project-1234/findings/bad/remediations')
      .set('x-test-user', 'member-1234');
    const badTask = await request(app)
      .patch('/api/project-grade/projects/project-1234/remediations/bad')
      .set('x-test-user', 'member-1234')
      .send({ status: 'open' });
    const badStatus = await request(app)
      .patch('/api/project-grade/projects/project-1234/remediations/task-123456')
      .set('x-test-user', 'member-1234')
      .send({ status: 'done' });
    const badDueAt = await request(app)
      .post('/api/project-grade/projects/project-1234/findings/finding-1234/remediations')
      .set('x-test-user', 'member-1234')
      .send({ dueAt: 'not-a-date' });
    const badSla = await request(app)
      .post('/api/project-grade/projects/project-1234/findings/finding-1234/remediations')
      .set('x-test-user', 'member-1234')
      .send({ slaHours: 0 });

    expect(badFinding.body.code).toBe('PROJECT_GRADE_INVALID_FINDINGID');
    expect(badTask.body.code).toBe('PROJECT_GRADE_INVALID_TASKID');
    expect(badStatus.body.code).toBe('PROJECT_GRADE_INVALID_REMEDIATION_STATUS');
    expect(badDueAt.body.code).toBe('PROJECT_GRADE_INVALID_DUE_AT');
    expect(badSla.body.code).toBe('PROJECT_GRADE_INVALID_SLA_HOURS');
    expect(
      [badFinding, badTask, badStatus, badDueAt, badSla].every(
        (response) => response.status === 400
      )
    ).toBe(true);
    expect(mockCreateRemediationTask).not.toHaveBeenCalled();
    expect(mockUpdateRemediationTask).not.toHaveBeenCalled();
  });

  it('requires a valid finding workflow status and a non-empty note', async () => {
    const missingNote = await request(app)
      .patch('/api/project-grade/projects/project-1234/findings/finding-1234/workflow')
      .set('x-test-user', 'admin-1234')
      .send({ status: 'accepted_risk' });
    const badStatus = await request(app)
      .patch('/api/project-grade/projects/project-1234/findings/finding-1234/workflow')
      .set('x-test-user', 'admin-1234')
      .send({ status: 'verified', note: 'not a manual workflow state' });

    expect(missingNote.status).toBe(400);
    expect(missingNote.body.code).toBe('PROJECT_GRADE_FINDING_NOTE_REQUIRED');
    expect(badStatus.status).toBe(400);
    expect(badStatus.body.code).toBe('PROJECT_GRADE_INVALID_FINDING_STATUS');
    expect(mockUpdateFindingWorkflow).not.toHaveBeenCalled();
  });

  it('updates finding workflow and remediation retest state without claiming production acceptance', async () => {
    const workflow = await request(app)
      .patch('/api/project-grade/projects/project-1234/findings/finding-1234/workflow')
      .set('x-test-user', 'admin-1234')
      .send({ status: 'accepted_risk', note: 'approved compensating control' });
    const remediation = await request(app)
      .patch('/api/project-grade/projects/project-1234/remediations/task-123456')
      .set('x-test-user', 'member-1234')
      .send({
        status: 'ready_for_retest',
        completionNote: 'patch deployed to staging',
        retestRunId: 'run-654321',
      });

    expect(workflow.status).toBe(200);
    expect(workflow.body.data.productionAcceptance).toBe(false);
    expect(mockUpdateFindingWorkflow).toHaveBeenCalledWith(
      'project-1234',
      'finding-1234',
      'admin-1234',
      { status: 'accepted_risk', note: 'approved compensating control' }
    );
    expect(remediation.status).toBe(200);
    expect(remediation.body.data.productionAcceptance).toBe(false);
    expect(mockUpdateRemediationTask).toHaveBeenCalledWith(
      'project-1234',
      'task-123456',
      'member-1234',
      {
        status: 'ready_for_retest',
        assigneeId: undefined,
        dueAt: undefined,
        slaHours: undefined,
        completionNote: 'patch deployed to staging',
        retestRunId: 'run-654321',
      }
    );
  });

  it('preserves an explicit null retestRunId so clients can clear a stale retest link', async () => {
    const response = await request(app)
      .patch('/api/project-grade/projects/project-1234/remediations/task-123456')
      .set('x-test-user', 'member-1234')
      .send({ retestRunId: null });

    expect(response.status).toBe(200);
    expect(mockUpdateRemediationTask).toHaveBeenCalledWith(
      'project-1234',
      'task-123456',
      'member-1234',
      expect.objectContaining({ retestRunId: null })
    );
  });

  it('creates a source evidence evaluation only from one versioned adoptionId', async () => {
    const adoptionId = `source-adoption:v1:${'e'.repeat(64)}`;
    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/evaluations/source-evidence')
      .set('x-test-user', 'admin-1234')
      .send({ adoptionId });

    expect(response.status).toBe(201);
    expect(response.body.data.scope).toMatchObject({
      evaluationInputKind: 'source_evidence_adoption',
      immutableAdoptionInput: true,
      productionVerified: false,
      productionAcceptance: false,
      externalScanningEnabled: false,
    });
    expect(mockRunProjectEvaluationFromSourceEvidence).toHaveBeenCalledWith(
      'project-1234',
      'admin-1234',
      { adoptionId }
    );
  });

  it('rejects empty, unversioned or client-computed source evidence evaluation fields', async () => {
    const requests = [
      {},
      { adoptionId: 'adoption-123456' },
      {
        adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
        score: 100,
      },
      {
        sourceScanId: 'source-scan-123456',
        draftSetHash: `sha256:${'f'.repeat(64)}`,
      },
    ];

    for (const body of requests) {
      const response = await request(app)
        .post('/api/project-grade/projects/project-1234/evaluations/source-evidence')
        .set('x-test-user', 'admin-1234')
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(mockRunProjectEvaluationFromSourceEvidence).not.toHaveBeenCalled();
  });

  it('requires authentication before listing, publishing or revoking formal reports', async () => {
    const responses = await Promise.all([
      request(app).get('/api/project-grade/projects/project-1234/reports'),
      request(app)
        .post('/api/project-grade/projects/project-1234/evaluations/run-123456/report')
        .send({}),
      request(app)
        .post('/api/project-grade/projects/project-1234/reports/rpt_project_123456/revoke')
        .send({ reason: 'customer requested correction' }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401, 401]);
    expect(mockListProjectReports).not.toHaveBeenCalled();
    expect(mockPublishProjectReport).not.toHaveBeenCalled();
    expect(mockRevokeProjectReport).not.toHaveBeenCalled();
  });

  it('lists authenticated project reports with a validated limit and no production acceptance claim', async () => {
    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/reports?limit=25')
      .set('x-test-user', 'member-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.reports).toEqual([mockReport]);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(mockListProjectReports).toHaveBeenCalledWith('project-1234', 'member-1234', 25);
  });

  it('requires authentication before listing report deliveries or downloading a PDF', async () => {
    const responses = await Promise.all([
      request(app).get(
        '/api/project-grade/projects/project-1234/reports/rpt_project_123456/deliveries'
      ),
      request(app).get(
        '/api/project-grade/projects/project-1234/reports/rpt_project_123456/download.pdf'
      ),
    ]);

    expect(responses.map((response) => response.status)).toEqual([401, 401]);
    expect(mockListProjectReportDeliveries).not.toHaveBeenCalled();
    expect(mockDeliverProjectReportPdf).not.toHaveBeenCalled();
  });

  it('lists persisted PDF delivery records with a validated limit', async () => {
    const response = await request(app)
      .get(
        '/api/project-grade/projects/project-1234/reports/rpt_project_123456/deliveries?limit=25'
      )
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.deliveries).toEqual([mockReportDelivery]);
    expect(response.body.data.scope).toMatchObject({
      format: 'pdf',
      deliveryRecordPersisted: true,
      productionAcceptance: false,
    });
    expect(mockListProjectReportDeliveries).toHaveBeenCalledWith(
      'project-1234',
      'rpt_project_123456',
      'admin-1234',
      25
    );
  });

  it('downloads a formal PDF through the dedicated quota gate with immutable delivery headers', async () => {
    const response = await request(app)
      .get('/api/project-grade/projects/project-1234/reports/rpt_project_123456/download.pdf')
      .set('x-test-user', 'member-1234');

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('application/pdf');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.headers['x-aibak-delivery-id']).toBe(mockReportDelivery.deliveryId);
    expect(response.headers['x-aibak-report-fingerprint']).toBe(
      mockReportDelivery.contentFingerprint
    );
    expect(response.headers['x-aibak-document-fingerprint']).toBe(
      mockReportDelivery.documentFingerprint
    );
    expect(response.headers['x-aibak-production-acceptance']).toBe('false');
    expect(Buffer.isBuffer(response.body)).toBe(true);
    expect(response.body.subarray(0, 4).toString()).toBe('%PDF');
    expect(mockProjectGradeQuotaResourceUse).toHaveBeenCalledWith('project_grade_report_download');
    expect(mockDeliverProjectReportPdf).toHaveBeenCalledWith(
      'project-1234',
      'rpt_project_123456',
      'member-1234'
    );
  });

  it('publishes a formal report through the report quota gate using only an optional title', async () => {
    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/evaluations/run-123456/report')
      .set('x-test-user', 'admin-1234')
      .send({ title: 'Customer-ready assessment' });

    expect(response.status).toBe(201);
    expect(response.body.data.report).toEqual(mockReport);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(mockProjectGradeQuotaResourceUse).toHaveBeenCalledWith('project_grade_report_publish');
    expect(mockPublishProjectReport).toHaveBeenCalledWith(
      'project-1234',
      'run-123456',
      'admin-1234',
      { title: 'Customer-ready assessment' }
    );
  });

  it('rejects client-computed report scores, dimensions, findings and unknown publish fields', async () => {
    const invalidBodies = [
      { score: 100 },
      { dimensions: [] },
      { findings: [] },
      { title: 'Report', productionAcceptance: true },
      { title: ' '.repeat(2) },
    ];

    for (const body of invalidBodies) {
      const response = await request(app)
        .post('/api/project-grade/projects/project-1234/evaluations/run-123456/report')
        .set('x-test-user', 'admin-1234')
        .send(body);
      expect(response.status).toBe(400);
    }
    expect(mockPublishProjectReport).not.toHaveBeenCalled();
  });

  it('revokes a formal report with a strict publicId and required audited reason', async () => {
    const response = await request(app)
      .post('/api/project-grade/projects/project-1234/reports/rpt_project_123456/revoke')
      .set('x-test-user', 'admin-1234')
      .send({ reason: ' customer requested correction ' });

    expect(response.status).toBe(200);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(mockRevokeProjectReport).toHaveBeenCalledWith(
      'project-1234',
      'rpt_project_123456',
      'admin-1234',
      'customer requested correction'
    );
  });

  it('rejects invalid report publicIds, missing revocation reasons and unknown revoke fields', async () => {
    const requests = [
      request(app)
        .post('/api/project-grade/projects/project-1234/reports/bad!/revoke')
        .set('x-test-user', 'admin-1234')
        .send({ reason: 'correction' }),
      request(app)
        .post('/api/project-grade/projects/project-1234/reports/rpt_project_123456/revoke')
        .set('x-test-user', 'admin-1234')
        .send({}),
      request(app)
        .post('/api/project-grade/projects/project-1234/reports/rpt_project_123456/revoke')
        .set('x-test-user', 'admin-1234')
        .send({ reason: 'correction', score: 0 }),
    ];

    for (const pendingRequest of requests) {
      const response = await pendingRequest;
      expect(response.status).toBe(400);
    }
    expect(mockRevokeProjectReport).not.toHaveBeenCalled();
  });

  it('rebuilds an authorized run projection without treating it as production acceptance', async () => {
    const response = await request(app)
      .post('/api/project-grade/evaluations/run-123456/projection/rebuild')
      .set('x-test-user', 'admin-1234');

    expect(response.status).toBe(200);
    expect(response.body.data.productionAcceptance).toBe(false);
    expect(response.body.data.persistenceScope.immutableRunSnapshot).toBe(true);
    expect(mockRebuildEvaluationProjection).toHaveBeenCalledWith('run-123456', 'admin-1234');
  });
});
