import { createHash } from 'crypto';

const mockRuleBulkWrite = jest.fn();
const mockProjectCreate = jest.fn();
const mockProjectFind = jest.fn();
const mockProjectFindOne = jest.fn();
const mockProjectDeleteOne = jest.fn();
const mockTargetCreate = jest.fn();
const mockTargetFindOne = jest.fn();
const mockEvaluationCreate = jest.fn();
const mockEvaluationFind = jest.fn();
const mockEvaluationFindOne = jest.fn();
const mockEvaluationUpdateOne = jest.fn();
const mockEvidenceBulkWrite = jest.fn();
const mockEvidenceDeleteMany = jest.fn();
const mockFindingBulkWrite = jest.fn();
const mockFindingDeleteMany = jest.fn();
const mockFindingFindOne = jest.fn();
const mockSnapshotBulkWrite = jest.fn();
const mockSnapshotDeleteMany = jest.fn();
const mockRemediationCreate = jest.fn();
const mockRemediationFind = jest.fn();
const mockRemediationFindOne = jest.fn();
const mockTeamFind = jest.fn();
const mockTeamFindById = jest.fn();
const mockAuditCreate = jest.fn();
const mockAuditFind = jest.fn();
const mockUrlScanRunCreate = jest.fn();
const mockUrlScanRunFind = jest.fn();
const mockSourceScanRunCreate = jest.fn();
const mockSourceScanRunFind = jest.fn();
const mockSourceScanRunFindOne = jest.fn();
const mockEvidenceAdoptionCreate = jest.fn();
const mockEvidenceAdoptionFind = jest.fn();
const mockEvidenceAdoptionFindOne = jest.fn();

jest.mock('../models/ProjectGradeAuditLog', () => ({
  ProjectGradeAuditLog: { create: mockAuditCreate, find: mockAuditFind },
}));

jest.mock('../models/ProjectGradeUrlScanRun', () => ({
  ProjectGradeUrlScanRun: { create: mockUrlScanRunCreate, find: mockUrlScanRunFind },
}));

jest.mock('../models/ProjectGradeSourceScanRun', () => ({
  ProjectGradeSourceScanRun: {
    create: mockSourceScanRunCreate,
    find: mockSourceScanRunFind,
    findOne: mockSourceScanRunFindOne,
  },
}));

jest.mock('../models/ProjectGradeEvidenceAdoption', () => ({
  PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION: 1,
  ProjectGradeEvidenceAdoption: {
    create: mockEvidenceAdoptionCreate,
    find: mockEvidenceAdoptionFind,
    findOne: mockEvidenceAdoptionFindOne,
  },
}));

jest.mock('../models/ProjectGradeEvidence', () => ({
  ProjectGradeEvidence: { bulkWrite: mockEvidenceBulkWrite, deleteMany: mockEvidenceDeleteMany },
}));

jest.mock('../models/ProjectGradeFinding', () => ({
  ProjectGradeFinding: {
    bulkWrite: mockFindingBulkWrite,
    deleteMany: mockFindingDeleteMany,
    findOne: mockFindingFindOne,
  },
}));

jest.mock('../models/ProjectGradeScoreSnapshot', () => ({
  ProjectGradeScoreSnapshot: {
    bulkWrite: mockSnapshotBulkWrite,
    deleteMany: mockSnapshotDeleteMany,
  },
}));

jest.mock('../models/ProjectGradeRemediationTask', () => ({
  ProjectGradeRemediationTask: {
    create: mockRemediationCreate,
    find: mockRemediationFind,
    findOne: mockRemediationFindOne,
  },
}));

jest.mock('../models/ProjectGradeRule', () => ({
  ProjectGradeRule: { bulkWrite: mockRuleBulkWrite },
}));

jest.mock('../models/ProjectGradeProject', () => ({
  ProjectGradeProject: {
    create: mockProjectCreate,
    find: mockProjectFind,
    findOne: mockProjectFindOne,
    deleteOne: mockProjectDeleteOne,
  },
}));

jest.mock('../models/ProjectGradeScanTarget', () => ({
  ProjectGradeScanTarget: {
    create: mockTargetCreate,
    findOne: mockTargetFindOne,
  },
}));

jest.mock('../models/EvaluationRun', () => ({
  EvaluationRun: {
    create: mockEvaluationCreate,
    find: mockEvaluationFind,
    findOne: mockEvaluationFindOne,
    updateOne: mockEvaluationUpdateOne,
  },
}));

jest.mock('../models/Team', () => ({
  Team: {
    find: mockTeamFind,
    findById: mockTeamFindById,
  },
}));

import { AppError } from '../lib/http-error';
import { projectSourceScanEvidenceDrafts } from '../project-grade/source-scan-evidence-projection';
import { ProjectGradeService } from './project-grade.service';

const urlScanResult = {
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
  evidenceScope: 'single_server_http_observation' as const,
  productionAcceptance: false as const,
  note: 'single server observation only',
};
const mockScanRegisteredUrl = jest.fn(async () => urlScanResult);

const sourceScanResult = {
  scanVersion: 'authorized-source-snapshot/0.1.0',
  rootKey: 'aibak_server_repository',
  snapshotHash: 'sha256:1234567890abcdef',
  files: [{ path: 'src/index.ts', sizeBytes: 42, sha256: 'a'.repeat(64) }],
  findings: [
    {
      ruleKey: 'source.todo',
      severity: 'info' as const,
      filePath: 'src/index.ts',
      line: 1,
      message: '发现待办标记，需要确认是否阻塞交付。',
      fingerprint: 'b'.repeat(32),
    },
  ],
  routes: [
    {
      framework: 'express' as const,
      method: 'GET',
      routePath: '/health',
      filePath: 'src/index.ts',
      line: 2,
    },
  ],
  projectSignals: {
    hasTests: true,
    hasDocker: true,
    hasCi: true,
    hasLicense: true,
    hasPackageManifest: true,
  },
  summary: { filesScanned: 1, totalBytes: 42, findings: 1, routes: 1 },
  skipped: { ignoredDirectories: 0, unsupportedExtensions: 0, binaryFiles: 0, symbolicLinks: 0 },
  limits: { maxFiles: 5000, maxFileBytes: 1048576, maxTotalBytes: 26214400, timeoutMs: 10000 },
  evidenceScope: 'authorized_local_source_snapshot' as const,
  productionAcceptance: false as const,
  externalScanningEnabled: false as const,
  sourceContentPersisted: false as const,
  executedSourceCode: false as const,
  installedDependencies: false as const,
  networkAccessed: false as const,
};
const mockSourceScan = jest.fn(async () => sourceScanResult);

const baselineResult = {
  runId: 'run-123456',
  projectName: 'Project',
  projectType: 'ai_application',
  projectUrl: 'https://example.com/',
  rulePackKey: 'aibak-projectgrade-core',
  rulePackVersion: '0.1.0',
  assessedAt: new Date('2026-07-20T00:00:00.000Z'),
  rawTotalScore: 376.4,
  finalTotalScore: 376.4,
  normalizedScore: 37.6,
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
  summary: 'repository baseline only',
};

function teamQueryResult(team: any) {
  return {
    select: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(team),
    }),
  };
}

function createAdoptableSourceScan(overrides: Record<string, unknown> = {}) {
  const validFindingFingerprint = createHash('sha256')
    .update(['source.todo', 'src/index.ts', '1'].join('\0'))
    .digest('hex')
    .slice(0, 32);
  const canonicalFiles = ['src/index.ts', '42', 'a'.repeat(64)].join('\0');
  const validSnapshotHash = `sha256:${createHash('sha256').update(canonicalFiles).digest('hex')}`;
  return {
    scanId: 'scan-123456',
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    status: 'succeeded' as const,
    rootKey: 'aibak_server_repository',
    scanVersion: sourceScanResult.scanVersion,
    snapshotHash: validSnapshotHash,
    result: {
      ...sourceScanResult,
      snapshotHash: validSnapshotHash,
      findings: [
        {
          ...sourceScanResult.findings[0],
          fingerprint: validFindingFingerprint,
        },
      ],
    },
    evidenceScope: 'authorized_local_source_snapshot' as const,
    productionAcceptance: false as const,
    createdAt: new Date('2026-07-21T12:00:00.000Z'),
    ...overrides,
  };
}

function authorizeAdoptionFixture(projectOverrides: Record<string, unknown> = {}) {
  const project = createProjectDocument(projectOverrides);
  const sourceScan = createAdoptableSourceScan({
    projectId: project.projectId,
    ownerId: project.ownerId,
    ...(project.teamId ? { teamId: project.teamId } : {}),
  });
  const projection = projectSourceScanEvidenceDrafts(sourceScan);
  mockProjectFindOne.mockResolvedValue(project);
  mockSourceScanRunFindOne.mockResolvedValue(sourceScan);
  mockTargetFindOne.mockResolvedValue({
    targetId: 'target-1234',
    projectId: project.projectId,
    ownerId: project.ownerId,
    ...(project.teamId ? { teamId: project.teamId } : {}),
    kind: 'internal_repository',
    scopeKey: 'aibak_server_repository',
    repositoryProvider: 'internal',
    status: 'active',
  });
  return { project, sourceScan, projection };
}

function createEvidenceAdoption(
  projection: ReturnType<typeof projectSourceScanEvidenceDrafts>,
  overrides: Record<string, unknown> = {}
) {
  return {
    adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
    projectId: projection.projectId,
    targetId: 'target-1234',
    ownerId: projection.ownerId,
    ...(projection.teamId ? { teamId: projection.teamId } : {}),
    sourceScanId: projection.sourceScanId,
    sourceScanVersion: projection.sourceScanVersion,
    snapshotHash: projection.snapshotHash,
    draftSetHash: projection.draftSetHash,
    projectionVersion: projection.projectionVersion,
    adoptionVersion: 1 as const,
    draftCount: projection.drafts.length,
    evidenceIds: projection.drafts.map((draft) => draft.evidenceId),
    evidenceScope: 'authorized_local_source_snapshot' as const,
    scoringDisposition: 'adopted_pending_evaluation' as const,
    productionAcceptance: false as const,
    externalScanningEnabled: false as const,
    createdBy: 'owner-1234',
    createdAt: new Date('2026-07-21T12:05:00.000Z'),
    ...overrides,
  };
}

function createSourceEvidenceRun(
  manifest: ReturnType<typeof createEvidenceAdoption>,
  project: ReturnType<typeof createProjectDocument>,
  overrides: Record<string, unknown> = {}
) {
  return {
    ...baselineResult,
    runId: 'run-source-1234',
    projectId: project.projectId,
    targetId: manifest.targetId,
    ownerId: project.ownerId,
    ...(project.teamId ? { teamId: project.teamId } : {}),
    evaluationInputKind: 'source_evidence_adoption' as const,
    adoptionId: manifest.adoptionId,
    sourceScanId: manifest.sourceScanId,
    sourceScanVersion: manifest.sourceScanVersion,
    snapshotHash: manifest.snapshotHash,
    draftSetHash: manifest.draftSetHash,
    sourceEvidenceProjectionVersion: manifest.projectionVersion,
    sourceEvidenceAdoptionVersion: manifest.adoptionVersion,
    sourceEvidenceScoringPolicyVersion: 1,
    projectionStatus: 'ready' as const,
    productionVerified: false as const,
    ...overrides,
  };
}

function createProjectDocument(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    teamId: undefined,
    name: 'Project',
    projectType: 'ai_application',
    projectUrl: 'https://example.com/',
    status: 'active',
    updatedBy: 'owner-1234',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe('ProjectGradeService persisted project boundaries', () => {
  let service: ProjectGradeService;

  beforeEach(() => {
    jest.clearAllMocks();
    mockScanRegisteredUrl.mockResolvedValue(urlScanResult);
    service = new ProjectGradeService(
      process.cwd(),
      { scanRegisteredUrl: mockScanRegisteredUrl },
      { scan: mockSourceScan }
    );

    mockRuleBulkWrite.mockResolvedValue({
      matchedCount: 0,
      modifiedCount: 0,
      upsertedCount: 12,
    });
    mockProjectDeleteOne.mockResolvedValue({ deletedCount: 1 });
    mockEvaluationUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockAuditCreate.mockResolvedValue({});
    mockUrlScanRunCreate.mockResolvedValue({});
    mockUrlScanRunFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });
    mockSourceScan.mockResolvedValue(sourceScanResult);
    mockSourceScanRunCreate.mockResolvedValue({});
    mockEvidenceAdoptionCreate.mockImplementation(async (value) => value);
    mockEvidenceAdoptionFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(null);
    mockSourceScanRunFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([]),
      }),
    });
    mockEvidenceBulkWrite.mockResolvedValue({ upsertedCount: 0 });
    mockEvidenceDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockFindingBulkWrite.mockResolvedValue({ upsertedCount: 0 });
    mockFindingDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockSnapshotBulkWrite.mockResolvedValue({ upsertedCount: 0 });
    mockSnapshotDeleteMany.mockResolvedValue({ deletedCount: 0 });
    mockTeamFind.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue([]),
      }),
    });
  });

  it('syncs all 12 rules by rule key and immutable pack version', async () => {
    const result = await service.syncDefaultRulePack();

    expect(result).toMatchObject({
      rulePackKey: 'aibak-projectgrade-core',
      rulePackVersion: '0.1.0',
      rules: 12,
      upserted: 12,
    });
    expect(mockRuleBulkWrite).toHaveBeenCalledTimes(1);
    const [operations, options] = mockRuleBulkWrite.mock.calls[0];
    expect(operations).toHaveLength(12);
    expect(options).toEqual({ ordered: true });
    for (const operation of operations) {
      expect(operation.updateOne).toMatchObject({
        filter: {
          key: expect.any(String),
          rulePackKey: 'aibak-projectgrade-core',
          rulePackVersion: '0.1.0',
        },
        upsert: true,
      });
    }
  });

  it('creates a personal project and one internal-repository target owned by the caller', async () => {
    const project = createProjectDocument();
    const target = {
      targetId: 'target-1234',
      projectId: 'project-1234',
      kind: 'internal_repository',
    };
    mockProjectCreate.mockResolvedValue(project);
    mockTargetCreate.mockResolvedValue(target);

    const created = await service.createProject({
      ownerId: 'owner-1234',
      name: 'Project',
      projectType: 'ai_application',
      projectUrl: 'https://example.com/',
    });

    expect(created).toEqual({ project, target });
    expect(mockTeamFindById).not.toHaveBeenCalled();
    expect(mockProjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        ownerId: 'owner-1234',
        createdBy: 'owner-1234',
        updatedBy: 'owner-1234',
        projectType: 'ai_application',
        status: 'active',
      })
    );
    expect(mockTargetCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1234',
        ownerId: 'owner-1234',
        kind: 'internal_repository',
        scopeKey: 'aibak_server_repository',
        repositoryProvider: 'internal',
        status: 'active',
      })
    );
  });

  it('requires a team admin or owner before creating a team-owned resource', async () => {
    mockTeamFindById.mockReturnValue(
      teamQueryResult({
        ownerId: 'team-owner',
        members: [{ userId: 'viewer-1234', role: 'viewer' }],
      })
    );

    await expect(
      service.createProject({
        ownerId: 'viewer-1234',
        teamId: 'team-1234',
        name: 'Team project',
        projectType: 'saas',
      })
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_TEAM_FORBIDDEN',
    });
    expect(mockProjectCreate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockScanRegisteredUrl.mockResolvedValue(urlScanResult);
    service = new ProjectGradeService(
      process.cwd(),
      { scanRegisteredUrl: mockScanRegisteredUrl },
      { scan: mockSourceScan }
    );
    mockTeamFindById.mockReturnValue(
      teamQueryResult({
        ownerId: 'team-owner',
        members: [{ userId: 'admin-1234', role: 'admin' }],
      })
    );
    const project = createProjectDocument({ ownerId: 'admin-1234', teamId: 'team-1234' });
    const target = { targetId: 'target-1234', projectId: 'project-1234' };
    mockProjectCreate.mockResolvedValue(project);
    mockTargetCreate.mockResolvedValue(target);

    await expect(
      service.createProject({
        ownerId: 'admin-1234',
        teamId: 'team-1234',
        name: 'Team project',
        projectType: 'saas',
      })
    ).resolves.toEqual({ project, target });
  });

  it('allows a team viewer to read but refuses to run an evaluation', async () => {
    const project = createProjectDocument({
      ownerId: 'team-owner',
      teamId: 'team-1234',
    });
    mockProjectFindOne.mockResolvedValue(project);
    mockTeamFindById.mockReturnValue(
      teamQueryResult({
        ownerId: 'team-owner',
        members: [{ userId: 'viewer-1234', role: 'viewer' }],
      })
    );

    await expect(service.getProjectForUser('project-1234', 'viewer-1234')).resolves.toBe(project);
    await expect(service.runProjectEvaluation('project-1234', 'viewer-1234')).rejects.toMatchObject(
      {
        statusCode: 403,
        code: 'PROJECT_GRADE_TEAM_FORBIDDEN',
      }
    );
    await expect(
      service.runProjectUrlQuickScan('project-1234', 'viewer-1234')
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_TEAM_FORBIDDEN',
    });
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockScanRegisteredUrl).not.toHaveBeenCalled();
  });

  it.each([
    ['owner', 'owner-1234'],
    ['member', 'member-1234'],
    ['admin', 'admin-1234'],
  ] as const)('allows a %s to run the registered URL quick scan', async (role, userId) => {
    const isOwner = role === 'owner';
    const project = createProjectDocument({
      ownerId: 'owner-1234',
      teamId: isOwner ? undefined : 'team-1234',
    });
    mockProjectFindOne.mockResolvedValue(project);
    if (!isOwner) {
      mockTeamFindById.mockReturnValue(
        teamQueryResult({
          ownerId: 'team-owner',
          members: [{ userId, role }],
        })
      );
    }

    await expect(service.runProjectUrlQuickScan('project-1234', userId)).resolves.toEqual(
      urlScanResult
    );
    expect(mockScanRegisteredUrl).toHaveBeenLastCalledWith('https://example.com/');
    expect(mockUrlScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        projectId: 'project-1234',
        ownerId: 'owner-1234',
        createdBy: userId,
        status: 'succeeded',
        requestedUrl: 'https://example.com/',
        finalUrl: 'https://example.com/',
        scanVersion: 'url-quick-scan/0.2.0',
        result: urlScanResult,
        evidenceScope: 'single_server_http_observation',
        productionAcceptance: false,
      })
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'url_scan_execute',
        targetType: 'url_scan',
        outcome: 'attempted',
      })
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'url_scan_execute',
        targetType: 'url_scan',
        outcome: 'succeeded',
        metadata: expect.objectContaining({ historyPersisted: true }),
      })
    );
  });

  it('sanitizes every persisted URL field in successful scan snapshots', async () => {
    const resultWithSensitiveUrls = {
      ...urlScanResult,
      requestedUrl: 'https://user:password@example.com/path?token=secret#private',
      finalUrl: 'https://example.com/final?session=secret#result',
      redirectChain: ['https://example.com/redirect?code=secret#step'],
    };
    mockProjectFindOne.mockResolvedValue(
      createProjectDocument({
        projectUrl: 'https://example.com/path?token=secret#private',
      })
    );
    mockScanRegisteredUrl.mockResolvedValueOnce(resultWithSensitiveUrls);

    await expect(service.runProjectUrlQuickScan('project-1234', 'owner-1234')).resolves.toEqual(
      resultWithSensitiveUrls
    );

    expect(mockUrlScanRunCreate).toHaveBeenCalledTimes(1);
    expect(mockUrlScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        requestedUrl: 'https://example.com/path',
        finalUrl: 'https://example.com/final',
        result: expect.objectContaining({
          requestedUrl: 'https://example.com/path',
          finalUrl: 'https://example.com/final',
          redirectChain: ['https://example.com/redirect'],
        }),
      })
    );
    expect(JSON.stringify(mockUrlScanRunCreate.mock.calls)).not.toContain('secret');
    expect(JSON.stringify(mockUrlScanRunCreate.mock.calls)).not.toContain('password');
  });

  it('lets viewers read sanitized URL scan history without granting scan execution', async () => {
    const project = createProjectDocument({ ownerId: 'team-owner', teamId: 'team-1234' });
    const scans = [{ scanId: 'scan-123456', status: 'succeeded' }];
    const limit = jest.fn().mockResolvedValue(scans);
    const sort = jest.fn().mockReturnValue({ limit });
    mockProjectFindOne.mockResolvedValue(project);
    mockTeamFindById.mockReturnValue(
      teamQueryResult({
        ownerId: 'team-owner',
        members: [{ userId: 'viewer-1234', role: 'viewer' }],
      })
    );
    mockUrlScanRunFind.mockReturnValue({ sort });

    await expect(
      service.listProjectUrlScanRuns('project-1234', 'viewer-1234', 20)
    ).resolves.toEqual(scans);
    expect(mockUrlScanRunFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'team-owner',
      teamId: 'team-1234',
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(20);
    expect(mockScanRegisteredUrl).not.toHaveBeenCalled();
  });

  it('persists a sanitized failed scan record and rethrows the safe scan error', async () => {
    const scanError = new AppError(
      502,
      '无法安全读取项目登记网址',
      'PROJECT_GRADE_URL_SCAN_FAILED',
      'request failed for https://example.com/?token=secret'
    );
    mockProjectFindOne.mockResolvedValue(
      createProjectDocument({
        projectUrl: 'https://example.com/path?token=secret#private',
      })
    );
    mockScanRegisteredUrl.mockRejectedValue(scanError);

    await expect(service.runProjectUrlQuickScan('project-1234', 'owner-1234')).rejects.toBe(
      scanError
    );
    expect(mockUrlScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        requestedUrl: 'https://example.com/path',
        errorCode: 'PROJECT_GRADE_URL_SCAN_FAILED',
        errorSummary: '无法安全读取项目登记网址',
        productionAcceptance: false,
      })
    );
    expect(JSON.stringify(mockUrlScanRunCreate.mock.calls)).not.toContain('token=secret');
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'url_scan_execute',
        outcome: 'failed',
        errorCode: 'PROJECT_GRADE_URL_SCAN_FAILED',
      })
    );
  });

  it('does not return a successful scan when its history cannot be persisted', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockUrlScanRunCreate.mockRejectedValue(new Error('database unavailable'));

    await expect(
      service.runProjectUrlQuickScan('project-1234', 'owner-1234')
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_URL_SCAN_HISTORY_UNAVAILABLE',
    });
    expect(mockScanRegisteredUrl).toHaveBeenCalledTimes(1);
    expect(mockUrlScanRunCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'url_scan_execute',
        outcome: 'failed',
        metadata: expect.objectContaining({ historyPersisted: false, scanCompleted: true }),
      })
    );
  });

  it('fails closed for archived projects and projects without a registered URL before scanning', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument({ status: 'archived' }));
    await expect(
      service.runProjectUrlQuickScan('project-1234', 'owner-1234')
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_PROJECT_ARCHIVED',
    });

    mockProjectFindOne.mockResolvedValue(createProjectDocument({ projectUrl: undefined }));
    await expect(
      service.runProjectUrlQuickScan('project-1234', 'owner-1234')
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_PROJECT_URL_MISSING',
    });
    expect(mockScanRegisteredUrl).not.toHaveBeenCalled();
  });

  it('runs an authorized owner source scan, persists only the sanitized snapshot and never writes EvaluationRun', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
      status: 'active',
    });
    mockSourceScan.mockResolvedValue({
      ...sourceScanResult,
      sourceContent: 'apiKey=super-secret',
    } as any);

    const result = await service.runProjectSourceScan('project-1234', 'owner-1234');

    expect(result).toMatchObject({
      rootKey: 'aibak_server_repository',
      evidenceScope: 'authorized_local_source_snapshot',
      productionAcceptance: false,
      sourceContentPersisted: false,
      networkAccessed: false,
    });
    expect(mockSourceScan).toHaveBeenCalledWith({ rootKey: 'aibak_server_repository' });
    expect(mockSourceScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'succeeded',
        rootKey: 'aibak_server_repository',
        snapshotHash: 'sha256:1234567890abcdef',
        productionAcceptance: false,
        result: expect.objectContaining({ sourceContentPersisted: false }),
      })
    );
    expect(JSON.stringify(mockSourceScanRunCreate.mock.calls)).not.toContain('super-secret');
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_scan_execute',
        targetType: 'source_scan',
        outcome: 'attempted',
      })
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_scan_execute',
        outcome: 'succeeded',
        metadata: expect.objectContaining({ historyPersisted: true, filesScanned: 1 }),
      })
    );
  });

  it('does not start source scanning when the attempted audit event cannot be persisted', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
      status: 'active',
    });
    mockAuditCreate.mockRejectedValueOnce(new Error('audit database unavailable'));

    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_scan_execute',
        targetType: 'source_scan',
        outcome: 'attempted',
      })
    );
    expect(mockSourceScan).not.toHaveBeenCalled();
    expect(mockSourceScanRunCreate).not.toHaveBeenCalled();
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects unsafe scanner paths before persistence and records only a redacted failed history', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
      status: 'active',
    });
    mockSourceScan.mockResolvedValue({
      ...sourceScanResult,
      files: [
        {
          ...sourceScanResult.files[0],
          path: 'C:\\private\\apiKey=super-secret.ts',
        },
      ],
    });

    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 502,
      code: 'PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT',
    });

    expect(mockSourceScanRunCreate).toHaveBeenCalledTimes(1);
    expect(mockSourceScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT',
        errorSummary: '源码扫描器返回了不安全的证据边界',
      })
    );
    expect(JSON.stringify(mockSourceScanRunCreate.mock.calls)).not.toContain('super-secret');
    expect(JSON.stringify(mockSourceScanRunCreate.mock.calls)).not.toContain('C:\\private');
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_scan_execute',
        outcome: 'failed',
        errorCode: 'PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT',
        errorSummary: '源码扫描器返回了不安全的证据边界',
      })
    );
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
  });

  it('requires a team admin or owner to execute source scans while allowing viewers to read history', async () => {
    const teamProject = createProjectDocument({ teamId: 'team-1234' });
    const target = {
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
      status: 'active',
    };
    mockProjectFindOne.mockResolvedValue(teamProject);
    mockTeamFindById.mockReturnValue(
      teamQueryResult({
        ownerId: 'team-owner',
        members: [
          { userId: 'admin-1234', role: 'admin' },
          { userId: 'member-1234', role: 'member' },
          { userId: 'viewer-1234', role: 'viewer' },
        ],
      })
    );
    mockTargetFindOne.mockResolvedValue(target);

    await expect(service.runProjectSourceScan('project-1234', 'member-1234')).rejects.toMatchObject(
      { statusCode: 403, code: 'PROJECT_GRADE_TEAM_FORBIDDEN' }
    );
    await expect(service.runProjectSourceScan('project-1234', 'viewer-1234')).rejects.toMatchObject(
      { statusCode: 403, code: 'PROJECT_GRADE_TEAM_FORBIDDEN' }
    );
    expect(mockSourceScan).not.toHaveBeenCalled();

    await expect(service.runProjectSourceScan('project-1234', 'admin-1234')).resolves.toMatchObject(
      { snapshotHash: 'sha256:1234567890abcdef' }
    );
    expect(mockSourceScan).toHaveBeenCalledTimes(1);

    const scans = [{ scanId: 'scan-123456', productionAcceptance: false }];
    const sort = jest.fn().mockReturnValue({ limit: jest.fn().mockResolvedValue(scans) });
    mockSourceScanRunFind.mockReturnValue({ sort });
    await expect(
      service.listProjectSourceScanRuns('project-1234', 'viewer-1234', 20)
    ).resolves.toEqual(scans);
    expect(mockSourceScanRunFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: 'team-1234',
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
  });

  it('binds personal source scan history to the owner and absence of a team tenant', async () => {
    const scans = [{ scanId: 'scan-personal-1234', productionAcceptance: false }];
    const limit = jest.fn().mockResolvedValue(scans);
    const sort = jest.fn().mockReturnValue({ limit });
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockSourceScanRunFind.mockReturnValue({ sort });

    await expect(
      service.listProjectSourceScanRuns('project-1234', 'owner-1234', 20)
    ).resolves.toEqual(scans);
    expect(mockSourceScanRunFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
    });
  });

  it('does not query source scan history when project authorization fails', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());

    await expect(
      service.listProjectSourceScanRuns('project-1234', 'intruder-1234', 20)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_PROJECT_FORBIDDEN',
    });
    expect(mockSourceScanRunFind).not.toHaveBeenCalled();
  });
  it('returns an admin-only tenant-bound source evidence draft preview without tenant identifiers', async () => {
    const { projection } = authorizeAdoptionFixture();

    const preview = await (service as any).getProjectSourceEvidenceDraftPreview(
      'project-1234',
      'owner-1234',
      'scan-123456'
    );

    expect(preview).toMatchObject({
      sourceScanId: 'scan-123456',
      sourceScanVersion: projection.sourceScanVersion,
      snapshotHash: projection.snapshotHash,
      draftSetHash: projection.draftSetHash,
      projectionVersion: projection.projectionVersion,
      scoringDisposition: 'draft_only_not_adopted',
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
    });
    expect(preview).not.toHaveProperty('ownerId');
    expect(preview).not.toHaveProperty('teamId');
    expect(preview.drafts).toHaveLength(projection.drafts.length);
    for (const draft of preview.drafts) {
      expect(draft).not.toHaveProperty('ownerId');
      expect(draft).not.toHaveProperty('teamId');
      expect(draft.scoringDisposition).toBe('draft_only_not_adopted');
    }
    expect(mockSourceScanRunFindOne).toHaveBeenCalledWith({
      scanId: 'scan-123456',
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
      status: 'succeeded',
    });
    expect(mockTargetFindOne).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
      status: 'active',
      kind: 'internal_repository',
    });
  });

  it('fails closed before reading source data when a non-admin requests a draft preview', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());

    await expect(
      (service as any).getProjectSourceEvidenceDraftPreview(
        'project-1234',
        'viewer-1234',
        'scan-123456'
      )
    ).rejects.toMatchObject({ statusCode: 403, code: 'PROJECT_GRADE_PROJECT_FORBIDDEN' });

    expect(mockSourceScanRunFindOne).not.toHaveBeenCalled();
    expect(mockTargetFindOne).not.toHaveBeenCalled();
  });

  it('rejects missing scans, missing targets, and unsafe projection drift for draft previews', async () => {
    const fixture = authorizeAdoptionFixture();
    mockSourceScanRunFindOne.mockResolvedValueOnce(null);
    await expect(
      (service as any).getProjectSourceEvidenceDraftPreview(
        'project-1234',
        'owner-1234',
        'scan-123456'
      )
    ).rejects.toMatchObject({
      statusCode: 404,
      code: 'PROJECT_GRADE_SOURCE_SCAN_NOT_FOUND',
    });

    authorizeAdoptionFixture();
    mockTargetFindOne.mockResolvedValueOnce(null);
    await expect(
      (service as any).getProjectSourceEvidenceDraftPreview(
        'project-1234',
        'owner-1234',
        'scan-123456'
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_SOURCE_TARGET_MISSING',
    });

    authorizeAdoptionFixture();
    mockSourceScanRunFindOne.mockResolvedValueOnce({
      ...fixture.sourceScan,
      snapshotHash: `sha256:${'0'.repeat(64)}`,
    });
    await expect(
      (service as any).getProjectSourceEvidenceDraftPreview(
        'project-1234',
        'owner-1234',
        'scan-123456'
      )
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED',
    });
  });

  it('lists only tenant-bound adoption summaries for project admins with a bounded limit', async () => {
    const { projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const limit = jest.fn().mockResolvedValue([manifest]);
    const sort = jest.fn().mockReturnValue({ limit });
    mockEvidenceAdoptionFind.mockReturnValueOnce({ sort });

    const adoptions = await (service as any).listProjectSourceEvidenceAdoptions(
      'project-1234',
      'owner-1234',
      99
    );

    expect(mockEvidenceAdoptionFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
    });
    expect(sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(limit).toHaveBeenCalledWith(50);
    expect(adoptions).toEqual([
      expect.objectContaining({
        adoptionId: manifest.adoptionId,
        sourceScanId: manifest.sourceScanId,
        draftSetHash: manifest.draftSetHash,
        draftCount: manifest.draftCount,
        scoringDisposition: 'adopted_pending_evaluation',
        productionAcceptance: false,
        externalScanningEnabled: false,
      }),
    ]);
    expect(adoptions[0]).not.toHaveProperty('ownerId');
    expect(adoptions[0]).not.toHaveProperty('teamId');
    expect(adoptions[0]).not.toHaveProperty('evidenceIds');
  });

  it('does not query adoption manifests when list authorization fails', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());

    await expect(
      (service as any).listProjectSourceEvidenceAdoptions('project-1234', 'viewer-1234', 20)
    ).rejects.toMatchObject({ statusCode: 403, code: 'PROJECT_GRADE_PROJECT_FORBIDDEN' });

    expect(mockEvidenceAdoptionFind).not.toHaveBeenCalled();
  });

  it('adopts a tenant-bound source evidence draft set idempotently without changing EvaluationRun', async () => {
    const project = createProjectDocument();
    const validFindingFingerprint = createHash('sha256')
      .update(['source.todo', 'src/index.ts', '1'].join('\0'))
      .digest('hex')
      .slice(0, 32);
    const canonicalFiles = ['src/index.ts', '42', 'a'.repeat(64)].join('\0');
    const validSnapshotHash = `sha256:${createHash('sha256').update(canonicalFiles).digest('hex')}`;
    const sourceScan = {
      scanId: 'scan-123456',
      projectId: project.projectId,
      ownerId: project.ownerId,
      status: 'succeeded' as const,
      rootKey: 'aibak_server_repository',
      scanVersion: sourceScanResult.scanVersion,
      snapshotHash: validSnapshotHash,
      result: {
        ...sourceScanResult,
        snapshotHash: validSnapshotHash,
        findings: [
          {
            ...sourceScanResult.findings[0],
            fingerprint: validFindingFingerprint,
          },
        ],
      },
      evidenceScope: 'authorized_local_source_snapshot' as const,
      productionAcceptance: false as const,
      createdAt: new Date('2026-07-21T12:00:00.000Z'),
    };
    const projection = projectSourceScanEvidenceDrafts(sourceScan);
    mockProjectFindOne.mockResolvedValue(project);
    mockSourceScanRunFindOne.mockResolvedValue(sourceScan);
    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      projectId: project.projectId,
      ownerId: project.ownerId,
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
      status: 'active',
    });

    const adoption = await (service as any).adoptProjectSourceScanEvidence(
      'project-1234',
      'owner-1234',
      {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      }
    );

    expect(adoption).toMatchObject({
      projectId: 'project-1234',
      targetId: 'target-1234',
      sourceScanId: 'scan-123456',
      draftSetHash: projection.draftSetHash,
      adoptionVersion: 1,
      scoringDisposition: 'adopted_pending_evaluation',
      productionAcceptance: false,
    });
    expect(mockSourceScanRunFindOne).toHaveBeenCalledWith({
      scanId: 'scan-123456',
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
      status: 'succeeded',
    });
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
  });

  it('rejects unauthorized or archived adoption before reading source scans or writing manifests', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'viewer-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: `sha256:${'a'.repeat(64)}`,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'PROJECT_GRADE_PROJECT_FORBIDDEN' });
    expect(mockSourceScanRunFindOne).not.toHaveBeenCalled();
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    mockProjectFindOne.mockResolvedValue(createProjectDocument({ status: 'archived' }));
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: `sha256:${'a'.repeat(64)}`,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'PROJECT_GRADE_PROJECT_ARCHIVED' });
    expect(mockSourceScanRunFindOne).not.toHaveBeenCalled();
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();
  });

  it('rejects missing, stale, unsupported, and unsafe source evidence adoption requests', async () => {
    const { projection } = authorizeAdoptionFixture();

    mockSourceScanRunFindOne.mockResolvedValueOnce(null);
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 404, code: 'PROJECT_GRADE_SOURCE_SCAN_NOT_FOUND' });

    authorizeAdoptionFixture();
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: `sha256:${'0'.repeat(64)}`,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_DRAFT_SET_CHANGED',
    });

    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 2,
      })
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION_UNSUPPORTED',
    });

    authorizeAdoptionFixture();
    mockSourceScanRunFindOne.mockResolvedValue(
      createAdoptableSourceScan({
        result: {
          ...createAdoptableSourceScan().result,
          sourceContentPersisted: true,
        },
      })
    );
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED',
    });
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();
  });

  it('rejects missing or forbidden source targets during evidence adoption', async () => {
    const { projection } = authorizeAdoptionFixture();
    mockTargetFindOne.mockResolvedValueOnce(null);
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'PROJECT_GRADE_SOURCE_TARGET_MISSING' });

    authorizeAdoptionFixture();
    mockTargetFindOne.mockResolvedValueOnce({
      targetId: 'target-1234',
      scopeKey: 'attacker_root',
      repositoryProvider: 'internal',
    });
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 403, code: 'PROJECT_GRADE_SOURCE_TARGET_FORBIDDEN' });
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();
  });

  it('returns an existing adoption on replay and duplicate-key races without changing EvaluationRun', async () => {
    const { projection } = authorizeAdoptionFixture();
    const existing = {
      adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
      projectId: 'project-1234',
      scoringDisposition: 'adopted_pending_evaluation',
    };
    mockEvidenceAdoptionFindOne.mockResolvedValueOnce(existing);

    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).resolves.toBe(existing);
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    const second = authorizeAdoptionFixture();
    mockEvidenceAdoptionFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    mockEvidenceAdoptionCreate.mockRejectedValueOnce({ code: 11000 });
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: second.projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).resolves.toBe(existing);
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_evidence_adopt',
        targetType: 'evidence_adoption',
        outcome: 'succeeded',
        metadata: expect.objectContaining({ idempotentReplay: true, productionAcceptance: false }),
      })
    );
  });

  it('fails closed when audit start or manifest persistence is unavailable and redacts internal errors', async () => {
    const { projection } = authorizeAdoptionFixture();
    mockAuditCreate.mockRejectedValueOnce(new Error('mongodb://user:secret@private-host/db'));
    await expect(
      service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
        sourceScanId: 'scan-123456',
        expectedDraftSetHash: projection.draftSetHash,
        adoptionVersion: 1,
      })
    ).rejects.toMatchObject({ statusCode: 503, code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE' });
    expect(mockEvidenceAdoptionFindOne).not.toHaveBeenCalled();
    expect(mockEvidenceAdoptionCreate).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    const retry = authorizeAdoptionFixture();
    mockEvidenceAdoptionFindOne.mockResolvedValue(null);
    mockEvidenceAdoptionCreate.mockRejectedValueOnce(
      new Error('C:\private\apiKey=super-secret mongodb://user:secret@host/db')
    );
    const promise = service.adoptProjectSourceScanEvidence('project-1234', 'owner-1234', {
      sourceScanId: 'scan-123456',
      expectedDraftSetHash: retry.projection.draftSetHash,
      adoptionVersion: 1,
    });
    await expect(promise).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_UNAVAILABLE',
      message: 'ProjectGrade source evidence adoption manifest persistence failed',
    });
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_evidence_adopt',
        outcome: 'failed',
        errorSummary: 'ProjectGrade operation failed; internal error details were not persisted',
        metadata: expect.objectContaining({ manifestPersisted: false }),
      })
    );
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
  });

  it('fails closed for archived, missing, and non-internal source targets before scanning', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument({ status: 'archived' }));
    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_PROJECT_ARCHIVED',
    });

    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue(null);
    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_SOURCE_TARGET_MISSING',
    });

    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'attacker_supplied_root',
      repositoryProvider: 'internal',
    });
    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_SOURCE_TARGET_FORBIDDEN',
    });
    expect(mockSourceScan).not.toHaveBeenCalled();
    expect(mockSourceScanRunCreate).not.toHaveBeenCalled();
  });

  it('persists a redacted failed source scan and returns 503 when source scan history cannot be saved', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue({
      targetId: 'target-1234',
      kind: 'internal_repository',
      scopeKey: 'aibak_server_repository',
      repositoryProvider: 'internal',
    });
    const scanError = new AppError(
      422,
      '授权源码路径不可用',
      'PROJECT_GRADE_SOURCE_ROOT_UNAVAILABLE',
      'C:\private\apiKey=super-secret'
    );
    mockSourceScan.mockRejectedValue(scanError);

    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toBe(
      scanError
    );
    expect(mockSourceScanRunCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'failed',
        errorCode: 'PROJECT_GRADE_SOURCE_ROOT_UNAVAILABLE',
        errorSummary: '授权源码路径不可用',
        productionAcceptance: false,
      })
    );
    expect(JSON.stringify(mockSourceScanRunCreate.mock.calls)).not.toContain('super-secret');
    const failedAudit = mockAuditCreate.mock.calls.find(
      ([entry]) => entry.action === 'source_scan_execute' && entry.outcome === 'failed'
    )?.[0];
    expect(failedAudit).toMatchObject({
      errorCode: 'PROJECT_GRADE_SOURCE_ROOT_UNAVAILABLE',
      errorSummary: '授权源码路径不可用',
    });
    expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain('super-secret');
    expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain('C:\private');

    mockSourceScanRunCreate.mockRejectedValue(new Error('database unavailable'));
    await expect(service.runProjectSourceScan('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 503,
      code: 'PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE',
    });
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
  });

  it('fails closed for archived projects and missing active targets', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument({ status: 'archived' }));
    await expect(service.runProjectEvaluation('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_PROJECT_ARCHIVED',
    });
    expect(mockTargetFindOne).not.toHaveBeenCalled();

    mockProjectFindOne.mockResolvedValue(createProjectDocument());
    mockTargetFindOne.mockResolvedValue(null);
    await expect(service.runProjectEvaluation('project-1234', 'owner-1234')).rejects.toMatchObject({
      statusCode: 409,
      code: 'PROJECT_GRADE_TARGET_MISSING',
    });
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
  });

  it('persists immutable ownership metadata and updates the project summary only after run creation', async () => {
    const project = createProjectDocument({ teamId: 'team-1234' });
    const target = { targetId: 'target-1234' };
    const persistedRun = {
      ...baselineResult,
      projectId: 'project-1234',
      targetId: 'target-1234',
      ownerId: 'owner-1234',
      teamId: 'team-1234',
      createdBy: 'member-1234',
      persistenceVersion: 1,
      projectionStatus: 'pending',
    };
    mockProjectFindOne.mockResolvedValue(project);
    mockTargetFindOne.mockResolvedValue(target);
    mockEvaluationCreate.mockResolvedValue(persistedRun);
    jest.spyOn(service, 'createBaselineEvaluationRun').mockResolvedValue(baselineResult as any);

    const run = await service.runProjectEvaluation('project-1234', 'owner-1234');

    expect(run).toBe(persistedRun);
    expect(mockEvaluationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        runId: 'run-123456',
        projectId: 'project-1234',
        targetId: 'target-1234',
        ownerId: 'owner-1234',
        teamId: 'team-1234',
        createdBy: 'owner-1234',
        persistenceVersion: 1,
        projectionStatus: 'pending',
      })
    );
    expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
      {
        runId: 'run-123456',
        projectionStatus: 'projecting',
        projectionAttemptId: expect.stringMatching(/^projection-attempt:v1:[a-f0-9]{64}$/),
      },
      expect.objectContaining({ $set: expect.objectContaining({ projectionStatus: 'ready' }) })
    );
    expect(persistedRun.projectionStatus).toBe('ready');
    expect(project).toMatchObject({
      latestRunId: 'run-123456',
      latestScore: 37.6,
      latestGrade: 'F',
      latestAssessedAt: baselineResult.assessedAt,
      updatedBy: 'owner-1234',
    });
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('builds idempotent evidence, finding and score projections before marking a run ready', async () => {
    const project = createProjectDocument();
    const projectedResult = {
      ...baselineResult,
      evidence: [
        {
          id: 'evidence-1234',
          ruleKey: 'product_strategy.baseline',
          dimensionKey: 'product_strategy',
          level: 'source_static',
          factor: 0.65,
          sourceType: 'repository_file',
          source: 'docs/PROJECTGRADE-HANDOFF.md',
          collectedAt: new Date('2026-07-20T00:00:00.000Z'),
          title: 'Handoff',
          description: 'Local source evidence',
        },
      ],
      findings: [
        {
          id: 'finding-1234',
          fingerprint: 'fg_v1_1234567890abcdef1234567890abcdef',
          fingerprintVersion: 1,
          ruleKey: 'product_strategy.baseline',
          dimensionKey: 'product_strategy',
          severity: 'P1',
          status: 'open',
          title: 'Production evidence missing',
          description: 'No production evidence exists.',
          recommendation: 'Run a production probe.',
          evidenceIds: ['evidence-1234'],
          createdAt: new Date('2026-07-20T00:00:00.000Z'),
        },
      ],
      snapshots: [
        {
          dimensionKey: 'product_strategy',
          label: '产品战略',
          weight: 60,
          rawScore: 30,
          normalizedScore: 5,
          rules: [],
        },
      ],
    };
    const persistedRun: any = {
      ...projectedResult,
      projectId: 'project-1234',
      targetId: 'target-1234',
      ownerId: 'owner-1234',
      projectionStatus: 'pending',
    };
    mockProjectFindOne.mockResolvedValue(project);
    mockTargetFindOne.mockResolvedValue({ targetId: 'target-1234' });
    mockEvaluationCreate.mockResolvedValue(persistedRun);
    jest.spyOn(service, 'createBaselineEvaluationRun').mockResolvedValue(projectedResult as any);

    await service.runProjectEvaluation('project-1234', 'owner-1234');

    expect(mockEvidenceBulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { runId: 'run-123456', evidenceId: 'evidence-1234' },
            upsert: true,
          }),
        }),
      ],
      { ordered: false }
    );
    expect(mockFindingBulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: {
              runId: 'run-123456',
              fingerprint: 'fg_v1_1234567890abcdef1234567890abcdef',
            },
            update: expect.objectContaining({
              $setOnInsert: { currentStatus: 'open' },
            }),
            upsert: true,
          }),
        }),
      ],
      { ordered: false }
    );
    expect(mockSnapshotBulkWrite).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { runId: 'run-123456', dimensionKey: 'product_strategy' },
            upsert: true,
          }),
        }),
      ],
      { ordered: false }
    );
    expect(persistedRun.projectionStatus).toBe('ready');
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('fails closed, redacts MongoDB credentials and leaves the project summary unchanged when projection fails', async () => {
    const project = createProjectDocument();
    const projectedResult = {
      ...baselineResult,
      evidence: [
        {
          id: 'evidence-1234',
          ruleKey: 'product_strategy.baseline',
          dimensionKey: 'product_strategy',
          level: 'source_static',
          factor: 0.65,
          sourceType: 'repository_file',
          source: 'docs/PROJECTGRADE-HANDOFF.md',
          collectedAt: new Date('2026-07-20T00:00:00.000Z'),
          title: 'Handoff',
          description: 'Local source evidence',
        },
      ],
    };
    const persistedRun: any = {
      ...projectedResult,
      projectId: 'project-1234',
      targetId: 'target-1234',
      ownerId: 'owner-1234',
      projectionStatus: 'pending',
    };
    mockProjectFindOne.mockResolvedValue(project);
    mockTargetFindOne.mockResolvedValue({ targetId: 'target-1234' });
    mockEvaluationCreate.mockResolvedValue(persistedRun);
    mockEvidenceBulkWrite.mockRejectedValue(
      new Error('connect ECONNREFUSED mongodb://admin:secret@db.internal:27017/aibak')
    );
    jest.spyOn(service, 'createBaselineEvaluationRun').mockResolvedValue(projectedResult as any);

    await expect(service.runProjectEvaluation('project-1234', 'owner-1234')).rejects.toMatchObject({
      code: 'PROJECT_GRADE_PROJECTION_FAILED',
      statusCode: 503,
    });

    expect(persistedRun.projectionStatus).toBe('failed');
    expect(persistedRun.projectedAt).toBeUndefined();
    expect(persistedRun.projectionError).toContain('[redacted-mongodb-uri]');
    expect(persistedRun.projectionError).not.toContain('admin:secret');
    expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
      {
        runId: 'run-123456',
        projectionStatus: 'projecting',
        projectionAttemptId: expect.stringMatching(/^projection-attempt:v1:[a-f0-9]{64}$/),
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          projectionStatus: 'failed',
          projectionError: expect.stringContaining('[redacted-mongodb-uri]'),
        }),
        $unset: { projectedAt: 1, projectionLeaseExpiresAt: 1 },
      })
    );
    expect(project.save).not.toHaveBeenCalled();
    expect((project as any).latestRunId).toBeUndefined();
  });

  it('propagates EvaluationRun persistence failures instead of reporting a false persisted result', async () => {
    const project = createProjectDocument();
    mockProjectFindOne.mockResolvedValue(project);
    mockTargetFindOne.mockResolvedValue({ targetId: 'target-1234' });
    mockEvaluationCreate.mockRejectedValue(new Error('database unavailable'));
    jest.spyOn(service, 'createBaselineEvaluationRun').mockResolvedValue(baselineResult as any);

    await expect(service.runProjectEvaluation('project-1234', 'owner-1234')).rejects.toThrow(
      'database unavailable'
    );
    expect(project.save).not.toHaveBeenCalled();
  });

  it('creates one ready evaluation from an immutable source evidence adoption and preserves non-production provenance', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(null);
    mockEvaluationCreate.mockImplementation(async (value) => ({ ...value }));

    const run = await service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });

    expect(mockEvaluationCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        evaluationInputKind: 'source_evidence_adoption',
        adoptionId: manifest.adoptionId,
        sourceScanId: manifest.sourceScanId,
        sourceScanVersion: manifest.sourceScanVersion,
        snapshotHash: manifest.snapshotHash,
        draftSetHash: manifest.draftSetHash,
        sourceEvidenceProjectionVersion: 1,
        sourceEvidenceAdoptionVersion: 1,
        sourceEvidenceScoringPolicyVersion: 1,
        productionVerified: false,
        projectionStatus: 'pending',
      })
    );
    expect(run.projectionStatus).toBe('ready');
    expect(run.productionVerified).toBe(false);
    expect(mockEvidenceBulkWrite).toHaveBeenCalled();
    expect(mockFindingBulkWrite).toHaveBeenCalled();
    expect(project.save).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_evidence_evaluate',
        targetType: 'evaluation_run',
        outcome: 'succeeded',
        metadata: expect.objectContaining({
          adoptionId: manifest.adoptionId,
          productionVerified: false,
        }),
      })
    );
  });

  it('denies non-admin source evidence evaluation before reading the manifest', async () => {
    mockProjectFindOne.mockResolvedValue(createProjectDocument());

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'viewer-1234', {
        adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECT_FORBIDDEN', statusCode: 403 });

    expect(mockEvidenceAdoptionFindOne).not.toHaveBeenCalled();
    expect(mockSourceScanRunFindOne).not.toHaveBeenCalled();
    expect(mockTargetFindOne).not.toHaveBeenCalled();
  });

  it('fails closed before run creation when the adoption manifest is missing from the authorized tenant', async () => {
    const project = createProjectDocument();
    mockProjectFindOne.mockResolvedValue(project);
    mockEvidenceAdoptionFindOne.mockResolvedValue(null);

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_NOT_FOUND',
      statusCode: 404,
    });

    expect(mockEvidenceAdoptionFindOne).toHaveBeenCalledWith({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: { $exists: false },
      adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
    });
    expect(mockSourceScanRunFindOne).not.toHaveBeenCalled();
    expect(mockTargetFindOne).not.toHaveBeenCalled();
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(project.save).not.toHaveBeenCalled();
  });

  it('fails closed before run creation when the adopted source scan or target is unavailable', async () => {
    const first = authorizeAdoptionFixture();
    const firstManifest = createEvidenceAdoption(first.projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(firstManifest);
    mockSourceScanRunFindOne.mockResolvedValue(null);

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: firstManifest.adoptionId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_SCAN_UNAVAILABLE',
      statusCode: 409,
    });
    expect(mockTargetFindOne).not.toHaveBeenCalled();
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(first.project.save).not.toHaveBeenCalled();

    jest.clearAllMocks();
    mockAuditCreate.mockResolvedValue({});
    const second = authorizeAdoptionFixture();
    const secondManifest = createEvidenceAdoption(second.projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(secondManifest);
    mockTargetFindOne.mockResolvedValue(null);

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: secondManifest.adoptionId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_TARGET_UNAVAILABLE',
      statusCode: 409,
    });
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(second.project.save).not.toHaveBeenCalled();
  });

  it('rejects a reconstructed draft set that drifted from the immutable adoption manifest', async () => {
    const { project, sourceScan, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockSourceScanRunFindOne.mockResolvedValue({
      ...sourceScan,
      result: {
        ...sourceScan.result,
        projectSignals: { ...sourceScan.result.projectSignals, hasTests: false },
      },
    });

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_REJECTED',
      statusCode: 409,
    });

    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
    expect(project.save).not.toHaveBeenCalled();
    expect(JSON.stringify(mockAuditCreate.mock.calls)).not.toContain('src/index.ts');
  });

  it('returns the same ready run for an idempotent adoption replay without creating another run', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const existingRun = createSourceEvidenceRun(manifest, project);
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(existingRun);

    const run = await service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });

    expect(run).toBe(existingRun);
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    expect(mockEvidenceBulkWrite).not.toHaveBeenCalled();
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('recovers the unique pending run after an adoption duplicate-key race without creating a second run', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const racedRun = createSourceEvidenceRun(manifest, project, { projectionStatus: 'pending' });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(racedRun);
    mockEvaluationCreate.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: 11000 })
    );

    const run = await service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });

    expect(run).toBe(racedRun);
    expect(run.projectionStatus).toBe('ready');
    expect(mockEvaluationCreate).toHaveBeenCalledTimes(1);
    expect(mockEvaluationFindOne).toHaveBeenCalledTimes(2);
    expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
      {
        runId: racedRun.runId,
        projectionStatus: 'projecting',
        projectionAttemptId: expect.stringMatching(/^projection-attempt:v1:[a-f0-9]{64}$/),
      },
      expect.objectContaining({ $set: expect.objectContaining({ projectionStatus: 'ready' }) })
    );
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('allows only one concurrent request to own a pending source-evidence projection lease', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const pendingRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'pending',
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(pendingRun);

    let leaseHeld = false;
    mockEvaluationUpdateOne.mockImplementation(async (_filter, update: any) => {
      if (update?.$set?.projectionStatus === 'projecting') {
        if (leaseHeld) return { matchedCount: 0, modifiedCount: 0 };
        leaseHeld = true;
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });

    let signalCleanupStarted!: () => void;
    let releaseInitialCleanup!: () => void;
    const cleanupStarted = new Promise<void>((resolve) => {
      signalCleanupStarted = resolve;
    });
    mockEvidenceDeleteMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseInitialCleanup = () => resolve({ deletedCount: 0 });
          signalCleanupStarted();
        })
    );

    const first = service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });
    await cleanupStarted;

    const second = service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });
    await expect(second).rejects.toMatchObject({
      code: 'PROJECT_GRADE_PROJECTION_IN_PROGRESS',
      statusCode: 409,
    });
    expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(1);
    expect(project.save).not.toHaveBeenCalled();

    releaseInitialCleanup();
    const completed = await first;
    expect(completed.projectionStatus).toBe('ready');
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('fails closed before cleanup when an unexpired projection lease is already held', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const projectingRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'projecting',
      projectionAttemptId: 'projection-attempt:v1:' + 'a'.repeat(64),
      projectionStartedAt: new Date('2026-07-21T12:00:00.000Z'),
      projectionLeaseExpiresAt: new Date('2099-01-01T00:00:00.000Z'),
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(projectingRun);
    mockEvaluationUpdateOne.mockImplementation(async (_filter, update: any) =>
      update?.$set?.projectionStatus === 'projecting'
        ? { matchedCount: 0, modifiedCount: 0 }
        : { matchedCount: 1, modifiedCount: 1 }
    );

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_IN_PROGRESS', statusCode: 409 });

    expect(mockEvidenceDeleteMany).not.toHaveBeenCalled();
    expect(mockFindingDeleteMany).not.toHaveBeenCalled();
    expect(mockSnapshotDeleteMany).not.toHaveBeenCalled();
    expect(project.save).not.toHaveBeenCalled();
  });

  it('takes over an expired projection lease and fences the ready transition by attempt id', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const expiredAttemptId = 'projection-attempt:v1:' + 'b'.repeat(64);
    const projectingRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'projecting',
      projectionAttemptId: expiredAttemptId,
      projectionStartedAt: new Date('2026-07-21T10:00:00.000Z'),
      projectionLeaseExpiresAt: new Date('2026-07-21T10:10:00.000Z'),
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(projectingRun);
    mockEvaluationUpdateOne.mockResolvedValue({ matchedCount: 1, modifiedCount: 1 });

    const run = await service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });

    const leaseCall = mockEvaluationUpdateOne.mock.calls.find(
      ([, update]) => (update as any)?.$set?.projectionStatus === 'projecting'
    );
    expect(leaseCall).toBeDefined();
    expect(leaseCall?.[0]).toEqual(
      expect.objectContaining({
        runId: projectingRun.runId,
        $or: expect.arrayContaining([
          expect.objectContaining({ projectionStatus: 'pending' }),
          expect.objectContaining({ projectionStatus: 'failed' }),
          expect.objectContaining({
            projectionStatus: 'projecting',
            projectionLeaseExpiresAt: { $lte: expect.any(Date) },
          }),
        ]),
      })
    );
    const newAttemptId = (leaseCall?.[1] as any).$set.projectionAttemptId;
    expect(newAttemptId).toMatch(/^projection-attempt:v1:[a-f0-9]{64}$/);
    expect(newAttemptId).not.toBe(expiredAttemptId);
    expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
      {
        runId: projectingRun.runId,
        projectionStatus: 'projecting',
        projectionAttemptId: newAttemptId,
      },
      expect.objectContaining({ $set: expect.objectContaining({ projectionStatus: 'ready' }) })
    );
    expect(run.projectionStatus).toBe('ready');
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('does not compensate or mark failed when a stale attempt loses ownership before ready', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const pendingRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'pending',
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(pendingRun);
    mockEvaluationUpdateOne.mockImplementation(async (_filter, update: any) => {
      if (update?.$set?.projectionStatus === 'projecting') {
        return { matchedCount: 1, modifiedCount: 1 };
      }
      if (update?.$set?.projectionStatus === 'ready') {
        return { matchedCount: 0, modifiedCount: 0 };
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_IN_PROGRESS', statusCode: 409 });

    expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockFindingDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockSnapshotDeleteMany).toHaveBeenCalledTimes(1);
    expect(
      mockEvaluationUpdateOne.mock.calls.some(
        ([, update]) => (update as any)?.$set?.projectionStatus === 'failed'
      )
    ).toBe(false);
    expect(project.save).not.toHaveBeenCalled();
  });
  it('does not compensate after a projection write fails if the attempt loses its lease before cleanup', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const pendingRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'pending',
      evidence: [
        {
          id: 'evidence-lease-loss',
          ruleKey: 'engineering_quality.source_quality_signals',
          dimensionKey: 'engineering_quality',
          level: 'source_static',
          factor: 0.65,
          title: 'Lease fencing evidence',
          description: 'Forces a projection write before compensation fencing.',
          sourceType: 'source_file',
          source: 'server/src/index.ts',
          collectedAt: new Date('2026-07-21T00:00:00.000Z'),
        },
      ],
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(pendingRun);
    mockEvidenceBulkWrite.mockRejectedValueOnce(new Error('projection write unavailable'));

    let renewalCount = 0;
    mockEvaluationUpdateOne.mockImplementation(async (_filter, update: any) => {
      if (update?.$set?.projectionStatus === 'projecting') {
        return { matchedCount: 1, modifiedCount: 1 };
      }
      if (update?.$set?.projectionLeaseExpiresAt) {
        renewalCount += 1;
        return renewalCount < 3
          ? { matchedCount: 1, modifiedCount: 1 }
          : { matchedCount: 0, modifiedCount: 0 };
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_IN_PROGRESS', statusCode: 409 });

    expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockFindingDeleteMany).toHaveBeenCalledTimes(1);
    expect(mockSnapshotDeleteMany).toHaveBeenCalledTimes(1);
    expect(
      mockEvaluationUpdateOne.mock.calls.some(
        ([, update]) => (update as any)?.$set?.projectionStatus === 'failed'
      )
    ).toBe(false);
    expect(project.save).not.toHaveBeenCalled();
  });

  it('allows only one administrator to rebuild a ready projection at a time', async () => {
    const project = createProjectDocument();
    const { projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const readyRun: any = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'ready',
      projectedAt: new Date('2026-07-21T12:10:00.000Z'),
    });
    mockProjectFindOne.mockResolvedValue(project);
    mockEvaluationFindOne.mockResolvedValue(readyRun);

    let leaseHeld = false;
    mockEvaluationUpdateOne.mockImplementation(async (_filter, update: any) => {
      if (update?.$set?.projectionStatus === 'projecting') {
        if (leaseHeld) return { matchedCount: 0, modifiedCount: 0 };
        leaseHeld = true;
        return { matchedCount: 1, modifiedCount: 1 };
      }
      return { matchedCount: 1, modifiedCount: 1 };
    });

    let signalCleanupStarted!: () => void;
    let releaseInitialCleanup!: () => void;
    const cleanupStarted = new Promise<void>((resolve) => {
      signalCleanupStarted = resolve;
    });
    mockEvidenceDeleteMany.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          releaseInitialCleanup = () => resolve({ deletedCount: 0 });
          signalCleanupStarted();
        })
    );

    const first = service.rebuildEvaluationProjection(readyRun.runId, 'owner-1234');
    await cleanupStarted;
    await expect(
      service.rebuildEvaluationProjection(readyRun.runId, 'owner-1234')
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_IN_PROGRESS', statusCode: 409 });
    expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(1);

    releaseInitialCleanup();
    const rebuilt = await first;
    expect(rebuilt.projectionStatus).toBe('ready');
    const acquisitionCall = mockEvaluationUpdateOne.mock.calls.find(
      ([, update]) => (update as any)?.$set?.projectionStatus === 'projecting'
    );
    expect(acquisitionCall?.[0]).toEqual(
      expect.objectContaining({
        runId: readyRun.runId,
        $or: expect.arrayContaining([expect.objectContaining({ projectionStatus: 'ready' })]),
      })
    );
  });

  it('retries an existing failed adoption run through a fenced lease and updates the project summary only after ready', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const failedRun = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'failed',
      projectedAt: new Date('2026-07-21T12:10:00.000Z'),
      projectionError: 'previous failure',
    });
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(failedRun);
    project.save.mockImplementation(async () => {
      expect(failedRun.projectionStatus).toBe('ready');
    });

    const run = await service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
      adoptionId: manifest.adoptionId,
    });

    expect(run).toBe(failedRun);
    expect(mockEvaluationCreate).not.toHaveBeenCalled();
    const acquisitionCall = mockEvaluationUpdateOne.mock.calls.find(
      ([, update]) => (update as any)?.$set?.projectionStatus === 'projecting'
    );
    expect(acquisitionCall?.[0]).toEqual(
      expect.objectContaining({
        runId: failedRun.runId,
        $or: expect.arrayContaining([expect.objectContaining({ projectionStatus: 'failed' })]),
      })
    );
    const projectionAttemptId = (acquisitionCall?.[1] as any).$set.projectionAttemptId;
    expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
      {
        runId: failedRun.runId,
        projectionStatus: 'projecting',
        projectionAttemptId,
      },
      expect.objectContaining({ $set: expect.objectContaining({ projectionStatus: 'ready' }) })
    );
    expect(project.save).toHaveBeenCalledTimes(1);
  });

  it('returns a fixed safe error when EvaluationRun creation fails and never advances the project summary', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(null);
    mockEvaluationCreate.mockRejectedValue(
      new Error('mongodb://admin:secret@localhost/projectgrade failed at G:\\private\\secret.ts')
    );

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_UNAVAILABLE',
      statusCode: 503,
      safeMessage: 'Source evidence evaluation run could not be saved',
    });

    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
    expect(project.save).not.toHaveBeenCalled();
    const auditPayload = JSON.stringify(mockAuditCreate.mock.calls);
    expect(auditPayload).not.toContain('admin:secret');
    expect(auditPayload).not.toContain('G:\\private');
  });

  it.each([
    ['targetId', 'target-drifted'],
    ['sourceScanId', 'scan-drifted'],
    ['sourceScanVersion', 'authorized-source-snapshot/0.0.0'],
    ['snapshotHash', `sha256:${'f'.repeat(64)}`],
    ['draftSetHash', `sha256:${'d'.repeat(64)}`],
    ['sourceEvidenceProjectionVersion', 2],
    ['sourceEvidenceAdoptionVersion', 2],
    ['sourceEvidenceScoringPolicyVersion', 2],
    ['productionVerified', true],
    ['evaluationInputKind', 'baseline'],
  ] as const)(
    'fails closed when an existing adoption run has drifted %s provenance',
    async (field, value) => {
      const { project, projection } = authorizeAdoptionFixture();
      const manifest = createEvidenceAdoption(projection);
      const existingRun = createSourceEvidenceRun(manifest, project, { [field]: value });
      mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
      mockEvaluationFindOne.mockResolvedValue(existingRun);

      await expect(
        service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
          adoptionId: manifest.adoptionId,
        })
      ).rejects.toMatchObject({
        code: 'PROJECT_GRADE_SOURCE_EVIDENCE_RUN_PROVENANCE_MISMATCH',
        statusCode: 409,
      });

      expect(mockEvaluationCreate).not.toHaveBeenCalled();
      expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
      expect(mockEvidenceBulkWrite).not.toHaveBeenCalled();
      expect(project.save).not.toHaveBeenCalled();
      expect(mockAuditCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'source_evidence_evaluate',
          outcome: 'failed',
          errorCode: 'PROJECT_GRADE_SOURCE_EVIDENCE_RUN_PROVENANCE_MISMATCH',
          errorSummary: 'Existing source evidence evaluation no longer matches its adoption',
        })
      );
    }
  );

  it('cleans partial derived records and leaves the project summary unchanged when source evidence projection fails', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
    mockEvaluationFindOne.mockResolvedValue(null);
    mockEvaluationCreate.mockImplementation(async (value) => value);
    mockEvidenceBulkWrite.mockRejectedValueOnce(new Error('projection storage unavailable'));

    await expect(
      service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
        adoptionId: manifest.adoptionId,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_FAILED', statusCode: 503 });

    expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(2);
    expect(mockFindingDeleteMany).toHaveBeenCalledTimes(2);
    expect(mockSnapshotDeleteMany).toHaveBeenCalledTimes(2);
    expect(project.save).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'source_evidence_evaluate',
        outcome: 'failed',
        metadata: expect.objectContaining({ evaluationReady: false, productionVerified: false }),
      })
    );
  });

  it.each(['finding', 'snapshot', 'ready-status'] as const)(
    'compensates a %s projection-stage failure, marks the run failed and redacts sensitive diagnostics',
    async (stage) => {
      const { project, projection } = authorizeAdoptionFixture();
      const manifest = createEvidenceAdoption(projection);
      let persistedRun: any;
      mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
      mockEvaluationFindOne.mockResolvedValue(null);
      mockEvaluationCreate.mockImplementation(async (value) => {
        persistedRun = value;
        return value;
      });
      const sensitiveError = new Error(
        'mongodb://admin:secret@localhost/projectgrade token=super-secret failed at G:\\private\\secret.ts'
      );
      if (stage === 'finding') mockFindingBulkWrite.mockRejectedValueOnce(sensitiveError);
      if (stage === 'snapshot') mockSnapshotBulkWrite.mockRejectedValueOnce(sensitiveError);
      if (stage === 'ready-status') {
        mockEvaluationUpdateOne.mockImplementation(async (_filter, update) => {
          if ((update as any)?.$set?.projectionStatus === 'ready') throw sensitiveError;
          return { modifiedCount: 1 };
        });
      }

      await expect(
        service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
          adoptionId: manifest.adoptionId,
        })
      ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_FAILED', statusCode: 503 });

      expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(2);
      expect(mockFindingDeleteMany).toHaveBeenCalledTimes(2);
      expect(mockSnapshotDeleteMany).toHaveBeenCalledTimes(2);
      expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
        {
          runId: persistedRun.runId,
          projectionStatus: 'projecting',
          projectionAttemptId: expect.stringMatching(/^projection-attempt:v1:[a-f0-9]{64}$/),
        },
        expect.objectContaining({
          $set: expect.objectContaining({ projectionStatus: 'failed' }),
          $unset: { projectedAt: 1, projectionLeaseExpiresAt: 1 },
        })
      );
      expect(persistedRun.projectionStatus).toBe('failed');
      expect(persistedRun.projectionError).toContain('[redacted-mongodb-uri]');
      expect(persistedRun.projectionError).not.toContain('admin:secret');
      expect(persistedRun.projectionError).not.toContain('super-secret');
      expect(persistedRun.projectionError).not.toContain('G:\\private');
      expect(project.save).not.toHaveBeenCalled();
    }
  );

  it('still marks the run failed when initial projection cleanup or compensating cleanup fails', async () => {
    const runScenario = async (compensationFailure: boolean) => {
      jest.clearAllMocks();
      mockAuditCreate.mockResolvedValue({});
      mockEvaluationUpdateOne.mockResolvedValue({ modifiedCount: 1 });
      mockFindingDeleteMany.mockResolvedValue({ deletedCount: 0 });
      mockSnapshotDeleteMany.mockResolvedValue({ deletedCount: 0 });
      const { project, projection } = authorizeAdoptionFixture();
      const manifest = createEvidenceAdoption(projection);
      let persistedRun: any;
      mockEvidenceAdoptionFindOne.mockResolvedValue(manifest);
      mockEvaluationFindOne.mockResolvedValue(null);
      mockEvaluationCreate.mockImplementation(async (value) => {
        persistedRun = value;
        return value;
      });

      if (compensationFailure) {
        mockEvidenceDeleteMany
          .mockResolvedValueOnce({ deletedCount: 0 })
          .mockRejectedValueOnce(new Error('compensating cleanup unavailable'));
        mockEvidenceBulkWrite.mockRejectedValueOnce(new Error('projection write unavailable'));
      } else {
        mockEvidenceDeleteMany
          .mockRejectedValueOnce(new Error('initial cleanup unavailable'))
          .mockResolvedValueOnce({ deletedCount: 0 });
      }

      await expect(
        service.runProjectEvaluationFromSourceEvidence('project-1234', 'owner-1234', {
          adoptionId: manifest.adoptionId,
        })
      ).rejects.toMatchObject({ code: 'PROJECT_GRADE_PROJECTION_FAILED', statusCode: 503 });

      expect(mockEvidenceDeleteMany).toHaveBeenCalledTimes(2);
      expect(mockEvaluationUpdateOne).toHaveBeenCalledWith(
        {
          runId: persistedRun.runId,
          projectionStatus: 'projecting',
          projectionAttemptId: expect.stringMatching(/^projection-attempt:v1:[a-f0-9]{64}$/),
        },
        expect.objectContaining({ $set: expect.objectContaining({ projectionStatus: 'failed' }) })
      );
      expect(persistedRun.projectionStatus).toBe('failed');
      expect(project.save).not.toHaveBeenCalled();
    };

    await runScenario(false);
    await runScenario(true);
  });

  it('recovers expired projection leases in bounded order with a system audit trail', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const expiredLease = new Date('2026-07-21T11:59:00.000Z');
    const run = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'projecting',
      projectionAttemptId: 'projection-attempt:v1:' + 'a'.repeat(64),
      projectionStartedAt: new Date('2026-07-21T11:49:00.000Z'),
      projectionLeaseExpiresAt: expiredLease,
    });
    const limit = jest.fn().mockResolvedValue([run]);
    const sort = jest.fn().mockReturnValue({ limit });
    mockEvaluationFind.mockReturnValue({ sort });

    await expect(
      service.recoverExpiredEvaluationProjections({
        now: new Date('2026-07-21T12:00:00.000Z'),
        limit: 7,
      })
    ).resolves.toEqual({
      scanned: 1,
      recovered: 1,
      skipped: 0,
      failed: 0,
      failures: [],
    });

    expect(mockEvaluationFind).toHaveBeenCalledWith({
      projectionStatus: 'projecting',
      projectionLeaseExpiresAt: { $lte: new Date('2026-07-21T12:00:00.000Z') },
      projectId: { $exists: true },
      targetId: { $exists: true },
      ownerId: { $exists: true },
    });
    expect(sort).toHaveBeenCalledWith({ projectionLeaseExpiresAt: 1, assessedAt: 1 });
    expect(limit).toHaveBeenCalledWith(7);
    expect(run.projectionStatus).toBe('ready');
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'projection_recovery',
        actorId: 'system:project-grade-projection-recovery',
        outcome: 'attempted',
        targetId: run.runId,
      })
    );
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'projection_recovery',
        outcome: 'succeeded',
        metadata: expect.objectContaining({ recovered: true }),
      })
    );
  });

  it('skips an expired run when another worker has already reacquired its lease', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const run = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'projecting',
      projectionAttemptId: 'projection-attempt:v1:' + 'b'.repeat(64),
      projectionLeaseExpiresAt: new Date('2026-07-21T11:59:00.000Z'),
    });
    const limit = jest.fn().mockResolvedValue([run]);
    mockEvaluationFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit }),
    });
    mockEvaluationUpdateOne.mockResolvedValue({ matchedCount: 0, modifiedCount: 0 });
    mockEvaluationFindOne.mockResolvedValue({
      ...run,
      projectionStatus: 'projecting',
      projectionAttemptId: 'projection-attempt:v1:' + 'c'.repeat(64),
      projectionLeaseExpiresAt: new Date('2026-07-21T12:10:00.000Z'),
    });

    await expect(
      service.recoverExpiredEvaluationProjections({
        now: new Date('2026-07-21T12:00:00.000Z'),
      })
    ).resolves.toEqual({
      scanned: 1,
      recovered: 0,
      skipped: 1,
      failed: 0,
      failures: [],
    });

    expect(mockEvidenceDeleteMany).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        outcome: 'succeeded',
        metadata: expect.objectContaining({
          recovered: false,
          skipReason: 'lease_reacquired_elsewhere',
        }),
      })
    );
  });

  it('fails closed per run when the recovery audit start event cannot be persisted', async () => {
    const { project, projection } = authorizeAdoptionFixture();
    const manifest = createEvidenceAdoption(projection);
    const run = createSourceEvidenceRun(manifest, project, {
      projectionStatus: 'projecting',
      projectionLeaseExpiresAt: new Date('2026-07-21T11:59:00.000Z'),
    });
    const limit = jest.fn().mockResolvedValue([run]);
    mockEvaluationFind.mockReturnValue({
      sort: jest.fn().mockReturnValue({ limit }),
    });
    mockAuditCreate.mockRejectedValueOnce(new Error('audit unavailable'));

    await expect(
      service.recoverExpiredEvaluationProjections({
        now: new Date('2026-07-21T12:00:00.000Z'),
      })
    ).resolves.toEqual({
      scanned: 1,
      recovered: 0,
      skipped: 0,
      failed: 1,
      failures: [
        {
          runId: run.runId,
          code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
        },
      ],
    });

    expect(mockEvaluationUpdateOne).not.toHaveBeenCalled();
    expect(mockEvidenceDeleteMany).not.toHaveBeenCalled();
  });

  it('lists only ready evaluation runs for the exact project tenant', async () => {
    const project = createProjectDocument();
    const limit = jest.fn().mockResolvedValue([]);
    const sort = jest.fn().mockReturnValue({ limit });
    mockProjectFindOne.mockResolvedValue(project);
    mockEvaluationFind.mockReturnValue({ sort });

    await expect(
      service.listProjectEvaluationRuns('project-1234', 'owner-1234', 20)
    ).resolves.toEqual([]);

    expect(mockEvaluationFind).toHaveBeenCalledWith({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: { $exists: false },
      projectionStatus: 'ready',
    });
    expect(sort).toHaveBeenCalledWith({ assessedAt: -1 });
    expect(limit).toHaveBeenCalledWith(20);
  });

  it('does not expose pending or failed evaluation runs through the run query', async () => {
    mockEvaluationFindOne.mockResolvedValue(null);

    await expect(
      service.getEvaluationRunForUser('run-pending-1234', 'owner-1234')
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_RUN_NOT_FOUND', statusCode: 404 });

    expect(mockEvaluationFindOne).toHaveBeenCalledWith({
      runId: 'run-pending-1234',
      projectionStatus: 'ready',
    });
    expect(mockProjectFindOne).not.toHaveBeenCalled();
  });

  it('fails closed when a ready run no longer matches the authorized tenant identity', async () => {
    const project = createProjectDocument({ teamId: 'team-1234' });
    mockEvaluationFindOne
      .mockResolvedValueOnce({ runId: 'run-ready-1234', projectId: project.projectId })
      .mockResolvedValueOnce(null);
    mockProjectFindOne.mockResolvedValue(project);

    await expect(
      service.getEvaluationRunForUser('run-ready-1234', 'owner-1234')
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_RUN_NOT_FOUND', statusCode: 404 });

    expect(mockEvaluationFindOne).toHaveBeenNthCalledWith(2, {
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      runId: 'run-ready-1234',
      projectionStatus: 'ready',
    });
  });
  it('denies access to another user personal project', async () => {
    mockProjectFindOne.mockResolvedValue(
      createProjectDocument({
        ownerId: 'owner-1234',
        teamId: undefined,
      })
    );

    await expect(service.getProjectForUser('project-1234', 'intruder-1234')).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_PROJECT_FORBIDDEN',
    });
  });
});
