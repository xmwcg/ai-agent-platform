import {
  DEFAULT_PROJECT_GRADE_RULES,
  EVIDENCE_FACTORS,
  PROJECT_GRADE_DIMENSIONS,
  PROJECT_GRADE_MAX_SCORE,
  type EvidenceLevel,
  type FindingSeverity,
} from './config';
import {
  createEvidence,
  createFinding,
  createFindingFingerprint,
  evaluateProjectGrade,
  resolveProjectGradeLetter,
  type RuleEvaluationInput,
} from './engine';

function evidenceFor(
  rule = DEFAULT_PROJECT_GRADE_RULES[0],
  level: EvidenceLevel = 'production_automatic',
  options: { verified?: boolean; id?: string } = {}
) {
  return createEvidence({
    id: options.id,
    ruleKey: rule.key,
    dimensionKey: rule.dimensionKey,
    level,
    title: `${rule.title} evidence`,
    description: 'deterministic test evidence',
    sourceType: level === 'production_automatic' ? 'production_probe' : 'test_command',
    source: 'project-grade-engine.test',
    verifiedAt: options.verified ? '2026-07-20T00:00:00.000Z' : undefined,
    collectedAt: '2026-07-20T00:00:00.000Z',
  });
}

function fullInputs(level: EvidenceLevel = 'production_automatic'): RuleEvaluationInput[] {
  return DEFAULT_PROJECT_GRADE_RULES.map((rule) => ({
    ruleKey: rule.key,
    completion: 1,
    evidence: [evidenceFor(rule, level, { verified: level === 'production_automatic' })],
  }));
}

function finding(severity: FindingSeverity, status: 'open' | 'accepted' | 'resolved' = 'open') {
  const rule = DEFAULT_PROJECT_GRADE_RULES[0];
  return createFinding({
    id: `finding-${severity}-${status}`,
    ruleKey: rule.key,
    dimensionKey: rule.dimensionKey,
    severity,
    status,
    title: `${severity} gate`,
    description: 'gate test',
    recommendation: 'fix it',
    evidenceIds: [],
    createdAt: '2026-07-20T00:00:00.000Z',
  });
}

function evaluate(ruleInputs: RuleEvaluationInput[], findings = []) {
  return evaluateProjectGrade({
    projectName: 'ProjectGrade engine test',
    projectType: 'ai_application',
    ruleInputs,
    findings,
    assessedAt: '2026-07-20T00:00:00.000Z',
  });
}

describe('ProjectGrade Batch 0 deterministic engine', () => {
  it('keeps the 12-dimension rule pack at exactly 1000 points', () => {
    expect(PROJECT_GRADE_DIMENSIONS).toHaveLength(12);
    expect(DEFAULT_PROJECT_GRADE_RULES).toHaveLength(12);
    expect(PROJECT_GRADE_MAX_SCORE).toBe(1000);
    expect(DEFAULT_PROJECT_GRADE_RULES.reduce((sum, rule) => sum + rule.weight, 0)).toBe(1000);
  });

  it('creates a versioned deterministic fingerprint from stable finding identity fields', () => {
    const input = {
      rulePackKey: 'aibak-projectgrade-core',
      ruleKey: 'functional_reality.baseline',
      dimensionKey: 'functional_reality' as const,
      targetScopeKey: 'aibak_server_repository',
      findingKey: 'core journey production proof missing',
    };

    const first = createFindingFingerprint(input);
    const normalizedEquivalent = createFindingFingerprint({
      ...input,
      rulePackKey: ' AIBAK-PROJECTGRADE-CORE ',
      findingKey: 'core   journey production proof missing',
    });

    expect(first).toMatch(/^fg_v1_[a-f0-9]{32}$/);
    expect(normalizedEquivalent).toBe(first);
    expect(createFindingFingerprint({ ...input, targetScopeKey: 'external_repository' })).not.toBe(first);
  });

  it('keeps a stable fingerprint across runs while retaining unique finding instance ids', () => {
    const rule = DEFAULT_PROJECT_GRADE_RULES[0];
    const base = {
      rulePackKey: rule.rulePackKey,
      targetScopeKey: 'aibak_server_repository',
      findingKey: 'product-strategy-gap',
      ruleKey: rule.key,
      dimensionKey: rule.dimensionKey,
      severity: 'P3' as const,
      title: 'Product strategy gap',
      description: 'missing evidence',
      recommendation: 'add evidence',
      evidenceIds: [],
    };
    const first = createFinding(base);
    const second = createFinding(base);

    expect(first.id).not.toBe(second.id);
    expect(first.fingerprint).toBe(second.fingerprint);
    expect(first.fingerprintVersion).toBe(1);
  });

  it.each([
    ['production_automatic', 1],
    ['ci_integration', 0.9],
    ['source_static', 0.75],
    ['documentation', 0.4],
    ['none', 0],
  ] as const)('assigns %s evidence factor %s', (level, factor) => {
    expect(EVIDENCE_FACTORS[level]).toBe(factor);
    expect(evidenceFor(DEFAULT_PROJECT_GRADE_RULES[0], level).factor).toBe(factor);
  });

  it('multiplies rule weight by completion and strongest evidence factor', () => {
    const rule = DEFAULT_PROJECT_GRADE_RULES[0];
    const result = evaluate([{
      ruleKey: rule.key,
      completion: 0.5,
      evidence: [
        evidenceFor(rule, 'documentation'),
        evidenceFor(rule, 'source_static'),
      ],
    }]);

    expect(result.snapshots[0].rules[0]).toMatchObject({
      completion: 0.5,
      evidenceLevel: 'source_static',
      evidenceFactor: 0.75,
      awardedScore: 22.5,
    });
    expect(result.rawTotalScore).toBe(22.5);
  });

  it.each([
    [95, 'S'], [94.9, 'A'],
    [85, 'A'], [84.9, 'B'],
    [75, 'B'], [74.9, 'C'],
    [60, 'C'], [59.9, 'D'],
    [40, 'D'], [39.9, 'F'],
  ] as const)('maps score %s to grade %s', (score, grade) => {
    expect(resolveProjectGradeLetter(score)).toBe(grade);
  });

  it.each([
    ['P0', 390, true, true, 'BLOCKED'],
    ['P1', 590, true, true, 'BLOCKED'],
    ['P2', 690, false, false, 'CONDITIONAL'],
    ['P3', 790, false, false, 'CONDITIONAL'],
  ] as const)('applies the %s release gate and score cap', (severity, cap, releaseBlocked, paidBlocked, status) => {
    const result = evaluate(fullInputs(), [finding(severity)]);
    expect(result.rawTotalScore).toBe(1000);
    expect(result.finalTotalScore).toBe(cap);
    expect(result.releaseGate).toMatchObject({
      highestSeverity: severity,
      scoreCap: cap,
      blockedForRelease: releaseBlocked,
      blockedForPaidSale: paidBlocked,
      status,
    });
  });

  it('does not gate on resolved findings', () => {
    const result = evaluate(fullInputs(), [finding('P0', 'resolved')]);
    expect(result.finalTotalScore).toBe(1000);
    expect(result.releaseGate).toMatchObject({ status: 'PASS', highestSeverity: 'NONE' });
  });

  it('rejects unknown and duplicate rule inputs', () => {
    expect(() => evaluate([{ ruleKey: 'unknown.rule', completion: 1, evidence: [] }]))
      .toThrow('Unknown ProjectGrade rule keys');

    const rule = DEFAULT_PROJECT_GRADE_RULES[0];
    expect(() => evaluate([
      { ruleKey: rule.key, completion: 1, evidence: [] },
      { ruleKey: rule.key, completion: 0.5, evidence: [] },
    ])).toThrow('Duplicate ProjectGrade rule inputs');
  });

  it('rejects forged or mismatched evidence metadata', () => {
    const rule = DEFAULT_PROJECT_GRADE_RULES[0];
    const mismatched = evidenceFor(DEFAULT_PROJECT_GRADE_RULES[1], 'source_static');
    expect(() => evaluate([{ ruleKey: rule.key, completion: 1, evidence: [mismatched] }]))
      .toThrow('does not match rule');

    const forged = { ...evidenceFor(rule, 'source_static'), factor: 1 };
    expect(() => evaluate([{ ruleKey: rule.key, completion: 1, evidence: [forged] }]))
      .toThrow('invalid factor');
  });

  it('marks production verification only with verified production-automatic evidence', () => {
    const rule = DEFAULT_PROJECT_GRADE_RULES[0];
    const staticResult = evaluate([{
      ruleKey: rule.key,
      completion: 1,
      evidence: [evidenceFor(rule, 'source_static')],
    }]);
    expect(staticResult.productionVerified).toBe(false);

    const unverifiedProduction = evaluate([{
      ruleKey: rule.key,
      completion: 1,
      evidence: [evidenceFor(rule, 'production_automatic')],
    }]);
    expect(unverifiedProduction.productionVerified).toBe(false);

    const verifiedProduction = evaluate([{
      ruleKey: rule.key,
      completion: 1,
      evidence: [evidenceFor(rule, 'production_automatic', { verified: true })],
    }]);
    expect(verifiedProduction.productionVerified).toBe(true);
  });

  it('rejects project types not covered by the active Batch 0 rule pack', () => {
    expect(() => evaluateProjectGrade({
      projectName: 'unsupported',
      projectType: 'api_service',
      ruleInputs: [],
    })).toThrow('must total 1000');
  });
});
