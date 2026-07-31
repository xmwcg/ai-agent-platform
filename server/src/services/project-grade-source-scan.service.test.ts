import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';
import { ProjectGradeSourceScanService } from './project-grade-source-scan.service';

async function writeFixture(
  root: string,
  relativePath: string,
  content: string | Buffer
): Promise<void> {
  const target = path.join(root, relativePath);
  await fs.mkdir(path.dirname(target), { recursive: true });
  await fs.writeFile(target, content);
}

describe('ProjectGradeSourceScanService', () => {
  let sandboxRoot: string;
  let sourceRoot: string;

  beforeEach(async () => {
    sandboxRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'project-grade-source-scan-'));
    sourceRoot = path.join(sandboxRoot, 'authorized-source');
    await fs.mkdir(sourceRoot, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(sandboxRoot, { recursive: true, force: true });
  });

  function createService(
    overrides: ConstructorParameters<typeof ProjectGradeSourceScanService>[0] = {}
  ) {
    return new ProjectGradeSourceScanService({
      allowedRoots: { fixture: sourceRoot },
      ...overrides,
    });
  }

  it('rejects arbitrary absolute paths, traversal and unknown roots', async () => {
    const service = createService();
    await expect(
      service.scan({ rootKey: 'fixture', relativePath: path.resolve(sandboxRoot) })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_SOURCE_PATH_ABSOLUTE' });
    await expect(service.scan({ rootKey: 'fixture', relativePath: '..' })).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_PATH_OUTSIDE_ROOT',
    });
    await expect(service.scan({ rootKey: 'missing-root' })).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_ROOT_NOT_ALLOWED',
    });
  });

  it('rejects a symbolic-link escape without reading the outside file', async () => {
    const outside = path.join(sandboxRoot, 'outside');
    await fs.mkdir(outside);
    await writeFixture(outside, 'secret.ts', 'export const outsideSecret = "must-not-be-read";');
    await fs.symlink(
      outside,
      path.join(sourceRoot, 'escape'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    await expect(createService().scan({ rootKey: 'fixture' })).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_SYMLINK_ESCAPE',
    });
  });

  it('counts but never follows an in-root symbolic-link directory', async () => {
    const actualDirectory = path.join(sourceRoot, 'actual');
    await fs.mkdir(actualDirectory);
    await writeFixture(actualDirectory, 'hidden.ts', 'export const hidden = true;');
    await writeFixture(sourceRoot, 'visible.ts', 'export const visible = true;');
    await fs.symlink(
      actualDirectory,
      path.join(sourceRoot, 'linked'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );

    const result = await createService().scan({ rootKey: 'fixture' });

    expect(result.files.map((file) => file.path)).toEqual(['actual/hidden.ts', 'visible.ts']);
    expect(result.skipped.symbolicLinks).toBe(1);
    expect(result.files.some((file) => file.path.startsWith('linked/'))).toBe(false);
  });

  it('fails closed when a source file changes after it has been read', async () => {
    await writeFixture(sourceRoot, 'changing.ts', 'export const version = 1;');
    const originalStat = (fs.stat as any).bind(fs);
    let statCalls = 0;
    const statSpy = jest.spyOn(fs, 'stat').mockImplementation((async (
      target: any,
      options?: any
    ) => {
      const stat =
        options === undefined ? await originalStat(target) : await originalStat(target, options);
      statCalls += 1;
      if (statCalls === 2) {
        return { ...stat, size: stat.size + 1 };
      }
      return stat;
    }) as any);

    try {
      await expect(createService().scan({ rootKey: 'fixture' })).rejects.toMatchObject({
        code: 'PROJECT_GRADE_SOURCE_FILE_CHANGED',
      });
      expect(statCalls).toBe(2);
    } finally {
      statSpy.mockRestore();
    }
  });

  it('reads only JS/TS source and ignores dependency/build/VCS directories', async () => {
    await writeFixture(sourceRoot, 'src/app.ts', 'export const ok = true;');
    await writeFixture(sourceRoot, 'src/view.tsx', 'export const View = () => null;');
    await writeFixture(sourceRoot, 'scripts/tool.py', 'print("not scanned")');
    await writeFixture(sourceRoot, 'node_modules/pkg/index.ts', 'export const dependency = true;');
    await writeFixture(sourceRoot, 'dist/bundle.js', 'const built = true;');
    await writeFixture(sourceRoot, '.git/hooks/check.js', 'const hook = true;');
    const result = await createService().scan({ rootKey: 'fixture' });
    expect(result.files.map((file) => file.path)).toEqual(['src/app.ts', 'src/view.tsx']);
    expect(result.summary.filesScanned).toBe(2);
    expect(result.skipped.unsupportedExtensions).toBeGreaterThanOrEqual(1);
    expect(result.skipped.ignoredDirectories).toBe(3);
  });

  it('enforces file-count, single-file and total-byte hard limits', async () => {
    await writeFixture(sourceRoot, 'a.ts', '12345');
    await writeFixture(sourceRoot, 'b.ts', '67890');
    await expect(
      createService({ limits: { maxFiles: 1 } }).scan({ rootKey: 'fixture' })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_SOURCE_FILE_LIMIT' });
    await expect(
      createService({ limits: { maxFileBytes: 4 } }).scan({ rootKey: 'fixture' })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_SOURCE_SINGLE_FILE_LIMIT' });
    await expect(
      createService({ limits: { maxTotalBytes: 9 } }).scan({ rootKey: 'fixture' })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_SOURCE_TOTAL_BYTES_LIMIT' });
  });

  it('enforces a scan timeout without executing source code', async () => {
    await writeFixture(sourceRoot, 'app.ts', 'throw new Error("must never execute");');
    const ticks = [0, 0, 5, 5];
    const service = createService({ limits: { timeoutMs: 1 }, now: () => ticks.shift() ?? 5 });
    await expect(service.scan({ rootKey: 'fixture' })).rejects.toMatchObject({
      code: 'PROJECT_GRADE_SOURCE_SCAN_TIMEOUT',
    });
  });

  it('produces identical canonical output for the same snapshot', async () => {
    await writeFixture(sourceRoot, 'z.ts', 'export const z = 1;');
    await writeFixture(sourceRoot, 'a.ts', 'export const a = 1; // TODO add validation');
    const service = createService();
    const first = await service.scan({ rootKey: 'fixture' });
    const second = await service.scan({ rootKey: 'fixture' });
    expect(second).toEqual(first);
    expect(first.snapshotHash).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(first.files.map((file) => file.path)).toEqual(['a.ts', 'z.ts']);
  });

  it('returns redacted TODO/FIXME/mock/secret signals, not source or secret values', async () => {
    await writeFixture(
      sourceRoot,
      'src/risky.ts',
      [
        '// TODO replace the mock before release',
        'const apiKey = "sk-project-grade-super-secret-value";',
        '// FIXME production path',
        'export const enabled = true;',
      ].join('\n')
    );
    const result = await createService().scan({ rootKey: 'fixture' });
    const serialized = JSON.stringify(result);
    expect(result.findings.map((finding) => finding.ruleKey)).toEqual(
      expect.arrayContaining([
        'source.todo',
        'source.fixme',
        'source.mock_marker',
        'security.suspected_hardcoded_secret',
      ])
    );
    expect(serialized).not.toContain('sk-project-grade-super-secret-value');
    expect(serialized).not.toContain('export const enabled');
    expect(result.sourceContentPersisted).toBe(false);
  });

  it('extracts static Express routes without importing scanned modules', async () => {
    await writeFixture(
      sourceRoot,
      'src/routes.ts',
      [
        "router.get('/health', handler);",
        'app.post("/api/projects", createProject);',
        'router.get(dynamicPath, handler);',
      ].join('\n')
    );
    const result = await createService().scan({ rootKey: 'fixture' });
    expect(result.routes).toEqual([
      expect.objectContaining({
        method: 'GET',
        routePath: '/health',
        filePath: 'src/routes.ts',
        line: 1,
      }),
      expect.objectContaining({
        method: 'POST',
        routePath: '/api/projects',
        filePath: 'src/routes.ts',
        line: 2,
      }),
    ]);
  });

  it('reports test, Docker, CI, license and package-manifest presence as metadata only', async () => {
    await writeFixture(
      sourceRoot,
      'src/app.test.ts',
      'it("works", () => expect(true).toBe(true));'
    );
    await writeFixture(sourceRoot, 'Dockerfile', 'FROM node:20-alpine');
    await writeFixture(sourceRoot, '.github/workflows/ci.yml', 'name: ci');
    await writeFixture(sourceRoot, 'LICENSE', 'MIT License');
    await writeFixture(sourceRoot, 'package.json', '{"name":"fixture"}');
    const result = await createService().scan({ rootKey: 'fixture' });
    expect(result.projectSignals).toEqual({
      hasTests: true,
      hasDocker: true,
      hasCi: true,
      hasLicense: true,
      hasPackageManifest: true,
    });
    expect(result.summary.filesScanned).toBe(1);
    expect(result.files[0].path).toBe('src/app.test.ts');
  });

  it('skips binary data disguised as a supported source file', async () => {
    await writeFixture(sourceRoot, 'binary.ts', Buffer.from([0x00, 0x01, 0x02, 0x03]));
    await writeFixture(sourceRoot, 'valid.ts', 'export const valid = true;');
    const result = await createService().scan({ rootKey: 'fixture' });
    expect(result.files.map((file) => file.path)).toEqual(['valid.ts']);
    expect(result.skipped.binaryFiles).toBe(1);
  });

  it('keeps the first slice explicitly local-only and non-production', async () => {
    await writeFixture(sourceRoot, 'app.ts', 'export const app = true;');
    const result = await createService().scan({ rootKey: 'fixture' });
    expect(result.evidenceScope).toBe('authorized_local_source_snapshot');
    expect(result.productionAcceptance).toBe(false);
    expect(result.externalScanningEnabled).toBe(false);
    expect(result.executedSourceCode).toBe(false);
    expect(result.installedDependencies).toBe(false);
    expect(result.networkAccessed).toBe(false);
  });
});
