import { createHash } from 'crypto';
import type { IProjectGradeEvidenceAdoption } from '../models/ProjectGradeEvidenceAdoption';
import {
  DEFAULT_PROJECT_GRADE_RULES,
  EVIDENCE_FACTORS,
  type FindingSeverity,
  type ProjectGradeDimensionKey,
} from './config';
import {
  createFindingFingerprint,
  type ProjectGradeEvidence,
  type ProjectGradeFinding,
  type RuleEvaluationInput,
} from './engine';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
  type ProjectGradeSourceEvidenceDraft,
  type ProjectGradeSourceEvidenceProjection,
} from './source-scan-evidence-projection';

export const PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION = 1 as const;

export type ProjectGradeSourceEvidenceEvaluationErrorCode =
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_VERSION_UNSUPPORTED'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_MANIFEST_MISMATCH'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED';

export class ProjectGradeSourceEvidenceEvaluationError extends Error {
  constructor(
    public readonly code: ProjectGradeSourceEvidenceEvaluationErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProjectGradeSourceEvidenceEvaluationError';
  }
}

type SourceEvidenceAdoptionManifest = Pick<
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
>;

export interface EvaluateAdoptedSourceEvidenceInput {
  adoption: SourceEvidenceAdoptionManifest;
  projection: ProjectGradeSourceEvidenceProjection;
  policyVersion?: number;
}

export interface EvaluateAdoptedSourceEvidenceResult {
  policyVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION;
  ruleInputs: RuleEvaluationInput[];
  evidence: ProjectGradeEvidence[];
  findings: ProjectGradeFinding[];
  productionVerified: false;
}

interface DraftPolicy {
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
}

interface FindingPolicy extends DraftPolicy {
  sourceSeverity: 'info' | 'warning' | 'high';
  severity: FindingSeverity;
  recommendation: string;
}

const SIGNAL_POLICY: Readonly<Record<string, DraftPolicy>> = {
  hasTests: {
    ruleKey: 'code_maintainability.baseline',
    dimensionKey: 'code_maintainability',
  },
  hasDocker: {
    ruleKey: 'devops_reliability.baseline',
    dimensionKey: 'devops_reliability',
  },
  hasCi: {
    ruleKey: 'devops_reliability.baseline',
    dimensionKey: 'devops_reliability',
  },
  hasLicense: {
    ruleKey: 'commercial_delivery.baseline',
    dimensionKey: 'commercial_delivery',
  },
  hasPackageManifest: {
    ruleKey: 'architecture_engineering.baseline',
    dimensionKey: 'architecture_engineering',
  },
};

const FINDING_POLICY: Readonly<Record<string, FindingPolicy>> = {
  'source.todo': {
    ruleKey: 'code_maintainability.baseline',
    dimensionKey: 'code_maintainability',
    sourceSeverity: 'info',
    severity: 'P3',
    recommendation: '确认待办项的责任人、优先级和完成标准，并在发布前关闭或形成受控技术债。',
  },
  'source.fixme': {
    ruleKey: 'code_maintainability.baseline',
    dimensionKey: 'code_maintainability',
    sourceSeverity: 'warning',
    severity: 'P2',
    recommendation: '复核待修复标记是否影响核心路径，完成修复、测试和可复验的关闭记录。',
  },
  'source.mock_marker': {
    ruleKey: 'functional_reality.baseline',
    dimensionKey: 'functional_reality',
    sourceSeverity: 'warning',
    severity: 'P1',
    recommendation: '确认 Mock、Stub 或 Fake 是否进入交付链路；核心路径必须替换为真实实现并补集成证据。',
  },
  'security.suspected_hardcoded_secret': {
    ruleKey: 'security_compliance.baseline',
    dimensionKey: 'security_compliance',
    sourceSeverity: 'high',
    severity: 'P0',
    recommendation: '立即人工复核并轮换疑似凭据，清理历史暴露，改用受控密钥存储并补泄露检测。',
  },
};

const TRACE_POLICY: Readonly<Record<'snapshot_manifest' | 'route_inventory', DraftPolicy>> = {
  snapshot_manifest: {
    ruleKey: 'architecture_engineering.baseline',
    dimensionKey: 'architecture_engineering',
  },
  route_inventory: {
    ruleKey: 'requirements_completeness.baseline',
    dimensionKey: 'requirements_completeness',
  },
};

const sha256Digest = /^sha256:[a-f0-9]{64}$/;
const sourceEvidenceId = /^source-evidence:v1:[a-f0-9]{64}$/;
const sourceAdoptionId = /^source-adoption:v1:[a-f0-9]{64}$/;
const sourceFindingFingerprint = /^[a-f0-9]{32}$/;

function fail(
  code: ProjectGradeSourceEvidenceEvaluationErrorCode,
  message: string
): never {
  throw new ProjectGradeSourceEvidenceEvaluationError(code, message);
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function sameOptional(left: string | undefined, right: string | undefined): boolean {
  return left === right;
}

function assertRuleMapping(draft: ProjectGradeSourceEvidenceDraft, policy: DraftPolicy): void {
  if (draft.ruleKey !== policy.ruleKey || draft.dimensionKey !== policy.dimensionKey) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
      'Adopted source evidence draft rule mapping is not supported'
    );
  }
  const rule = DEFAULT_PROJECT_GRADE_RULES.find((candidate) => candidate.key === policy.ruleKey);
  if (
    !rule ||
    draft.rulePackKey !== rule.rulePackKey ||
    draft.rulePackVersion !== rule.rulePackVersion
  ) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
      'Adopted source evidence draft rule-pack mapping is not supported'
    );
  }
}

function assertManifestMatchesProjection(
  adoption: SourceEvidenceAdoptionManifest,
  projection: ProjectGradeSourceEvidenceProjection
): void {
  if (
    !sourceAdoptionId.test(adoption.adoptionId) ||
    !sha256Digest.test(adoption.snapshotHash) ||
    !sha256Digest.test(adoption.draftSetHash) ||
    adoption.evidenceScope !== 'authorized_local_source_snapshot' ||
    adoption.scoringDisposition !== 'adopted_pending_evaluation' ||
    adoption.productionAcceptance !== false ||
    adoption.externalScanningEnabled !== false ||
    projection.evidenceScope !== 'authorized_local_source_snapshot' ||
    projection.scoringDisposition !== 'draft_only_not_adopted' ||
    projection.productionAcceptance !== false ||
    projection.externalScanningEnabled !== false
  ) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_MANIFEST_MISMATCH',
      'Source evidence adoption manifest boundary is invalid'
    );
  }

  const projectionEvidenceIds = projection.drafts.map((draft) => draft.evidenceId);
  if (
    adoption.projectId !== projection.projectId ||
    adoption.ownerId !== projection.ownerId ||
    !sameOptional(adoption.teamId, projection.teamId) ||
    adoption.sourceScanId !== projection.sourceScanId ||
    adoption.sourceScanVersion !== projection.sourceScanVersion ||
    adoption.snapshotHash !== projection.snapshotHash ||
    adoption.draftSetHash !== projection.draftSetHash ||
    adoption.draftCount !== projection.drafts.length ||
    adoption.evidenceIds.length !== projectionEvidenceIds.length ||
    adoption.evidenceIds.some((id, index) => id !== projectionEvidenceIds[index]) ||
    new Set(adoption.evidenceIds).size !== adoption.evidenceIds.length ||
    adoption.evidenceIds.some((id) => !sourceEvidenceId.test(id))
  ) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_MANIFEST_MISMATCH',
      'Source evidence adoption manifest does not match the rebuilt projection'
    );
  }
}

function assertDraftBoundary(
  draft: ProjectGradeSourceEvidenceDraft,
  adoption: SourceEvidenceAdoptionManifest,
  projection: ProjectGradeSourceEvidenceProjection
): void {
  if (
    !sourceEvidenceId.test(draft.evidenceId) ||
    draft.projectId !== adoption.projectId ||
    draft.ownerId !== adoption.ownerId ||
    !sameOptional(draft.teamId, adoption.teamId) ||
    draft.level !== 'source_static' ||
    draft.factor !== EVIDENCE_FACTORS.source_static ||
    draft.sourceType !== 'source_file' ||
    draft.source !== `projectgrade-source-scan:${projection.snapshotHash}` ||
    draft.collectedAt !== projection.collectedAt ||
    draft.projectionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION ||
    draft.scoringDisposition !== 'draft_only_not_adopted' ||
    draft.metadata.projectionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION ||
    draft.metadata.sourceScanId !== projection.sourceScanId ||
    draft.metadata.sourceScanVersion !== projection.sourceScanVersion ||
    draft.metadata.snapshotHash !== projection.snapshotHash ||
    draft.metadata.sourceEvidenceKind !== draft.kind ||
    draft.metadata.productionAcceptance !== false ||
    draft.metadata.externalScanningEnabled !== false ||
    draft.metadata.sourceContentPersisted !== false
  ) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
      'Adopted source evidence draft violates the scoring boundary'
    );
  }
}

function policyForDraft(draft: ProjectGradeSourceEvidenceDraft): DraftPolicy {
  if (draft.kind === 'snapshot_manifest' || draft.kind === 'route_inventory') {
    const policy = TRACE_POLICY[draft.kind];
    assertRuleMapping(draft, policy);
    return policy;
  }
  if (draft.kind === 'project_signal') {
    const sourceSignal = draft.metadata.sourceSignal;
    const policy = sourceSignal ? SIGNAL_POLICY[sourceSignal] : undefined;
    if (!policy) {
      fail(
        'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
        'Adopted source evidence project signal is not explicitly mapped'
      );
    }
    assertRuleMapping(draft, policy);
    return policy;
  }
  if (draft.kind === 'finding') {
    const sourceRuleKey = draft.metadata.sourceRuleKey;
    const policy = sourceRuleKey ? FINDING_POLICY[sourceRuleKey] : undefined;
    if (
      !policy ||
      draft.metadata.sourceFindingSeverity !== policy.sourceSeverity ||
      !draft.metadata.sourceFindingFingerprint ||
      !sourceFindingFingerprint.test(draft.metadata.sourceFindingFingerprint)
    ) {
      fail(
        'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
        'Adopted source evidence finding is not explicitly mapped'
      );
    }
    assertRuleMapping(draft, policy);
    return policy;
  }
  fail(
    'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
    'Adopted source evidence draft kind is not supported'
  );
}

function toEvidence(
  draft: ProjectGradeSourceEvidenceDraft,
  adoption: SourceEvidenceAdoptionManifest
): ProjectGradeEvidence {
  return {
    id: draft.evidenceId,
    ruleKey: draft.ruleKey,
    dimensionKey: draft.dimensionKey,
    level: 'source_static',
    factor: EVIDENCE_FACTORS.source_static,
    title: draft.title,
    description: draft.description,
    sourceType: 'source_file',
    source: draft.source,
    collectedAt: draft.collectedAt,
    metadata: {
      ...draft.metadata,
      sourceEvidenceAdoptionId: adoption.adoptionId,
      sourceEvidenceAdoptionVersion: adoption.adoptionVersion,
      sourceEvidenceScoringPolicyVersion:
        PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
      scoringDisposition: 'adopted_for_evaluation',
    },
  };
}

function toFinding(
  draft: ProjectGradeSourceEvidenceDraft,
  evidence: ProjectGradeEvidence,
  adoption: SourceEvidenceAdoptionManifest
): ProjectGradeFinding | undefined {
  if (draft.kind !== 'finding') return undefined;
  const sourceRuleKey = draft.metadata.sourceRuleKey;
  const sourceFingerprint = draft.metadata.sourceFindingFingerprint;
  const policy = sourceRuleKey ? FINDING_POLICY[sourceRuleKey] : undefined;
  if (!policy || !sourceFingerprint) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_DRAFT_UNSUPPORTED',
      'Adopted source evidence finding policy is missing'
    );
  }
  const identity = [
    adoption.adoptionId,
    draft.evidenceId,
    sourceRuleKey,
    sourceFingerprint,
    String(PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION),
  ].join('\0');
  return {
    id: `source-finding:v1:${digest(identity)}`,
    fingerprint: createFindingFingerprint({
      rulePackKey: draft.rulePackKey,
      ruleKey: draft.ruleKey,
      dimensionKey: draft.dimensionKey,
      targetScopeKey: adoption.targetId,
      findingKey: `${sourceRuleKey}:${sourceFingerprint}`,
    }),
    fingerprintVersion: 1,
    ruleKey: draft.ruleKey,
    dimensionKey: draft.dimensionKey,
    severity: policy.severity,
    status: 'open',
    title: draft.title,
    description: draft.description,
    recommendation: policy.recommendation,
    evidenceIds: [evidence.id],
    createdAt: draft.collectedAt,
  };
}

export function evaluateAdoptedSourceEvidence(
  input: EvaluateAdoptedSourceEvidenceInput
): EvaluateAdoptedSourceEvidenceResult {
  const policyVersion =
    input.policyVersion ?? PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION;
  if (
    policyVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION ||
    input.adoption.adoptionVersion !== 1 ||
    input.adoption.projectionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION ||
    input.projection.projectionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION
  ) {
    fail(
      'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_VERSION_UNSUPPORTED',
      'Source evidence evaluation version is not supported'
    );
  }

  assertManifestMatchesProjection(input.adoption, input.projection);

  const evidence: ProjectGradeEvidence[] = [];
  const findings: ProjectGradeFinding[] = [];
  const evidenceByRule = new Map<string, ProjectGradeEvidence[]>();
  const positiveRuleKeys = new Set<string>();

  for (const draft of input.projection.drafts) {
    assertDraftBoundary(draft, input.adoption, input.projection);
    policyForDraft(draft);
    const item = toEvidence(draft, input.adoption);
    evidence.push(item);
    evidenceByRule.set(draft.ruleKey, [...(evidenceByRule.get(draft.ruleKey) || []), item]);
    if (draft.kind === 'project_signal') positiveRuleKeys.add(draft.ruleKey);
    const finding = toFinding(draft, item, input.adoption);
    if (finding) findings.push(finding);
  }

  const ruleInputs: RuleEvaluationInput[] = [...evidenceByRule.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([ruleKey, ruleEvidence]) => ({
      ruleKey,
      completion: positiveRuleKeys.has(ruleKey) ? 0.25 : 0,
      evidence: ruleEvidence,
      notes: positiveRuleKeys.has(ruleKey)
        ? '仅存在授权源码静态信号；完成度按策略上限 0.25，并乘 source_static 证据因子 0.75。'
        : '仅用于溯源或风险解释，不增加规则完成度。',
    }));

  return {
    policyVersion: PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
    ruleInputs,
    evidence,
    findings: findings.sort((left, right) => left.id.localeCompare(right.id)),
    productionVerified: false,
  };
}
