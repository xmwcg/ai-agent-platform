import { createHash } from 'crypto';
import type { ProjectGradeSourceScanResult } from './source-scan.types';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
  ProjectGradeSourceEvidenceProjectionError,
  projectSourceScanEvidenceDrafts,
  type ProjectGradeSourceScanEvidenceSource,
} from './source-scan-evidence-projection';

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sourceFindingFingerprint(ruleKey: string, filePath: string, line: number): string {
  return sha256(`${ruleKey}\0${filePath}\0${line}`).slice(0, 32);
}

function snapshotHash(files: ProjectGradeSourceScanResult['files']): string {
  const canonical = [...files]
    .sort((left, right) => left.path.localeCompare(right.path))
    .map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}`)
    .join('\n');
  return `sha256:${sha256(canonical)}`;
}

function sourceRun(
  overrides: Partial<ProjectGradeSourceScanEvidenceSource> = {}
): ProjectGradeSourceScanEvidenceSource {
  const files = [
    { path: 'src/index.ts', sizeBytes: 120, sha256: 'a'.repeat(64) },
    { path: 'src/routes/project-grade.ts', sizeBytes: 240, sha256: 'b'.repeat(64) },
  ];
  const result: ProjectGradeSourceScanResult = {
    scanVersion: 'authorized-source-snapshot/0.1.0',
    rootKey: 'aibak_server_repository',
    snapshotHash: snapshotHash(files),
    files,
    findings: [
      {
        ruleKey: 'source.mock_marker',
        severity: 'warning',
        filePath: 'src/index.ts',
        line: 12,
        message: 'scanner-controlled message apiKey=super-secret-value',
        fingerprint: sourceFindingFingerprint('source.mock_marker', 'src/index.ts', 12),
      },
      {
        ruleKey: 'security.suspected_hardcoded_secret',
        severity: 'high',
        filePath: 'src/routes/project-grade.ts',
        line: 34,
        message: 'password=do-not-project-this-value',
        fingerprint: sourceFindingFingerprint(
          'security.suspected_hardcoded_secret',
          'src/routes/project-grade.ts',
          34
        ),
      },
    ],
    routes: [
      {
        framework: 'express',
        method: 'POST',
        routePath: '/api/private?token=do-not-project-this-value',
        filePath: 'src/routes/project-grade.ts',
        line: 50,
      },
    ],
    projectSignals: {
      hasTests: true,
      hasDocker: true,
      hasCi: true,
      hasLicense: false,
      hasPackageManifest: true,
    },
    summary: {
      filesScanned: files.length,
      totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
      findings: 2,
      routes: 1,
    },
    skipped: {
      ignoredDirectories: 2,
      unsupportedExtensions: 3,
      binaryFiles: 1,
      symbolicLinks: 0,
    },
    limits: {
      maxFiles: 5000,
      maxFileBytes: 1024 * 1024,
      maxTotalBytes: 25 * 1024 * 1024,
      timeoutMs: 10_000,
    },
    evidenceScope: 'authorized_local_source_snapshot',
    productionAcceptance: false,
    externalScanningEnabled: false,
    sourceContentPersisted: false,
    executedSourceCode: false,
    installedDependencies: false,
    networkAccessed: false,
  };

  return {
    scanId: 'source-scan-1234',
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    teamId: 'team-1234',
    status: 'succeeded',
    rootKey: result.rootKey,
    scanVersion: result.scanVersion,
    snapshotHash: result.snapshotHash,
    result,
    evidenceScope: 'authorized_local_source_snapshot',
    productionAcceptance: false,
    createdAt: '2026-07-21T08:00:00.000Z',
    ...overrides,
  };
}

function expectProjectionError(
  action: () => unknown,
  code: ProjectGradeSourceEvidenceProjectionError['code']
): void {
  try {
    action();
    throw new Error(`Expected projection error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectGradeSourceEvidenceProjectionError);
    expect((error as ProjectGradeSourceEvidenceProjectionError).code).toBe(code);
  }
}

describe('ProjectGrade SourceScan evidence draft projection', () => {
  it('projects versioned source-static drafts without binding an EvaluationRun or changing score', () => {
    const projection = projectSourceScanEvidenceDrafts(sourceRun());

    expect(PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION).toBe(1);
    expect(projection.projectionVersion).toBe(1);
    expect(projection.scoringDisposition).toBe('draft_only_not_adopted');
    expect(projection.productionAcceptance).toBe(false);
    expect(projection.externalScanningEnabled).toBe(false);
    expect(projection.drafts.length).toBeGreaterThan(0);
    expect(projection.drafts.every((draft) => draft.level === 'source_static')).toBe(true);
    expect(projection.drafts.every((draft) => draft.factor === 0.75)).toBe(true);
    expect(projection.drafts.every((draft) => draft.sourceType === 'source_file')).toBe(true);
    expect(
      projection.drafts.every((draft) => draft.scoringDisposition === 'draft_only_not_adopted')
    ).toBe(true);
    expect(JSON.stringify(projection)).not.toContain('runId');
  });

  it('uses explicit rule and dimension mappings for known source signals and findings', () => {
    const projection = projectSourceScanEvidenceDrafts(sourceRun());
    const mapped = projection.drafts.map((draft) => ({
      kind: draft.kind,
      sourceRuleKey: draft.metadata.sourceRuleKey,
      sourceSignal: draft.metadata.sourceSignal,
      ruleKey: draft.ruleKey,
      dimensionKey: draft.dimensionKey,
    }));

    expect(mapped).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'finding',
          sourceRuleKey: 'source.mock_marker',
          ruleKey: 'functional_reality.baseline',
          dimensionKey: 'functional_reality',
        }),
        expect.objectContaining({
          kind: 'finding',
          sourceRuleKey: 'security.suspected_hardcoded_secret',
          ruleKey: 'security_compliance.baseline',
          dimensionKey: 'security_compliance',
        }),
        expect.objectContaining({
          kind: 'project_signal',
          sourceSignal: 'hasTests',
          ruleKey: 'code_maintainability.baseline',
          dimensionKey: 'code_maintainability',
        }),
        expect.objectContaining({
          kind: 'project_signal',
          sourceSignal: 'hasCi',
          ruleKey: 'devops_reliability.baseline',
          dimensionKey: 'devops_reliability',
        }),
      ])
    );
  });

  it('is deterministic and independent of scanner array order', () => {
    const firstRun = sourceRun();
    const reordered = sourceRun({
      result: {
        ...firstRun.result!,
        files: [...firstRun.result!.files].reverse(),
        findings: [...firstRun.result!.findings].reverse(),
        routes: [...firstRun.result!.routes].reverse(),
      },
    });

    expect(projectSourceScanEvidenceDrafts(reordered)).toEqual(
      projectSourceScanEvidenceDrafts(firstRun)
    );
  });

  it('preserves tenant ownership and makes personal-project team absence explicit', () => {
    const teamProjection = projectSourceScanEvidenceDrafts(sourceRun());
    expect(teamProjection.ownerId).toBe('owner-1234');
    expect(teamProjection.teamId).toBe('team-1234');
    expect(teamProjection.drafts.every((draft) => draft.ownerId === 'owner-1234')).toBe(true);
    expect(teamProjection.drafts.every((draft) => draft.teamId === 'team-1234')).toBe(true);

    const personalProjection = projectSourceScanEvidenceDrafts(sourceRun({ teamId: undefined }));
    expect(personalProjection).not.toHaveProperty('teamId');
    expect(
      personalProjection.drafts.every(
        (draft) => !Object.prototype.hasOwnProperty.call(draft, 'teamId')
      )
    ).toBe(true);
  });

  it('rebuilds an old supported scan with an explicitly selected projection version', () => {
    const run = sourceRun();
    const initial = projectSourceScanEvidenceDrafts(run, { projectionVersion: 1 });
    const rebuilt = projectSourceScanEvidenceDrafts(JSON.parse(JSON.stringify(run)), {
      projectionVersion: 1,
    });

    expect(rebuilt).toEqual(initial);
    expectProjectionError(
      () => projectSourceScanEvidenceDrafts(run, { projectionVersion: 2 as 1 }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION_UNSUPPORTED'
    );
  });

  it('does not project scanner-controlled messages, route literals, source content, or secrets', () => {
    const serialized = JSON.stringify(projectSourceScanEvidenceDrafts(sourceRun()));

    expect(serialized).not.toContain('super-secret-value');
    expect(serialized).not.toContain('do-not-project-this-value');
    expect(serialized).not.toContain('/api/private?token=');
    expect(
      projectSourceScanEvidenceDrafts(sourceRun()).drafts.every(
        (draft) => draft.metadata.sourceContentPersisted === false
      )
    ).toBe(true);
    expect(serialized).not.toContain('src/index.ts:');
  });

  it('fails closed for failed scans, unsafe boundaries, unsupported rules, and inconsistent summaries', () => {
    expectProjectionError(
      () => projectSourceScanEvidenceDrafts(sourceRun({ status: 'failed', result: undefined })),
      'PROJECT_GRADE_SOURCE_EVIDENCE_SOURCE_NOT_PROJECTABLE'
    );

    const unsafe = sourceRun();
    expectProjectionError(
      () =>
        projectSourceScanEvidenceDrafts({
          ...unsafe,
          result: { ...unsafe.result!, networkAccessed: true as false },
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_BOUNDARY'
    );

    const unknownRule = sourceRun();
    expectProjectionError(
      () =>
        projectSourceScanEvidenceDrafts({
          ...unknownRule,
          result: {
            ...unknownRule.result!,
            findings: [
              {
                ...unknownRule.result!.findings[0],
                ruleKey: 'source.future_unmapped_rule',
                fingerprint: sourceFindingFingerprint(
                  'source.future_unmapped_rule',
                  'src/index.ts',
                  12
                ),
              },
            ],
            summary: { ...unknownRule.result!.summary, findings: 1 },
          },
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_RULE_UNMAPPED'
    );

    const inconsistent = sourceRun();
    expectProjectionError(
      () =>
        projectSourceScanEvidenceDrafts({
          ...inconsistent,
          result: {
            ...inconsistent.result!,
            summary: { ...inconsistent.result!.summary, filesScanned: 999 },
          },
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT'
    );
  });

  it('fails closed when paths or source fingerprints do not match the persisted snapshot contract', () => {
    const run = sourceRun();
    expectProjectionError(
      () =>
        projectSourceScanEvidenceDrafts({
          ...run,
          result: {
            ...run.result!,
            findings: [
              {
                ...run.result!.findings[0],
                filePath: 'C:\\private\\secret.ts',
              },
            ],
            summary: { ...run.result!.summary, findings: 1 },
          },
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_PATH'
    );

    expectProjectionError(
      () =>
        projectSourceScanEvidenceDrafts({
          ...run,
          result: {
            ...run.result!,
            findings: [{ ...run.result!.findings[0], fingerprint: '0'.repeat(32) }],
            summary: { ...run.result!.summary, findings: 1 },
          },
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_FINGERPRINT_INVALID'
    );
  });
});
