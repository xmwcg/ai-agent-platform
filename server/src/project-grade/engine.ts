import crypto from 'crypto';
import {
  DEFAULT_PROJECT_GRADE_RULES,
  EVIDENCE_FACTORS,
  PROJECT_GRADE_DIMENSIONS,
  PROJECT_GRADE_FINDING_FINGERPRINT_VERSION,
  PROJECT_GRADE_MAX_SCORE,
  type CompletionRatio,
  type EvidenceLevel,
  type FindingSeverity,
  type FindingStatus,
  type ProjectGradeDimensionKey,
  type ProjectGradeProjectType,
  type ProjectGradeRuleDefinition,
} from './config';

export interface ProjectGradeEvidence {
  id: string;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  level: EvidenceLevel;
  factor: number;
  title: string;
  description: string;
  sourceType: 'production_probe' | 'test_command' | 'source_file' | 'document' | 'manual';
  source: string;
  collectedAt: string;
  verifiedAt?: string;
  metadata?: Record<string, unknown>;
}

export interface ProjectGradeFinding {
  id: string;
  fingerprint: string;
  fingerprintVersion: number;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  severity: FindingSeverity;
  status: FindingStatus;
  title: string;
  description: string;
  recommendation: string;
  evidenceIds: string[];
  createdAt: string;
}

export interface RuleEvaluationInput {
  ruleKey: string;
  completion: CompletionRatio;
  evidence: ProjectGradeEvidence[];
  notes?: string;
}

export interface RuleScoreSnapshot {
  ruleKey: string;
  title: string;
  weight: number;
  completion: CompletionRatio;
  evidenceLevel: EvidenceLevel;
  evidenceFactor: number;
  awardedScore: number;
  notes: string;
  evidenceIds: string[];
}

export interface DimensionScoreSnapshot {
  dimensionKey: ProjectGradeDimensionKey;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  rules: RuleScoreSnapshot[];
}

export interface ProjectGradeReleaseGate {
  status: 'PASS' | 'CONDITIONAL' | 'BLOCKED';
  highestSeverity: FindingSeverity | 'NONE';
  scoreCap: number;
  blockedForRelease: boolean;
  blockedForPaidSale: boolean;
  reasons: string[];
}

export interface ProjectGradeEvaluationResult {
  runId: string;
  projectName: string;
  projectType: ProjectGradeProjectType;
  projectUrl?: string;
  rulePackKey: string;
  rulePackVersion: string;
  assessedAt: string;
  rawTotalScore: number;
  finalTotalScore: number;
  normalizedScore: number;
  grade: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  releaseGate: ProjectGradeReleaseGate;
  snapshots: DimensionScoreSnapshot[];
  evidence: ProjectGradeEvidence[];
  findings: ProjectGradeFinding[];
  productionVerified: boolean;
  summary: string;
}

export interface EvaluateProjectGradeInput {
  projectName: string;
  projectType: ProjectGradeProjectType;
  projectUrl?: string;
  rules?: ProjectGradeRuleDefinition[];
  ruleInputs: RuleEvaluationInput[];
  findings?: ProjectGradeFinding[];
  assessedAt?: string;
}

const severityOrder: Record<FindingSeverity, number> = {
  P0: 4,
  P1: 3,
  P2: 2,
  P3: 1,
};

const scoreCaps: Record<FindingSeverity | 'NONE', number> = {
  P0: 390,
  P1: 590,
  P2: 690,
  P3: 790,
  NONE: 1000,
};


export interface ProjectGradeFindingFingerprintInput {
  rulePackKey: string;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  targetScopeKey: string;
  findingKey: string;
  fingerprintVersion?: number;
}

function normalizeFingerprintPart(value: string, field: string): string {
  const normalized = String(value || '')
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`ProjectGrade finding fingerprint ${field} is required`);
  return normalized;
}

export function createFindingFingerprint(input: ProjectGradeFindingFingerprintInput): string {
  const fingerprintVersion = input.fingerprintVersion || PROJECT_GRADE_FINDING_FINGERPRINT_VERSION;
  if (!Number.isInteger(fingerprintVersion) || fingerprintVersion < 1) {
    throw new Error('ProjectGrade finding fingerprint version must be a positive integer');
  }

  const canonical = JSON.stringify({
    fingerprintVersion,
    rulePackKey: normalizeFingerprintPart(input.rulePackKey, 'rulePackKey'),
    ruleKey: normalizeFingerprintPart(input.ruleKey, 'ruleKey'),
    dimensionKey: normalizeFingerprintPart(input.dimensionKey, 'dimensionKey'),
    targetScopeKey: normalizeFingerprintPart(input.targetScopeKey, 'targetScopeKey'),
    findingKey: normalizeFingerprintPart(input.findingKey, 'findingKey'),
  });
  const digest = crypto.createHash('sha256').update(canonical, 'utf8').digest('hex').slice(0, 32);
  return `fg_v${fingerprintVersion}_${digest}`;
}

function round(value: number, digits = 1): number {
  return Number(value.toFixed(digits));
}

function strongestEvidenceLevel(evidence: ProjectGradeEvidence[]): EvidenceLevel {
  return evidence.reduce<EvidenceLevel>((best, item) => {
    return EVIDENCE_FACTORS[item.level] > EVIDENCE_FACTORS[best] ? item.level : best;
  }, 'none');
}

export function resolveProjectGradeLetter(score: number): ProjectGradeEvaluationResult['grade'] {
  if (score >= 95) return 'S';
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function resolveHighestSeverity(findings: ProjectGradeFinding[]): FindingSeverity | 'NONE' {
  const openFindings = findings.filter((finding) => finding.status === 'open' || finding.status === 'accepted');
  if (!openFindings.length) return 'NONE';
  return openFindings.reduce<FindingSeverity>((highest, finding) => {
    return severityOrder[finding.severity] > severityOrder[highest] ? finding.severity : highest;
  }, openFindings[0].severity);
}

function buildReleaseGate(findings: ProjectGradeFinding[]): ProjectGradeReleaseGate {
  const highestSeverity = resolveHighestSeverity(findings);
  const activeFindings = findings.filter((finding) => finding.status === 'open' || finding.status === 'accepted');
  const reasons = activeFindings
    .filter((finding) => highestSeverity === 'NONE' || finding.severity === highestSeverity)
    .map((finding) => finding.title);

  if (highestSeverity === 'P0') {
    return {
      status: 'BLOCKED',
      highestSeverity,
      scoreCap: scoreCaps.P0,
      blockedForRelease: true,
      blockedForPaidSale: true,
      reasons,
    };
  }
  if (highestSeverity === 'P1') {
    return {
      status: 'BLOCKED',
      highestSeverity,
      scoreCap: scoreCaps.P1,
      blockedForRelease: true,
      blockedForPaidSale: true,
      reasons,
    };
  }
  if (highestSeverity === 'P2') {
    return {
      status: 'CONDITIONAL',
      highestSeverity,
      scoreCap: scoreCaps.P2,
      blockedForRelease: false,
      blockedForPaidSale: false,
      reasons,
    };
  }
  if (highestSeverity === 'P3') {
    return {
      status: 'CONDITIONAL',
      highestSeverity,
      scoreCap: scoreCaps.P3,
      blockedForRelease: false,
      blockedForPaidSale: false,
      reasons,
    };
  }
  return {
    status: 'PASS',
    highestSeverity: 'NONE',
    scoreCap: scoreCaps.NONE,
    blockedForRelease: false,
    blockedForPaidSale: false,
    reasons: [],
  };
}

function validateRules(rules: ProjectGradeRuleDefinition[]): void {
  const enabledRules = rules.filter((rule) => rule.enabled);
  const totalWeight = enabledRules.reduce((sum, rule) => sum + rule.weight, 0);
  if (totalWeight !== PROJECT_GRADE_MAX_SCORE) {
    throw new Error(`Enabled ProjectGrade rules must total ${PROJECT_GRADE_MAX_SCORE}, received ${totalWeight}`);
  }
  const duplicateKeys = enabledRules
    .map((rule) => rule.key)
    .filter((key, index, all) => all.indexOf(key) !== index);
  if (duplicateKeys.length) {
    throw new Error(`Duplicate ProjectGrade rule keys: ${Array.from(new Set(duplicateKeys)).join(', ')}`);
  }
}

function validateRuleInputs(rules: ProjectGradeRuleDefinition[], inputs: RuleEvaluationInput[]): void {
  const ruleByKey = new Map(rules.filter((rule) => rule.enabled).map((rule) => [rule.key, rule]));
  const validRuleKeys = new Set(ruleByKey.keys());
  const unknownKeys = inputs.map((input) => input.ruleKey).filter((key) => !validRuleKeys.has(key));
  if (unknownKeys.length) {
    throw new Error(`Unknown ProjectGrade rule keys: ${Array.from(new Set(unknownKeys)).join(', ')}`);
  }
  const duplicateKeys = inputs
    .map((input) => input.ruleKey)
    .filter((key, index, all) => all.indexOf(key) !== index);
  if (duplicateKeys.length) {
    throw new Error(`Duplicate ProjectGrade rule inputs: ${Array.from(new Set(duplicateKeys)).join(', ')}`);
  }

  const evidenceIds = new Set<string>();
  for (const input of inputs) {
    const rule = ruleByKey.get(input.ruleKey);
    if (!rule) continue;
    for (const evidence of input.evidence) {
      if (evidence.ruleKey !== input.ruleKey || evidence.dimensionKey !== rule.dimensionKey) {
        throw new Error(`ProjectGrade evidence ${evidence.id} does not match rule ${input.ruleKey}`);
      }
      if (evidence.factor !== EVIDENCE_FACTORS[evidence.level]) {
        throw new Error(`ProjectGrade evidence ${evidence.id} has an invalid factor`);
      }
      if (evidenceIds.has(evidence.id)) {
        throw new Error(`Duplicate ProjectGrade evidence id: ${evidence.id}`);
      }
      evidenceIds.add(evidence.id);
    }
  }
}

export function createEvidence(
  input: Omit<ProjectGradeEvidence, 'id' | 'factor' | 'collectedAt'> & {
    id?: string;
    collectedAt?: string;
  }
): ProjectGradeEvidence {
  return {
    ...input,
    id: input.id || `evidence_${crypto.randomUUID()}`,
    factor: EVIDENCE_FACTORS[input.level],
    collectedAt: input.collectedAt || new Date().toISOString(),
  };
}

export function createFinding(
  input: Omit<ProjectGradeFinding, 'id' | 'fingerprint' | 'fingerprintVersion' | 'status' | 'createdAt'> & {
    id?: string;
    fingerprint?: string;
    fingerprintVersion?: number;
    status?: FindingStatus;
    createdAt?: string;
    rulePackKey?: string;
    targetScopeKey?: string;
    findingKey?: string;
  }
): ProjectGradeFinding {
  const {
    rulePackKey,
    targetScopeKey,
    findingKey,
    fingerprint: suppliedFingerprint,
    fingerprintVersion = PROJECT_GRADE_FINDING_FINGERPRINT_VERSION,
    ...findingInput
  } = input;
  const matchedRule = DEFAULT_PROJECT_GRADE_RULES.find((rule) => rule.key === input.ruleKey);
  const fingerprint = suppliedFingerprint || createFindingFingerprint({
    fingerprintVersion,
    rulePackKey: rulePackKey || matchedRule?.rulePackKey || 'project-grade',
    ruleKey: input.ruleKey,
    dimensionKey: input.dimensionKey,
    targetScopeKey: targetScopeKey || 'default_target',
    findingKey: findingKey || input.title,
  });

  return {
    ...findingInput,
    id: input.id || `finding_${crypto.randomUUID()}`,
    fingerprint,
    fingerprintVersion,
    status: input.status || 'open',
    createdAt: input.createdAt || new Date().toISOString(),
  };
}

export function evaluateProjectGrade(input: EvaluateProjectGradeInput): ProjectGradeEvaluationResult {
  const rules = (input.rules || DEFAULT_PROJECT_GRADE_RULES).filter(
    (rule) => rule.enabled && rule.projectTypes.includes(input.projectType)
  );
  validateRules(rules);
  validateRuleInputs(rules, input.ruleInputs);

  const ruleInputMap = new Map(input.ruleInputs.map((item) => [item.ruleKey, item]));
  const snapshots: DimensionScoreSnapshot[] = PROJECT_GRADE_DIMENSIONS.map((dimension) => {
    const dimensionRules = rules.filter((rule) => rule.dimensionKey === dimension.key);
    const ruleSnapshots = dimensionRules.map<RuleScoreSnapshot>((rule) => {
      const ruleInput = ruleInputMap.get(rule.key);
      const completion = ruleInput?.completion || 0;
      const evidence = ruleInput?.evidence || [];
      const evidenceLevel = strongestEvidenceLevel(evidence);
      const evidenceFactor = EVIDENCE_FACTORS[evidenceLevel];
      const awardedScore = round(rule.weight * completion * evidenceFactor);
      return {
        ruleKey: rule.key,
        title: rule.title,
        weight: rule.weight,
        completion,
        evidenceLevel,
        evidenceFactor,
        awardedScore,
        notes: ruleInput?.notes || '',
        evidenceIds: evidence.map((item) => item.id),
      };
    });
    const rawScore = round(ruleSnapshots.reduce((sum, snapshot) => sum + snapshot.awardedScore, 0));
    return {
      dimensionKey: dimension.key,
      label: dimension.label,
      weight: dimension.weight,
      rawScore,
      normalizedScore: dimension.weight > 0 ? round((rawScore / dimension.weight) * 100) : 0,
      rules: ruleSnapshots,
    };
  });

  const evidence = input.ruleInputs.flatMap((item) => item.evidence);
  const findings = input.findings || [];
  const releaseGate = buildReleaseGate(findings);
  const rawTotalScore = round(snapshots.reduce((sum, snapshot) => sum + snapshot.rawScore, 0));
  const finalTotalScore = Math.min(rawTotalScore, releaseGate.scoreCap);
  const normalizedScore = round(finalTotalScore / 10);
  const grade = resolveProjectGradeLetter(normalizedScore);
  const productionVerified = evidence.some((item) => item.level === 'production_automatic' && Boolean(item.verifiedAt));
  const weakestDimensions = [...snapshots]
    .sort((a, b) => a.normalizedScore - b.normalizedScore)
    .slice(0, 3)
    .map((snapshot) => snapshot.label);

  return {
    runId: crypto.randomUUID(),
    projectName: input.projectName,
    projectType: input.projectType,
    projectUrl: input.projectUrl,
    rulePackKey: rules[0]?.rulePackKey || 'unknown',
    rulePackVersion: rules[0]?.rulePackVersion || 'unknown',
    assessedAt: input.assessedAt || new Date().toISOString(),
    rawTotalScore,
    finalTotalScore,
    normalizedScore,
    grade,
    releaseGate,
    snapshots,
    evidence,
    findings,
    productionVerified,
    summary: `ProjectGrade 评分 ${normalizedScore}/100（${grade}），原始分 ${rawTotalScore}/1000，门禁 ${releaseGate.highestSeverity}。优先补强：${weakestDimensions.join('、')}。`,
  };
}

