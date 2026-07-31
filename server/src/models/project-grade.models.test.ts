import { EvaluationRun } from './EvaluationRun';
import { ProjectGradeAuditLog } from './ProjectGradeAuditLog';
import { ProjectGradeEvidence } from './ProjectGradeEvidence';
import { ProjectGradeEvidenceAdoption } from './ProjectGradeEvidenceAdoption';
import { ProjectGradeFinding } from './ProjectGradeFinding';
import { ProjectGradeProject } from './ProjectGradeProject';
import { ProjectGradeReport } from './ProjectGradeReport';
import { ProjectGradeRemediationTask } from './ProjectGradeRemediationTask';
import { ProjectGradeRule } from './ProjectGradeRule';
import { ProjectGradeScanTarget } from './ProjectGradeScanTarget';
import { ProjectGradeScoreSnapshot } from './ProjectGradeScoreSnapshot';
import { ProjectGradeSourceScanRun } from './ProjectGradeSourceScanRun';
import { ProjectGradeUrlScanRun } from './ProjectGradeUrlScanRun';

function indexesOf(model: { schema: { indexes(): unknown } }) {
  return model.schema.indexes() as Array<[Record<string, number>, Record<string, unknown>]>;
}

function hasIndex(
  indexes: Array<[Record<string, number>, Record<string, unknown>]>,
  keys: Record<string, number>,
  option?: { name: string; value: unknown }
) {
  return indexes.some(([actualKeys, options]) => {
    const keysMatch =
      Object.entries(keys).every(([key, direction]) => actualKeys[key] === direction) &&
      Object.keys(actualKeys).length === Object.keys(keys).length;
    return keysMatch && (!option || options?.[option.name] === option.value);
  });
}

function validEvidenceAdoptionData() {
  return {
    adoptionId: `source-adoption:v1:${'a'.repeat(64)}`,
    projectId: 'project-1',
    targetId: 'target-1',
    ownerId: 'owner-1',
    sourceScanId: 'source-scan-1',
    sourceScanVersion: 'authorized-source-snapshot/0.1.0',
    snapshotHash: `sha256:${'b'.repeat(64)}`,
    draftSetHash: `sha256:${'c'.repeat(64)}`,
    projectionVersion: 1,
    adoptionVersion: 1,
    draftCount: 1,
    evidenceIds: [`source-evidence:v1:${'d'.repeat(64)}`],
    createdBy: 'owner-1',
    evidenceScope: 'authorized_local_source_snapshot',
    scoringDisposition: 'adopted_pending_evaluation',
    productionAcceptance: false,
    externalScanningEnabled: false,
  };
}

function validProjectGradeReportData() {
  return {
    reportId: 'report-123456',
    publicId: 'rpt_project_123456',
    runId: 'run-123456',
    projectId: 'project-1',
    tenantId: 'owner-1',
    ownerUserId: 'owner-1',
    publicationVersion: 1,
    contentFingerprint: `sha256:${'a'.repeat(64)}`,
    title: 'AIbak 智评通正式报告',
    projectName: 'Project',
    projectKind: 'ai_application',
    verdict: 'A',
    externalScore: 88.5,
    internalScore: 885,
    gateBlocked: null,
    dimensionSnapshot: [
      {
        dimensionKey: 'product_strategy',
        label: '产品策略',
        weight: 100,
        rawScore: 885,
        normalizedScore: 88.5,
      },
    ],
    findingHighlights: [
      {
        severity: 'P2',
        dimensionKey: 'product_strategy',
        title: '补齐生产验收证据',
      },
    ],
    assessmentScope: {
      mode: 'persisted_internal_repository',
      target: 'AIbak 服务端内部仓库',
      note: 'not production acceptance',
    },
    baselineNote: 'immutable publication snapshot',
    isPublic: true,
    publishedAt: new Date('2026-07-22T00:00:00.000Z'),
    publishedBy: 'owner-1',
    expiresAt: new Date('2026-08-21T00:00:00.000Z'),
    sharedCount: 0,
    immutable: true,
  };
}

function validEvaluationRunData() {
  return {
    runId: 'run-123456',
    projectId: 'project-1',
    targetId: 'target-1',
    ownerId: 'owner-1',
    createdBy: 'owner-1',
    persistenceVersion: 1,
    evaluationInputKind: 'baseline',
    projectionStatus: 'ready',
    projectName: 'Project',
    projectType: 'ai_application',
    projectUrl: 'https://example.com/',
    rulePackKey: 'aibak-projectgrade-core',
    rulePackVersion: '0.1.0',
    assessedAt: new Date('2026-07-21T00:00:00.000Z'),
    rawTotalScore: 0,
    finalTotalScore: 0,
    normalizedScore: 0,
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
    summary: 'baseline',
  };
}

const sourceEvidenceRunProvenance = {
  adoptionId: `source-adoption:v1:${'e'.repeat(64)}`,
  sourceScanId: 'source-scan-1',
  sourceScanVersion: 'authorized-source-snapshot/0.1.0',
  snapshotHash: `sha256:${'f'.repeat(64)}`,
  draftSetHash: `sha256:${'0'.repeat(64)}`,
  sourceEvidenceProjectionVersion: 1,
  sourceEvidenceAdoptionVersion: 1,
  sourceEvidenceScoringPolicyVersion: 1,
};
function validSourceScanRunData() {
  const snapshotHash = 'sha256:' + 'a'.repeat(64);
  return {
    scanId: 'source-scan-1',
    projectId: 'project-1',
    ownerId: 'owner-1',
    createdBy: 'owner-1',
    status: 'succeeded',
    rootKey: 'aibak_server_repository',
    scanVersion: 'project-grade-source-scan-v1',
    snapshotHash,
    result: {
      scanVersion: 'project-grade-source-scan-v1',
      rootKey: 'aibak_server_repository',
      snapshotHash,
      files: [{ path: 'src/index.ts', sizeBytes: 128, sha256: 'b'.repeat(64) }],
      findings: [
        {
          ruleKey: 'source.hardcoded-secret-marker',
          severity: 'high',
          filePath: 'src/index.ts',
          line: 1,
          message: 'Potential secret marker detected; value was not persisted',
          fingerprint: 'c'.repeat(32),
        },
      ],
      routes: [
        {
          framework: 'express',
          method: 'GET',
          routePath: '/health',
          filePath: 'src/index.ts',
          line: 1,
        },
      ],
      projectSignals: {
        hasTests: true,
        hasDocker: true,
        hasCi: true,
        hasLicense: false,
        hasPackageManifest: true,
      },
      summary: { filesScanned: 1, totalBytes: 128, findings: 1, routes: 1 },
      skipped: {
        ignoredDirectories: 0,
        unsupportedExtensions: 0,
        binaryFiles: 0,
        symbolicLinks: 0,
      },
      limits: { maxFiles: 100, maxFileBytes: 1024, maxTotalBytes: 4096, timeoutMs: 1000 },
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
  };
}
describe('ProjectGrade Batch 0 persistence models', () => {
  it('restricts persisted projects to the three initial supported project types', () => {
    const projectType = ProjectGradeProject.schema.path('projectType') as any;
    expect(projectType.enumValues).toEqual(['website', 'saas', 'ai_application']);

    const status = ProjectGradeProject.schema.path('status') as any;
    expect(status.enumValues).toEqual(['active', 'archived']);
  });

  it('uses unique public identifiers and immutable resource ownership fields', () => {
    const projectIndexes = indexesOf(ProjectGradeProject);
    const targetIndexes = indexesOf(ProjectGradeScanTarget);

    expect(hasIndex(projectIndexes, { projectId: 1 }, { name: 'unique', value: true })).toBe(true);
    expect(hasIndex(targetIndexes, { targetId: 1 }, { name: 'unique', value: true })).toBe(true);
    expect(
      hasIndex(targetIndexes, { projectId: 1, scopeKey: 1 }, { name: 'unique', value: true })
    ).toBe(true);

    for (const field of ['ownerId', 'teamId', 'createdBy']) {
      expect(ProjectGradeProject.schema.path(field).options.immutable).toBe(true);
    }
    for (const field of ['projectId', 'ownerId', 'teamId', 'kind', 'scopeKey', 'createdBy']) {
      expect(ProjectGradeScanTarget.schema.path(field).options.immutable).toBe(true);
    }
  });

  it('versions rule uniqueness by rule pack instead of making rule key globally unique', () => {
    const indexes = indexesOf(ProjectGradeRule);

    expect(ProjectGradeRule.schema.path('key').options.unique).not.toBe(true);
    expect(
      hasIndex(
        indexes,
        { rulePackKey: 1, rulePackVersion: 1, key: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);
    expect(hasIndex(indexes, { key: 1 }, { name: 'unique', value: true })).toBe(false);
  });

  it('keeps persisted evaluation ownership and source evidence provenance immutable', () => {
    for (const field of [
      'runId',
      'projectId',
      'targetId',
      'ownerId',
      'teamId',
      'createdBy',
      'persistenceVersion',
      'evaluationInputKind',
      'adoptionId',
      'sourceScanId',
      'sourceScanVersion',
      'snapshotHash',
      'draftSetHash',
      'sourceEvidenceProjectionVersion',
      'sourceEvidenceAdoptionVersion',
      'sourceEvidenceScoringPolicyVersion',
      'projectName',
    ]) {
      expect(EvaluationRun.schema.path(field).options.immutable).toBe(true);
    }
    expect(EvaluationRun.schema.path('persistenceVersion').options.default).toBe(1);
    expect(EvaluationRun.schema.path('persistenceVersion').options.min).toBe(1);

    const indexes = indexesOf(EvaluationRun);
    expect(hasIndex(indexes, { projectId: 1, assessedAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { ownerId: 1, assessedAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { teamId: 1, assessedAt: -1 })).toBe(true);

    const adoptionIndex = indexes.find(
      ([keys]) => keys.adoptionId === 1 && Object.keys(keys).length === 1
    );
    expect(adoptionIndex?.[1]).toMatchObject({
      unique: true,
      partialFilterExpression: { evaluationInputKind: 'source_evidence_adoption' },
    });
  });

  it('requires complete non-production provenance for source evidence evaluation runs', () => {
    const validRun = new EvaluationRun({
      ...validEvaluationRunData(),
      evaluationInputKind: 'source_evidence_adoption',
      ...sourceEvidenceRunProvenance,
    });
    expect(validRun.validateSync()).toBeUndefined();

    for (const field of Object.keys(sourceEvidenceRunProvenance)) {
      const provenance = { ...sourceEvidenceRunProvenance } as Record<string, unknown>;
      delete provenance[field];
      const run = new EvaluationRun({
        ...validEvaluationRunData(),
        evaluationInputKind: 'source_evidence_adoption',
        ...provenance,
      });
      expect(run.validateSync()?.errors.evaluationInputKind).toBeDefined();
    }

    const productionClaim = new EvaluationRun({
      ...validEvaluationRunData(),
      evaluationInputKind: 'source_evidence_adoption',
      ...sourceEvidenceRunProvenance,
      productionVerified: true,
    });
    expect(productionClaim.validateSync()?.errors.evaluationInputKind).toBeDefined();
  });

  it('rejects adoption provenance on baseline evaluation runs', () => {
    expect(new EvaluationRun(validEvaluationRunData()).validateSync()).toBeUndefined();

    for (const [field, value] of Object.entries(sourceEvidenceRunProvenance)) {
      const run = new EvaluationRun({ ...validEvaluationRunData(), [field]: value });
      expect(run.validateSync()?.errors.evaluationInputKind).toBeDefined();
    }
  });
  it('tracks immutable run snapshots separately from idempotent query projections', () => {
    const projectionStatus = EvaluationRun.schema.path('projectionStatus') as any;
    expect(projectionStatus.enumValues).toEqual(['pending', 'projecting', 'ready', 'failed']);
    expect(projectionStatus.options.default).toBe('pending');
    expect(EvaluationRun.schema.path('projectionAttemptId')).toBeDefined();
    expect(EvaluationRun.schema.path('projectionStartedAt')).toBeDefined();
    expect(EvaluationRun.schema.path('projectionLeaseExpiresAt')).toBeDefined();
    expect(
      hasIndex(indexesOf(EvaluationRun), { projectionStatus: 1, projectionLeaseExpiresAt: 1 })
    ).toBe(true);

    expect(
      hasIndex(
        indexesOf(ProjectGradeEvidence),
        { runId: 1, evidenceId: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);
    expect(
      hasIndex(
        indexesOf(ProjectGradeFinding),
        { runId: 1, fingerprint: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);
    expect(
      hasIndex(
        indexesOf(ProjectGradeScoreSnapshot),
        { runId: 1, dimensionKey: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);

    const workflow = ProjectGradeFinding.schema.path('currentStatus') as any;
    expect(workflow.enumValues).toEqual([
      'open',
      'in_progress',
      'ready_for_retest',
      'verified',
      'accepted_risk',
      'false_positive',
    ]);
  });

  it('stores URL scan history separately from EvaluationRun scoring truth', () => {
    const status = ProjectGradeUrlScanRun.schema.path('status') as any;
    const evidenceScope = ProjectGradeUrlScanRun.schema.path('evidenceScope') as any;
    const productionAcceptance = ProjectGradeUrlScanRun.schema.path('productionAcceptance') as any;

    expect(status.enumValues).toEqual(['succeeded', 'failed']);
    expect(evidenceScope.enumValues).toEqual(['single_server_http_observation']);
    expect(productionAcceptance.options.default).toBe(false);
    expect(productionAcceptance.options.validate.validator(false)).toBe(true);
    expect(productionAcceptance.options.validate.validator(true)).toBe(false);
    expect(ProjectGradeUrlScanRun.schema.path('scanId').options.unique).toBe(true);

    for (const field of [
      'scanId',
      'projectId',
      'ownerId',
      'teamId',
      'createdBy',
      'status',
      'requestedUrl',
      'finalUrl',
      'scanVersion',
      'statusCode',
      'durationMs',
      'result',
      'errorCode',
      'errorSummary',
      'evidenceScope',
      'productionAcceptance',
    ]) {
      expect(ProjectGradeUrlScanRun.schema.path(field).options.immutable).toBe(true);
    }

    const indexes = indexesOf(ProjectGradeUrlScanRun);
    expect(hasIndex(indexes, { projectId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { ownerId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { teamId: 1, createdAt: -1 })).toBe(true);
    expect(ProjectGradeUrlScanRun.modelName).not.toBe(EvaluationRun.modelName);
  });

  it('stores source scan history separately with immutable non-production evidence boundaries', () => {
    const status = ProjectGradeSourceScanRun.schema.path('status') as any;
    const evidenceScope = ProjectGradeSourceScanRun.schema.path('evidenceScope') as any;
    const productionAcceptance = ProjectGradeSourceScanRun.schema.path(
      'productionAcceptance'
    ) as any;

    expect(status.enumValues).toEqual(['succeeded', 'failed']);
    expect(evidenceScope.enumValues).toEqual(['authorized_local_source_snapshot']);
    expect(productionAcceptance.options.default).toBe(false);
    expect(productionAcceptance.options.validate.validator(false)).toBe(true);
    expect(productionAcceptance.options.validate.validator(true)).toBe(false);
    expect(ProjectGradeSourceScanRun.schema.path('scanId').options.unique).toBe(true);

    for (const field of [
      'scanId',
      'projectId',
      'ownerId',
      'teamId',
      'createdBy',
      'status',
      'rootKey',
      'scanVersion',
      'snapshotHash',
      'result',
      'errorCode',
      'errorSummary',
      'evidenceScope',
      'productionAcceptance',
    ]) {
      expect(ProjectGradeSourceScanRun.schema.path(field).options.immutable).toBe(true);
    }

    const indexes = indexesOf(ProjectGradeSourceScanRun);
    expect(hasIndex(indexes, { projectId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { ownerId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { teamId: 1, createdAt: -1 })).toBe(true);
    expect(ProjectGradeSourceScanRun.modelName).not.toBe(EvaluationRun.modelName);
  });

  it('validates a strict successful source scan snapshot without persisting source content', () => {
    const run = new ProjectGradeSourceScanRun(validSourceScanRunData());
    expect(run.validateSync()).toBeUndefined();
    expect(run.result?.files[0]?.path).toBe('src/index.ts');
    expect(run.result).not.toHaveProperty('sourceContent');
  });

  it('rejects unknown source result fields instead of silently persisting secret-bearing payloads', () => {
    const data = validSourceScanRunData();
    const unsafeResult = { ...data.result, sourceContent: 'apiKey=super-secret' };

    const run = new ProjectGradeSourceScanRun({ ...data, result: unsafeResult });
    expect(run.validateSync()).toBeDefined();
  });

  it('rejects absolute or traversing paths at the model persistence boundary', () => {
    for (const unsafePath of ['C:\\private\\secret.ts', '/private/secret.ts', '../secret.ts']) {
      const data = validSourceScanRunData();
      const run = new ProjectGradeSourceScanRun({
        ...data,
        result: {
          ...data.result,
          files: [{ ...data.result.files[0], path: unsafePath }],
        },
      });

      expect(run.validateSync()).toBeDefined();
    }
  });

  it('requires complete evidence for succeeded runs and forbids result payloads on failed runs', () => {
    const succeeded = new ProjectGradeSourceScanRun({
      ...validSourceScanRunData(),
      scanVersion: undefined,
      snapshotHash: undefined,
      result: undefined,
    });
    expect(succeeded.validateSync()).toBeDefined();

    const failed = new ProjectGradeSourceScanRun({
      ...validSourceScanRunData(),
      status: 'failed',
      errorCode: 'PROJECT_GRADE_SOURCE_SCAN_FAILED',
      errorSummary: '源码扫描失败',
    });
    expect(failed.validateSync()).toBeDefined();
  });

  it('keeps every persisted source safety assertion fixed to false', () => {
    const data = validSourceScanRunData();
    const run = new ProjectGradeSourceScanRun({
      ...data,
      result: { ...data.result, networkAccessed: true },
    });
    expect(run.validateSync()).toBeDefined();
  });
  it('enforces one remediation task per finding and auditable workflow states', () => {
    const taskStatus = ProjectGradeRemediationTask.schema.path('status') as any;
    expect(taskStatus.enumValues).toEqual([
      'open',
      'in_progress',
      'blocked',
      'ready_for_retest',
      'verified',
      'cancelled',
    ]);
    expect(
      hasIndex(
        indexesOf(ProjectGradeRemediationTask),
        { projectId: 1, findingId: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);
    for (const field of [
      'taskId',
      'projectId',
      'sourceRunId',
      'findingId',
      'findingFingerprint',
      'ownerId',
      'teamId',
      'severity',
      'createdBy',
    ]) {
      expect(ProjectGradeRemediationTask.schema.path(field).options.immutable).toBe(true);
    }
  });

  it('enforces immutable, versioned source evidence adoption manifests', () => {
    const manifest = new ProjectGradeEvidenceAdoption(validEvidenceAdoptionData());
    expect(manifest.validateSync()).toBeUndefined();
    expect(ProjectGradeEvidenceAdoption.schema.options.strict).toBe('throw');

    for (const field of [
      'adoptionId',
      'projectId',
      'targetId',
      'ownerId',
      'teamId',
      'sourceScanId',
      'sourceScanVersion',
      'snapshotHash',
      'draftSetHash',
      'projectionVersion',
      'adoptionVersion',
      'draftCount',
      'evidenceIds',
      'createdBy',
      'evidenceScope',
      'scoringDisposition',
      'productionAcceptance',
      'externalScanningEnabled',
    ]) {
      expect(ProjectGradeEvidenceAdoption.schema.path(field).options.immutable).toBe(true);
    }

    const indexes = indexesOf(ProjectGradeEvidenceAdoption);
    expect(hasIndex(indexes, { adoptionId: 1 }, { name: 'unique', value: true })).toBe(true);
    expect(
      hasIndex(
        indexes,
        { projectId: 1, targetId: 1, sourceScanId: 1, adoptionVersion: 1 },
        { name: 'unique', value: true }
      )
    ).toBe(true);
  });

  it('rejects unsafe or internally inconsistent evidence adoption manifests', () => {
    expect(
      () => new ProjectGradeEvidenceAdoption({ ...validEvidenceAdoptionData(), injected: true })
    ).toThrow();

    for (const overrides of [
      { snapshotHash: 'sha256:bad' },
      { draftSetHash: 'bad' },
      { adoptionVersion: 2 },
      { draftCount: 0 },
      { draftCount: 1.5 },
      { evidenceIds: [] },
      { evidenceIds: ['invalid-evidence-id'] },
      {
        evidenceIds: [
          `source-evidence:v1:${'d'.repeat(64)}`,
          `source-evidence:v1:${'d'.repeat(64)}`,
        ],
      },
      { productionAcceptance: true },
      { externalScanningEnabled: true },
      { ownerId: undefined },
      { createdBy: undefined },
    ]) {
      const manifest = new ProjectGradeEvidenceAdoption({
        ...validEvidenceAdoptionData(),
        ...overrides,
      });
      expect(manifest.validateSync()).toBeDefined();
    }
  });

  it('stores immutable formal report content with mutable publication lifecycle and unique lookup indexes', () => {
    const report = new ProjectGradeReport(validProjectGradeReportData());
    expect(report.validateSync()).toBeUndefined();

    for (const field of [
      'reportId',
      'publicId',
      'runId',
      'projectId',
      'tenantId',
      'ownerUserId',
      'publicationVersion',
      'contentFingerprint',
      'title',
      'projectName',
      'projectKind',
      'verdict',
      'externalScore',
      'internalScore',
      'gateBlocked',
      'dimensionSnapshot',
      'findingHighlights',
      'assessmentScope',
      'baselineNote',
      'immutable',
    ]) {
      expect(ProjectGradeReport.schema.path(field).options.immutable).toBe(true);
    }

    for (const field of [
      'isPublic',
      'publishedAt',
      'publishedBy',
      'expiresAt',
      'revokedAt',
      'revokedBy',
      'revocationReason',
      'sharedCount',
    ]) {
      expect(ProjectGradeReport.schema.path(field).options.immutable).not.toBe(true);
    }

    const indexes = indexesOf(ProjectGradeReport);
    expect(hasIndex(indexes, { reportId: 1 }, { name: 'unique', value: true })).toBe(true);
    expect(hasIndex(indexes, { publicId: 1 }, { name: 'unique', value: true })).toBe(true);
    expect(hasIndex(indexes, { runId: 1 }, { name: 'unique', value: true })).toBe(true);
    const runIndex = indexes.find(([keys]) => keys.runId === 1 && Object.keys(keys).length === 1);
    expect(runIndex?.[1].partialFilterExpression).toEqual({ immutable: true });
    expect(hasIndex(indexes, { contentFingerprint: 1 }, { name: 'sparse', value: true })).toBe(
      true
    );

    const keySignature = (keys: Record<string, number>) => JSON.stringify(Object.entries(keys));
    const uniqueIndexSignatures = indexes
      .filter(([, options]) => options.unique === true)
      .map(([keys]) => keySignature(keys));
    expect(new Set(uniqueIndexSignatures).size).toBe(uniqueIndexSignatures.length);

    const invalidFingerprint = new ProjectGradeReport({
      ...validProjectGradeReportData(),
      reportId: 'report-654321',
      publicId: 'rpt_project_654321',
      runId: 'run-654321',
      contentFingerprint: 'sha256:bad',
    });
    expect(invalidFingerprint.validateSync()?.errors.contentFingerprint).toBeDefined();
  });

  it('uses an immutable append-only audit ledger with correlated query indexes', () => {
    const action = ProjectGradeAuditLog.schema.path('action') as any;
    const outcome = ProjectGradeAuditLog.schema.path('outcome') as any;
    const targetType = ProjectGradeAuditLog.schema.path('targetType') as any;

    expect(action.enumValues).toEqual([
      'finding_workflow_update',
      'remediation_create',
      'remediation_update',
      'projection_rebuild',
      'projection_recovery',
      'url_scan_execute',
      'source_scan_execute',
      'source_evidence_adopt',
      'source_evidence_evaluate',
      'report_publish',
      'report_revoke',
      'report_download',
    ]);
    expect(outcome.enumValues).toEqual(['attempted', 'succeeded', 'failed']);
    expect(targetType.enumValues).toEqual([
      'finding',
      'remediation',
      'evaluation_run',
      'url_scan',
      'source_scan',
      'evidence_adoption',
      'report',
    ]);
    expect(ProjectGradeAuditLog.schema.path('auditId').options.unique).toBe(true);
    expect(ProjectGradeAuditLog.schema.options.timestamps).toEqual({
      createdAt: true,
      updatedAt: false,
    });

    for (const field of [
      'auditId',
      'operationId',
      'projectId',
      'ownerId',
      'teamId',
      'actorId',
      'action',
      'outcome',
      'targetType',
      'targetId',
      'fromStatus',
      'toStatus',
      'reason',
      'errorCode',
      'errorSummary',
      'metadata',
    ]) {
      expect(ProjectGradeAuditLog.schema.path(field).options.immutable).toBe(true);
    }

    const indexes = indexesOf(ProjectGradeAuditLog);
    expect(hasIndex(indexes, { projectId: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { operationId: 1, createdAt: 1 })).toBe(true);
    expect(hasIndex(indexes, { projectId: 1, action: 1, createdAt: -1 })).toBe(true);
    expect(hasIndex(indexes, { projectId: 1, ownerId: 1, teamId: 1, createdAt: -1 })).toBe(true);
    expect(indexes.every(([, options]) => options.expireAfterSeconds === undefined)).toBe(true);
  });
});
