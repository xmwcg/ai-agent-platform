import fs from 'fs';
import os from 'os';
import path from 'path';
import { ProjectGradeService } from './project-grade.service';

function createFixture(files: Record<string, string> = {}): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'project-grade-'));
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(root, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
  }
  return root;
}

describe('ProjectGradeService Batch 0 repository baseline', () => {
  const fixtures: string[] = [];

  afterEach(() => {
    for (const fixture of fixtures.splice(0)) {
      fs.rmSync(fixture, { recursive: true, force: true });
    }
  });

  it('returns the versioned 12-rule core pack', () => {
    const root = createFixture();
    fixtures.push(root);
    const service = new ProjectGradeService(root);
    const rules = service.getRules();

    expect(rules).toHaveLength(12);
    expect(new Set(rules.map((rule) => rule.dimensionKey)).size).toBe(12);
    expect(rules.reduce((sum, rule) => sum + rule.weight, 0)).toBe(1000);
    expect(new Set(rules.map((rule) => rule.rulePackVersion))).toEqual(new Set(['0.1.0']));
  });

  it('does not fabricate evidence when repository files are absent', async () => {
    const root = createFixture();
    fixtures.push(root);
    const service = new ProjectGradeService(root);
    const result = await service.createBaselineEvaluationRun('Empty fixture');

    expect(result.snapshots).toHaveLength(12);
    expect(result.evidence).toEqual([]);
    expect(result.rawTotalScore).toBe(0);
    expect(result.productionVerified).toBe(false);
    expect(result.releaseGate).toMatchObject({
      status: 'BLOCKED',
      highestSeverity: 'P1',
      blockedForRelease: true,
      blockedForPaidSale: true,
    });
  });

  it('classifies repository files only as static source or documentation evidence', async () => {
    const root = createFixture({
      'docs/PROJECTGRADE-HANDOFF.md': '# handoff',
      'docs/AIBAK-FULL-PROJECT-HANDOFF.md': '# full handoff',
      'MEMORY.md': '# memory',
      'client/src/router.tsx': 'export const router = [];',
      'client/src/App.tsx': 'export default function App() { return null; }',
      'server/src/index.ts': 'export default {};',
      'server/src/routes/auth.ts': 'export default {};',
      'server/src/routes/ai.ts': 'export default {};',
      'server/src/routes/billing.ts': 'export default {};',
      'server/tsconfig.json': '{"compilerOptions":{"strict":false}}',
      'server/jest.config.cjs': 'module.exports = {};',
      'server/src/test/setup.ts': 'export {};',
      'docker-compose.yml': 'services: {}',
    });
    fixtures.push(root);
    const service = new ProjectGradeService(root);
    const result = await service.createBaselineEvaluationRun('Static fixture', 'AI 应用');

    expect(result.evidence.length).toBeGreaterThan(0);
    expect(new Set(result.evidence.map((item) => item.level))).toEqual(
      new Set(['source_static', 'documentation'])
    );
    expect(result.evidence.every((item) => item.verifiedAt === undefined)).toBe(true);
    expect(result.productionVerified).toBe(false);
    expect(result.snapshots).toHaveLength(12);
    expect(result.releaseGate.highestSeverity).toBe('P1');
  });

  it.each([
    ['网站', 'website'],
    ['website', 'website'],
    ['SaaS', 'saas'],
    ['SaaS 应用', 'saas'],
    ['AI 应用', 'ai_application'],
    ['ai_application', 'ai_application'],
  ] as const)('normalizes supported Batch 0 type %s to %s', (input, expected) => {
    const root = createFixture();
    fixtures.push(root);
    const service = new ProjectGradeService(root);
    expect(service.normalizeProjectType(input)).toBe(expected);
  });

  it('rejects project types not covered by the Batch 0 rule pack', () => {
    const root = createFixture();
    fixtures.push(root);
    const service = new ProjectGradeService(root);
    expect(() => service.normalizeProjectType('api_service')).toThrow('Batch 0 supports');
  });
});
