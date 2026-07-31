import { createHash } from 'crypto';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { AppError } from '../lib/http-error';
import {
  DEFAULT_PROJECT_GRADE_SOURCE_SCAN_LIMITS,
  PROJECT_GRADE_SOURCE_EXTENSIONS,
  PROJECT_GRADE_SOURCE_IGNORED_DIRECTORIES,
  PROJECT_GRADE_SOURCE_SCAN_VERSION,
  mergeProjectGradeSourceScanLimits,
} from '../project-grade/source-scan.config';
import type {
  ProjectGradeSourceFinding,
  ProjectGradeSourceFindingSeverity,
  ProjectGradeSourceProjectSignals,
  ProjectGradeSourceRoute,
  ProjectGradeSourceScanLimits,
  ProjectGradeSourceScanRequest,
  ProjectGradeSourceScanResult,
} from '../project-grade/source-scan.types';

export interface ProjectGradeSourceScanServiceOptions {
  allowedRoots?: Record<string, string>;
  limits?: Partial<ProjectGradeSourceScanLimits>;
  now?: () => number;
}

interface MutableScanState {
  startedAt: number;
  candidateFiles: number;
  totalCandidateBytes: number;
  files: ProjectGradeSourceScanResult['files'];
  findings: ProjectGradeSourceFinding[];
  routes: ProjectGradeSourceRoute[];
  projectSignals: ProjectGradeSourceProjectSignals;
  skipped: ProjectGradeSourceScanResult['skipped'];
}

const SOURCE_SIGNAL_RULES: Array<{
  ruleKey: string;
  severity: ProjectGradeSourceFindingSeverity;
  pattern: RegExp;
  message: string;
}> = [
  {
    ruleKey: 'source.todo',
    severity: 'info',
    pattern: /\bTODO\b/i,
    message: '发现待办标记，需要确认是否阻塞交付。',
  },
  {
    ruleKey: 'source.fixme',
    severity: 'warning',
    pattern: /\bFIXME\b/i,
    message: '发现待修复标记，需要纳入整改清单。',
  },
  {
    ruleKey: 'source.mock_marker',
    severity: 'warning',
    pattern: /\b(?:mock|stub|fake)\b/i,
    message: '发现 Mock/Stub/Fake 标记，需要核验生产路径。',
  },
  {
    ruleKey: 'security.suspected_hardcoded_secret',
    severity: 'high',
    pattern:
      /\b(?:api[_-]?key|secret|access[_-]?token|auth[_-]?token|password|passwd)\b\s*[:=]\s*["'`][^"'`\r\n]{8,}["'`]/i,
    message: '发现疑似硬编码凭据；结果已脱敏，需人工复核并轮换相关凭据。',
  },
];

const EXPRESS_ROUTE_PATTERN =
  /\b(?:app|router)\s*\.\s*(get|post|put|patch|delete|options|head|use)\s*\(\s*(["'`])([^"'`\r\n]+)\2/g;

function sha256(value: Buffer | string): string {
  return createHash('sha256').update(value).digest('hex');
}

function toPortablePath(value: string): string {
  return value.split(path.sep).join('/');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function isPathWithin(root: string, candidate: string): boolean {
  const relative = path.relative(root, candidate);
  return (
    relative === '' ||
    (!path.isAbsolute(relative) && relative !== '..' && !relative.startsWith(`..${path.sep}`))
  );
}

function isLikelyBinary(content: Buffer): boolean {
  if (content.includes(0)) return true;
  if (content.length === 0) return false;
  let controls = 0;
  for (const byte of content) {
    if (byte < 7 || (byte > 13 && byte < 32)) controls += 1;
  }
  return controls / content.length > 0.1;
}

function isTestPath(relativePath: string): boolean {
  return (
    /(?:^|\/)(?:__tests__|tests?)(?:\/|$)/i.test(relativePath) ||
    /\.(?:test|spec)\.(?:[cm]?[jt]sx?)$/i.test(relativePath)
  );
}

function updateProjectSignals(
  signals: ProjectGradeSourceProjectSignals,
  relativePath: string
): void {
  const portable = relativePath.toLowerCase();
  const name = path.posix.basename(portable);
  signals.hasTests ||= isTestPath(relativePath);
  signals.hasDocker ||=
    name === 'dockerfile' || /^docker-compose(?:\.[a-z0-9_-]+)?\.ya?ml$/i.test(name);
  signals.hasCi ||=
    portable === '.cnb.yml' ||
    portable === '.gitlab-ci.yml' ||
    portable.startsWith('.github/workflows/') ||
    portable.startsWith('.cnb/');
  signals.hasLicense ||= /^licen[cs]e(?:\..+)?$/i.test(name);
  signals.hasPackageManifest ||= name === 'package.json';
}

function safeFindingFingerprint(ruleKey: string, filePath: string, line: number): string {
  return sha256(`${ruleKey}\0${filePath}\0${line}`).slice(0, 32);
}

export class ProjectGradeSourceScanService {
  private readonly allowedRoots: ReadonlyMap<string, string>;
  private readonly limits: ProjectGradeSourceScanLimits;
  private readonly now: () => number;

  constructor(options: ProjectGradeSourceScanServiceOptions = {}) {
    this.allowedRoots = new Map(Object.entries(options.allowedRoots || {}));
    this.limits = mergeProjectGradeSourceScanLimits(options.limits);
    this.now = options.now || Date.now;
  }

  async scan(request: ProjectGradeSourceScanRequest): Promise<ProjectGradeSourceScanResult> {
    const rootKey = String(request.rootKey || '').trim();
    const configuredRoot = this.allowedRoots.get(rootKey);
    if (!configuredRoot) {
      throw new AppError(403, '源码根目录未获服务端授权', 'PROJECT_GRADE_SOURCE_ROOT_NOT_ALLOWED');
    }

    const relativePath = String(request.relativePath || '').trim();
    if (relativePath.includes('\0')) {
      throw new AppError(422, '源码相对路径无效', 'PROJECT_GRADE_SOURCE_PATH_INVALID');
    }
    if (relativePath && path.isAbsolute(relativePath)) {
      throw new AppError(422, '不接受客户端绝对路径', 'PROJECT_GRADE_SOURCE_PATH_ABSOLUTE');
    }

    const startedAt = this.now();
    const rootRealPath = await this.resolveRealPath(
      configuredRoot,
      'PROJECT_GRADE_SOURCE_ROOT_UNAVAILABLE'
    );
    const requestedPath = path.resolve(rootRealPath, relativePath || '.');
    const targetRealPath = await this.resolveRealPath(
      requestedPath,
      'PROJECT_GRADE_SOURCE_PATH_UNAVAILABLE'
    );
    if (!isPathWithin(rootRealPath, targetRealPath)) {
      throw new AppError(403, '源码路径超出授权根目录', 'PROJECT_GRADE_SOURCE_PATH_OUTSIDE_ROOT');
    }

    const state: MutableScanState = {
      startedAt,
      candidateFiles: 0,
      totalCandidateBytes: 0,
      files: [],
      findings: [],
      routes: [],
      projectSignals: {
        hasTests: false,
        hasDocker: false,
        hasCi: false,
        hasLicense: false,
        hasPackageManifest: false,
      },
      skipped: {
        ignoredDirectories: 0,
        unsupportedExtensions: 0,
        binaryFiles: 0,
        symbolicLinks: 0,
      },
    };

    this.assertDeadline(state);
    const targetStat = await fs.lstat(targetRealPath);
    if (!targetStat.isDirectory()) {
      throw new AppError(
        422,
        '授权源码目标必须是目录',
        'PROJECT_GRADE_SOURCE_TARGET_NOT_DIRECTORY'
      );
    }

    await this.walkDirectory(rootRealPath, targetRealPath, state);
    state.files.sort((a, b) => compareText(a.path, b.path));
    state.findings.sort(
      (a, b) =>
        compareText(a.filePath, b.filePath) || a.line - b.line || compareText(a.ruleKey, b.ruleKey)
    );
    state.routes.sort(
      (a, b) =>
        compareText(a.filePath, b.filePath) || a.line - b.line || compareText(a.method, b.method)
    );

    const canonicalSnapshot = state.files
      .map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}`)
      .join('\n');

    return {
      scanVersion: PROJECT_GRADE_SOURCE_SCAN_VERSION,
      rootKey,
      snapshotHash: `sha256:${sha256(canonicalSnapshot)}`,
      files: state.files,
      findings: state.findings,
      routes: state.routes,
      projectSignals: state.projectSignals,
      summary: {
        filesScanned: state.files.length,
        totalBytes: state.files.reduce((sum, file) => sum + file.sizeBytes, 0),
        findings: state.findings.length,
        routes: state.routes.length,
      },
      skipped: state.skipped,
      limits: { ...this.limits },
      evidenceScope: 'authorized_local_source_snapshot',
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
      executedSourceCode: false,
      installedDependencies: false,
      networkAccessed: false,
    };
  }

  private async walkDirectory(
    rootRealPath: string,
    directory: string,
    state: MutableScanState
  ): Promise<void> {
    this.assertDeadline(state);
    const directoryRealPath = await this.resolveWalkDirectory(rootRealPath, directory);
    const entries = await fs.readdir(directoryRealPath, { withFileTypes: true });
    entries.sort((a, b) => compareText(a.name, b.name));

    for (const entry of entries) {
      this.assertDeadline(state);
      const absolutePath = path.join(directoryRealPath, entry.name);
      const relativePath = toPortablePath(path.relative(rootRealPath, absolutePath));
      const currentStat = await this.lstatForScan(
        absolutePath,
        'PROJECT_GRADE_SOURCE_ENTRY_UNAVAILABLE'
      );

      if (entry.isSymbolicLink() || currentStat.isSymbolicLink()) {
        const linkedRealPath = await this.resolveRealPath(
          absolutePath,
          'PROJECT_GRADE_SOURCE_SYMLINK_INVALID'
        );
        if (!isPathWithin(rootRealPath, linkedRealPath)) {
          throw new AppError(
            403,
            '符号链接超出授权源码根目录',
            'PROJECT_GRADE_SOURCE_SYMLINK_ESCAPE'
          );
        }
        state.skipped.symbolicLinks += 1;
        continue;
      }

      if (
        currentStat.isDirectory() &&
        PROJECT_GRADE_SOURCE_IGNORED_DIRECTORIES.has(entry.name.toLowerCase())
      ) {
        state.skipped.ignoredDirectories += 1;
        continue;
      }

      if (currentStat.isDirectory()) {
        await this.walkDirectory(rootRealPath, absolutePath, state);
        continue;
      }
      if (!currentStat.isFile()) continue;

      updateProjectSignals(state.projectSignals, relativePath);
      if (!PROJECT_GRADE_SOURCE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
        state.skipped.unsupportedExtensions += 1;
        continue;
      }
      await this.scanSourceFile(rootRealPath, absolutePath, relativePath, state);
    }
  }

  private async scanSourceFile(
    rootRealPath: string,
    absolutePath: string,
    relativePath: string,
    state: MutableScanState
  ): Promise<void> {
    const initialLinkStat = await this.lstatForScan(
      absolutePath,
      'PROJECT_GRADE_SOURCE_FILE_UNAVAILABLE'
    );
    if (initialLinkStat.isSymbolicLink()) {
      state.skipped.symbolicLinks += 1;
      return;
    }
    const fileRealPath = await this.resolveRealPath(
      absolutePath,
      'PROJECT_GRADE_SOURCE_FILE_UNAVAILABLE'
    );
    if (!isPathWithin(rootRealPath, fileRealPath)) {
      throw new AppError(403, '源码文件超出授权根目录', 'PROJECT_GRADE_SOURCE_SYMLINK_ESCAPE');
    }
    const stat = await fs.stat(fileRealPath);
    if (!stat.isFile()) return;
    state.candidateFiles += 1;
    if (state.candidateFiles > this.limits.maxFiles) {
      throw new AppError(413, '源码文件数量超过扫描上限', 'PROJECT_GRADE_SOURCE_FILE_LIMIT');
    }
    if (stat.size > this.limits.maxFileBytes) {
      throw new AppError(413, '单个源码文件超过扫描上限', 'PROJECT_GRADE_SOURCE_SINGLE_FILE_LIMIT');
    }
    if (state.totalCandidateBytes + stat.size > this.limits.maxTotalBytes) {
      throw new AppError(413, '源码总字节数超过扫描上限', 'PROJECT_GRADE_SOURCE_TOTAL_BYTES_LIMIT');
    }

    this.assertDeadline(state);
    const content = await this.readBoundedSourceFile(fileRealPath, state);
    await this.assertStableSourceFile(absolutePath, fileRealPath, stat, content.length);
    this.assertDeadline(state);
    if (isLikelyBinary(content)) {
      state.skipped.binaryFiles += 1;
      return;
    }

    const fileHash = sha256(content);
    state.files.push({ path: relativePath, sizeBytes: content.length, sha256: fileHash });
    this.collectStaticSignals(content.toString('utf8'), relativePath, state);
  }

  private async readBoundedSourceFile(
    absolutePath: string,
    state: MutableScanState
  ): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let fileBytes = 0;
    for await (const chunk of createReadStream(absolutePath, { highWaterMark: 64 * 1024 })) {
      this.assertDeadline(state);
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      fileBytes += buffer.length;
      if (fileBytes > this.limits.maxFileBytes) {
        throw new AppError(
          413,
          '单个源码文件超过扫描上限',
          'PROJECT_GRADE_SOURCE_SINGLE_FILE_LIMIT'
        );
      }
      if (state.totalCandidateBytes + fileBytes > this.limits.maxTotalBytes) {
        throw new AppError(
          413,
          '源码总字节数超过扫描上限',
          'PROJECT_GRADE_SOURCE_TOTAL_BYTES_LIMIT'
        );
      }
      chunks.push(buffer);
    }
    state.totalCandidateBytes += fileBytes;
    return Buffer.concat(chunks, fileBytes);
  }

  private collectStaticSignals(source: string, filePath: string, state: MutableScanState): void {
    const lines = source.split(/\r?\n/);
    lines.forEach((lineText, index) => {
      const line = index + 1;
      for (const rule of SOURCE_SIGNAL_RULES) {
        if (!rule.pattern.test(lineText)) continue;
        state.findings.push({
          ruleKey: rule.ruleKey,
          severity: rule.severity,
          filePath,
          line,
          message: rule.message,
          fingerprint: safeFindingFingerprint(rule.ruleKey, filePath, line),
        });
      }

      EXPRESS_ROUTE_PATTERN.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = EXPRESS_ROUTE_PATTERN.exec(lineText)) !== null) {
        const routePath = match[3];
        if (!routePath || routePath.includes('${') || routePath.length > 300) continue;
        state.routes.push({
          framework: 'express',
          method: String(match[1]).toUpperCase(),
          routePath,
          filePath,
          line,
        });
      }
    });
  }

  private async resolveWalkDirectory(rootRealPath: string, directory: string): Promise<string> {
    const linkStat = await this.lstatForScan(
      directory,
      'PROJECT_GRADE_SOURCE_DIRECTORY_UNAVAILABLE'
    );
    if (linkStat.isSymbolicLink()) {
      throw new AppError(
        403,
        '不跟随源码目录符号链接',
        'PROJECT_GRADE_SOURCE_SYMLINK_ESCAPE'
      );
    }
    if (!linkStat.isDirectory()) {
      throw new AppError(
        422,
        '授权源码目标必须是目录',
        'PROJECT_GRADE_SOURCE_TARGET_NOT_DIRECTORY'
      );
    }
    const directoryRealPath = await this.resolveRealPath(
      directory,
      'PROJECT_GRADE_SOURCE_DIRECTORY_UNAVAILABLE'
    );
    if (!isPathWithin(rootRealPath, directoryRealPath)) {
      throw new AppError(
        403,
        '源码目录超出授权根目录',
        'PROJECT_GRADE_SOURCE_SYMLINK_ESCAPE'
      );
    }
    return directoryRealPath;
  }

  private async assertStableSourceFile(
    requestedPath: string,
    fileRealPath: string,
    initialStat: Awaited<ReturnType<typeof fs.stat>>,
    bytesRead: number
  ): Promise<void> {
    const finalLinkStat = await this.lstatForScan(
      requestedPath,
      'PROJECT_GRADE_SOURCE_FILE_UNAVAILABLE'
    );
    const finalRealPath = await this.resolveRealPath(
      requestedPath,
      'PROJECT_GRADE_SOURCE_FILE_UNAVAILABLE'
    );
    const finalStat = await fs.stat(finalRealPath);
    const identityChanged =
      finalLinkStat.isSymbolicLink() ||
      path.resolve(finalRealPath) !== path.resolve(fileRealPath) ||
      finalStat.dev !== initialStat.dev ||
      finalStat.ino !== initialStat.ino ||
      finalStat.size !== initialStat.size ||
      finalStat.size !== bytesRead ||
      finalStat.mtimeMs !== initialStat.mtimeMs;
    if (identityChanged) {
      throw new AppError(
        409,
        '源码文件在扫描期间发生变化，请重试',
        'PROJECT_GRADE_SOURCE_FILE_CHANGED'
      );
    }
  }

  private async lstatForScan(target: string, code: string): Promise<Awaited<ReturnType<typeof fs.lstat>>> {
    try {
      return await fs.lstat(target);
    } catch {
      throw new AppError(422, '授权源码路径不可用', code);
    }
  }

  private assertDeadline(state: Pick<MutableScanState, 'startedAt'>): void {
    if (this.now() - state.startedAt > this.limits.timeoutMs) {
      throw new AppError(504, '源码扫描超过时间上限', 'PROJECT_GRADE_SOURCE_SCAN_TIMEOUT');
    }
  }

  private async resolveRealPath(target: string, code: string): Promise<string> {
    try {
      return await fs.realpath(target);
    } catch {
      throw new AppError(422, '授权源码路径不可用', code);
    }
  }
}

export const projectGradeSourceScanDefaults = DEFAULT_PROJECT_GRADE_SOURCE_SCAN_LIMITS;
