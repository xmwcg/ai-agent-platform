import type { IProjectGradeEvidenceAdoption } from '../models/ProjectGradeEvidenceAdoption';
import type {
  ProjectGradeSourceEvidenceDraft,
  ProjectGradeSourceEvidenceProjection,
} from './source-scan-evidence-projection';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
  ProjectGradeSourceEvidenceEvaluationError,
  evaluateAdoptedSourceEvidence,
} from './source-evidence-adoption-evaluation';

const sha256 = (character: string): string => `sha256:${character.repeat(64)}`;
const evidenceId = (character: string): string => `source-evidence:v1:${character.repeat(64)}`;

function draft(
  id: string,
  kind: ProjectGradeSourceEvidenceDraft['kind'],
  ruleKey: string,
  dimensionKey: ProjectGradeSourceEvidenceDraft['dimensionKey'],
  metadata: Partial<ProjectGradeSourceEvidenceDraft['metadata']> = {}
): ProjectGradeSourceEvidenceDraft {
  return {
    evidenceId: id,
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    teamId: 'team-1234',
    rulePackKey: 'aibak-projectgrade-core',
    rulePackVersion: '0.1.0',
    ruleKey,
    dimensionKey,
    level: 'source_static',
    factor: 0.75,
    sourceType: 'source_file',
    source: `projectgrade-source-scan:${sha256('b')}`,
    collectedAt: '2026-07-21T08:00:00.000Z',
    title: `${kind} evidence`,
    description: `${kind} evidence description`,
    kind,
    metadata: {
      projectionVersion: 1,
      sourceScanId: 'source-scan-1234',
      sourceScanVersion: 'authorized-source-snapshot/0.1.0',
      snapshotHash: sha256('b'),
      sourceEvidenceKind: kind,
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
      ...metadata,
    },
    projectionVersion: 1,
    scoringDisposition: 'draft_only_not_adopted',
  };
}

function projection(): ProjectGradeSourceEvidenceProjection {
  const drafts = [
    draft(
      evidenceId('1'),
      'snapshot_manifest',
      'architecture_engineering.baseline',
      'architecture_engineering'
    ),
    draft(
      evidenceId('2'),
      'project_signal',
      'architecture_engineering.baseline',
      'architecture_engineering',
      { sourceSignal: 'hasPackageManifest' }
    ),
    draft(
      evidenceId('3'),
      'project_signal',
      'code_maintainability.baseline',
      'code_maintainability',
      { sourceSignal: 'hasTests' }
    ),
    draft(
      evidenceId('4'),
      'project_signal',
      'devops_reliability.baseline',
      'devops_reliability',
      { sourceSignal: 'hasDocker' }
    ),
    draft(
      evidenceId('5'),
      'project_signal',
      'devops_reliability.baseline',
      'devops_reliability',
      { sourceSignal: 'hasCi' }
    ),
    draft(
      evidenceId('6'),
      'route_inventory',
      'requirements_completeness.baseline',
      'requirements_completeness'
    ),
    draft(
      evidenceId('7'),
      'finding',
      'code_maintainability.baseline',
      'code_maintainability',
      {
        sourceRuleKey: 'source.todo',
        sourceFindingFingerprint: '1'.repeat(32),
        sourceFindingSeverity: 'info',
        filePath: 'src/todo.ts',
        line: 10,
      }
    ),
    draft(
      evidenceId('8'),
      'finding',
      'code_maintainability.baseline',
      'code_maintainability',
      {
        sourceRuleKey: 'source.fixme',
        sourceFindingFingerprint: '2'.repeat(32),
        sourceFindingSeverity: 'warning',
        filePath: 'src/fixme.ts',
        line: 20,
      }
    ),
    draft(
      evidenceId('9'),
      'finding',
      'functional_reality.baseline',
      'functional_reality',
      {
        sourceRuleKey: 'source.mock_marker',
        sourceFindingFingerprint: '3'.repeat(32),
        sourceFindingSeverity: 'warning',
        filePath: 'src/mock.ts',
        line: 30,
      }
    ),
    draft(
      evidenceId('a'),
      'finding',
      'security_compliance.baseline',
      'security_compliance',
      {
        sourceRuleKey: 'security.suspected_hardcoded_secret',
        sourceFindingFingerprint: '4'.repeat(32),
        sourceFindingSeverity: 'high',
        filePath: 'src/secret.ts',
        line: 40,
      }
    ),
  ].sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

  return {
    projectionVersion: 1,
    sourceScanId: 'source-scan-1234',
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    teamId: 'team-1234',
    sourceScanVersion: 'authorized-source-snapshot/0.1.0',
    snapshotHash: sha256('b'),
    draftSetHash: sha256('c'),
    collectedAt: '2026-07-21T08:00:00.000Z',
    evidenceScope: 'authorized_local_source_snapshot',
    scoringDisposition: 'draft_only_not_adopted',
    productionAcceptance: false,
    externalScanningEnabled: false,
    drafts,
  };
}

function adoption(
  sourceProjection = projection()
): Pick<
  IProjectGradeEvidenceAdoption,
  | 'adoptionId'
  | 'projectId'
  | 'targetId'
  | 'ownerId'
  | 'teamId'
  | 'sourceScanId'
  | 'sourceScanVersion'
  | 'snapshotHash'
  | 'draftSetHash'
  | 'projectionVersion'
  | 'adoptionVersion'
  | 'draftCount'
  | 'evidenceIds'
  | 'evidenceScope'
  | 'scoringDisposition'
  | 'productionAcceptance'
  | 'externalScanningEnabled'
> {
  return {
    adoptionId: `source-adoption:v1:${'d'.repeat(64)}`,
    projectId: sourceProjection.projectId,
    targetId: 'target-1234',
    ownerId: sourceProjection.ownerId,
    teamId: sourceProjection.teamId,
    sourceScanId: sourceProjection.sourceScanId,
    sourceScanVersion: sourceProjection.sourceScanVersion,
    snapshotHash: sourceProjection.snapshotHash,
    draftSetHash: sourceProjection.draftSetHash,
    projectionVersion: sourceProjection.projectionVersion,
    adoptionVersion: 1,
    draftCount: sourceProjection.drafts.length,
    evidenceIds: sourceProjection.drafts.map((item) => item.evidenceId),
    evidenceScope: 'authorized_local_source_snapshot',
    scoringDisposition: 'adopted_pending_evaluation',
    productionAcceptance: false,
    externalScanningEnabled: false,
  };
}

function expectEvaluationError(action: () => unknown, code: string): void {
  try {
    action();
    throw new Error(`Expected source evidence evaluation error ${code}`);
  } catch (error) {
    expect(error).toBeInstanceOf(ProjectGradeSourceEvidenceEvaluationError);
    expect((error as ProjectGradeSourceEvidenceEvaluationError).code).toBe(code);
  }
}

describe('ProjectGrade adopted source evidence evaluation policy', () => {
  it('caps positive static signals at 0.25 per rule while trace-only and finding evidence add no completion', () => {
    const sourceProjection = projection();
    const result = evaluateAdoptedSourceEvidence({
      adoption: adoption(sourceProjection),
      projection: sourceProjection,
    });
    const inputs = new Map(result.ruleInputs.map((input) => [input.ruleKey, input]));

    expect(PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION).toBe(1);
    expect(result.policyVersion).toBe(1);
    expect(result.productionVerified).toBe(false);
    expect(result.evidence).toHaveLength(sourceProjection.drafts.length);
    expect(inputs.get('devops_reliability.baseline')).toMatchObject({ completion: 0.25 });
    expect(inputs.get('devops_reliability.baseline')?.evidence).toHaveLength(2);
    expect(inputs.get('architecture_engineering.baseline')).toMatchObject({ completion: 0.25 });
    expect(inputs.get('code_maintainability.baseline')).toMatchObject({ completion: 0.25 });
    expect(inputs.get('requirements_completeness.baseline')).toMatchObject({ completion: 0 });
    expect(inputs.get('functional_reality.baseline')).toMatchObject({ completion: 0 });
    expect(inputs.get('security_compliance.baseline')).toMatchObject({ completion: 0 });
  });

  it('maps explicit source finding rules to fail-closed release-gate severities', () => {
    const sourceProjection = projection();
    const result = evaluateAdoptedSourceEvidence({
      adoption: adoption(sourceProjection),
      projection: sourceProjection,
    });
    const severities = Object.fromEntries(
      result.findings.map((finding) => [
        result.evidence.find((item) => item.id === finding.evidenceIds[0])?.metadata
          ?.sourceRuleKey as string,
        finding.severity,
      ])
    );

    expect(severities).toEqual({
      'source.todo': 'P3',
      'source.fixme': 'P2',
      'source.mock_marker': 'P1',
      'security.suspected_hardcoded_secret': 'P0',
    });
  });

  it('produces deterministic ordered IDs and preserves immutable adoption provenance', () => {
    const sourceProjection = projection();
    const input = { adoption: adoption(sourceProjection), projection: sourceProjection };
    const first = evaluateAdoptedSourceEvidence(input);
    const second = evaluateAdoptedSourceEvidence(input);

    expect(second).toEqual(first);
    expect(first.evidence.map((item) => item.id)).toEqual(input.adoption.evidenceIds);
    expect(first.findings.map((item) => item.id)).toEqual(
      [...first.findings.map((item) => item.id)].sort()
    );
    expect(first.evidence[0].metadata).toMatchObject({
      sourceEvidenceAdoptionId: input.adoption.adoptionId,
      sourceEvidenceAdoptionVersion: 1,
      sourceEvidenceScoringPolicyVersion: 1,
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
    });
    expect(first.evidence.every((item) => item.level === 'source_static')).toBe(true);
    expect(first.evidence.every((item) => item.factor === 0.75)).toBe(true);
    expect(first.evidence.every((item) => item.verifiedAt === undefined)).toBe(true);
  });

  it('fails closed on manifest hash, count, identity or evidence ID drift', () => {
    const sourceProjection = projection();
    const baseAdoption = adoption(sourceProjection);
    const cases = [
      { ...baseAdoption, draftSetHash: sha256('e') },
      { ...baseAdoption, snapshotHash: sha256('e') },
      { ...baseAdoption, draftCount: baseAdoption.draftCount + 1 },
      { ...baseAdoption, evidenceIds: [...baseAdoption.evidenceIds].reverse() },
      { ...baseAdoption, projectId: 'project-other' },
    ];

    for (const changedAdoption of cases) {
      expectEvaluationError(
        () =>
          evaluateAdoptedSourceEvidence({
            adoption: changedAdoption,
            projection: sourceProjection,
          }),
        'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_MANIFEST_MISMATCH'
      );
    }
  });

  it('fails closed on unknown kinds, signals, source rules and severity mismatches', () => {
    const cases: Array<(drafts: ProjectGradeSourceEvidenceDraft[]) => void> = [
      (drafts) => {
        (drafts[0] as unknown as { kind: string }).kind = 'unknown_kind';
      },
      (drafts) => {
        drafts.find((item) => item.kind === 'project_signal')!.metadata.sourceSignal =
          'unknown_signal' as ProjectGradeSourceEvidenceDraft['metadata']['sourceSignal'];
      },
      (drafts) => {
        drafts.find((item) => item.kind === 'finding')!.metadata.sourceRuleKey =
          'source.unknown';
      },
      (drafts) => {
        drafts.find(
          (item) => item.metadata.sourceRuleKey === 'security.suspected_hardcoded_secret'
        )!.metadata.sourceFindingSeverity = 'warning';
      },
    ];

    for (const mutate of cases) {
      const sourceProjection = projection();
      mutate(sourceProjection.drafts);
      expectEvaluationError(
        () =>
          evaluateAdoptedSourceEvidence({
            adoption: adoption(sourceProjection),
            projection: sourceProjection,
          }),
        'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED'
      );
    }
  });

  it('rejects unsupported projection, adoption and scoring policy versions', () => {
    const sourceProjection = projection();
    expectEvaluationError(
      () =>
        evaluateAdoptedSourceEvidence({
          adoption: { ...adoption(sourceProjection), adoptionVersion: 2 as 1 },
          projection: sourceProjection,
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_VERSION_UNSUPPORTED'
    );
    expectEvaluationError(
      () =>
        evaluateAdoptedSourceEvidence({
          adoption: { ...adoption(sourceProjection), projectionVersion: 2 },
          projection: sourceProjection,
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_VERSION_UNSUPPORTED'
    );
    expectEvaluationError(
      () =>
        evaluateAdoptedSourceEvidence({
          adoption: adoption(sourceProjection),
          projection: sourceProjection,
          policyVersion: 2,
        }),
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_VERSION_UNSUPPORTED'
    );
  });
});

