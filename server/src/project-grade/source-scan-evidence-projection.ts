import { createHash } from 'crypto';
import {
  DEFAULT_PROJECT_GRADE_RULES,
  EVIDENCE_FACTORS,
  type ProjectGradeDimensionKey,
} from './config';
import { PROJECT_GRADE_SOURCE_SCAN_VERSION } from './source-scan.config';
import { normalizeProjectGradeSourceRelativePath } from './source-scan-safety';
import type {
  ProjectGradeSourceFinding,
  ProjectGradeSourceProjectSignals,
  ProjectGradeSourceRoute,
  ProjectGradeSourceScanResult,
} from './source-scan.types';

export const PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION = 1 as const;

export type ProjectGradeSourceEvidenceProjectionErrorCode =
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION_UNSUPPORTED'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_SOURCE_NOT_PROJECTABLE'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_SCAN_VERSION_UNSUPPORTED'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_BOUNDARY'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_PATH'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_FINGERPRINT_INVALID'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_RULE_UNMAPPED'
  | 'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT';

export class ProjectGradeSourceEvidenceProjectionError extends Error {
  constructor(
    public readonly code: ProjectGradeSourceEvidenceProjectionErrorCode,
    message: string
  ) {
    super(message);
    this.name = 'ProjectGradeSourceEvidenceProjectionError';
  }
}

export interface ProjectGradeSourceScanEvidenceSource {
  scanId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  status: 'succeeded' | 'failed';
  rootKey: string;
  scanVersion?: string;
  snapshotHash?: string;
  result?: ProjectGradeSourceScanResult;
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  createdAt: string | Date;
}

export type ProjectGradeSourceEvidenceDraftKind =
  'snapshot_manifest' | 'project_signal' | 'route_inventory' | 'finding';

export interface ProjectGradeSourceEvidenceDraftMetadata {
  projectionVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  sourceEvidenceKind: ProjectGradeSourceEvidenceDraftKind;
  sourceRuleKey?: string;
  sourceSignal?: keyof ProjectGradeSourceProjectSignals;
  sourceFindingFingerprint?: string;
  sourceFindingSeverity?: ProjectGradeSourceFinding['severity'];
  filePath?: string;
  line?: number;
  fileCount?: number;
  totalBytes?: number;
  findingCount?: number;
  routeCount?: number;
  fileManifestDigest?: string;
  routeInventoryDigest?: string;
  skipped?: ProjectGradeSourceScanResult['skipped'];
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
}

export interface ProjectGradeSourceEvidenceDraft {
  evidenceId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  rulePackKey: string;
  rulePackVersion: string;
  ruleKey: string;
  dimensionKey: ProjectGradeDimensionKey;
  level: 'source_static';
  factor: typeof EVIDENCE_FACTORS.source_static;
  sourceType: 'source_file';
  source: string;
  collectedAt: string;
  title: string;
  description: string;
  kind: ProjectGradeSourceEvidenceDraftKind;
  metadata: ProjectGradeSourceEvidenceDraftMetadata;
  projectionVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION;
  scoringDisposition: 'draft_only_not_adopted';
}

export interface ProjectGradeSourceEvidenceProjection {
  projectionVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION;
  sourceScanId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  collectedAt: string;
  evidenceScope: 'authorized_local_source_snapshot';
  scoringDisposition: 'draft_only_not_adopted';
  productionAcceptance: false;
  externalScanningEnabled: false;
  drafts: ProjectGradeSourceEvidenceDraft[];
}

interface DraftDescriptor {
  kind: ProjectGradeSourceEvidenceDraftKind;
  dimensionKey: ProjectGradeDimensionKey;
  title: string;
  description: string;
  identity: Record<string, unknown>;
  metadata: Omit<
    ProjectGradeSourceEvidenceDraftMetadata,
    | 'projectionVersion'
    | 'sourceScanId'
    | 'sourceScanVersion'
    | 'snapshotHash'
    | 'sourceEvidenceKind'
    | 'productionAcceptance'
    | 'externalScanningEnabled'
    | 'sourceContentPersisted'
  >;
}

const FINDING_MAPPINGS: Readonly<
  Record<string, Pick<DraftDescriptor, 'dimensionKey' | 'title' | 'description'>>
> = {
  'source.todo': {
    dimensionKey: 'code_maintainability',
    title: '源码快照包含待办标记',
    description:
      '授权源码快照中发现待办标记；该草稿仅记录静态事实，需在评估运行中显式采纳后才能参与解释。',
  },
  'source.fixme': {
    dimensionKey: 'code_maintainability',
    title: '源码快照包含待修复标记',
    description: '授权源码快照中发现待修复标记；该草稿不自动改变完成度或最终分数。',
  },
  'source.mock_marker': {
    dimensionKey: 'functional_reality',
    title: '源码快照包含 Mock、Stub 或 Fake 标记',
    description: '授权源码快照中发现模拟实现标记；需要后续测试或生产证据确认是否进入真实交付路径。',
  },
  'security.suspected_hardcoded_secret': {
    dimensionKey: 'security_compliance',
    title: '源码快照包含疑似硬编码凭据',
    description:
      '授权源码快照中发现疑似硬编码凭据；原始值未进入证据草稿，必须人工复核并按密钥治理流程处理。',
  },
};

const SIGNAL_MAPPINGS: Readonly<
  Record<
    keyof ProjectGradeSourceProjectSignals,
    Pick<DraftDescriptor, 'dimensionKey' | 'title' | 'description'>
  >
> = {
  hasTests: {
    dimensionKey: 'code_maintainability',
    title: '源码快照包含测试文件信号',
    description: '授权源码快照存在测试文件命名或目录信号；这不证明测试已执行或通过。',
  },
  hasDocker: {
    dimensionKey: 'devops_reliability',
    title: '源码快照包含容器化配置信号',
    description: '授权源码快照存在 Docker 或 Compose 配置信号；这不证明镜像已构建或部署。',
  },
  hasCi: {
    dimensionKey: 'devops_reliability',
    title: '源码快照包含持续集成配置信号',
    description: '授权源码快照存在 CI 配置信号；这不证明远端流水线已运行或成功。',
  },
  hasLicense: {
    dimensionKey: 'commercial_delivery',
    title: '源码快照包含许可证文件信号',
    description: '授权源码快照存在许可证文件信号；这不替代许可证兼容性、归属或商业授权审查。',
  },
  hasPackageManifest: {
    dimensionKey: 'architecture_engineering',
    title: '源码快照包含包清单信号',
    description: '授权源码快照存在 package.json 信号；这不证明依赖已安装、审计或可重复构建。',
  },
};

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort(compareText)
      .reduce<Record<string, unknown>>((result, key) => {
        const child = (value as Record<string, unknown>)[key];
        if (child !== undefined) result[key] = stableValue(child);
        return result;
      }, {});
  }
  return value;
}

function stableStringify(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

function projectionError(
  code: ProjectGradeSourceEvidenceProjectionErrorCode,
  message: string
): never {
  throw new ProjectGradeSourceEvidenceProjectionError(code, message);
}

function requireIdentifier(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0 || value.trim() !== value) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_SOURCE_NOT_PROJECTABLE',
      `Source scan ${field} is not projectable`
    );
  }
  return value;
}

function requireNonNegativeInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 0) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan numeric evidence is inconsistent'
    );
  }
  return Number(value);
}

function requirePositiveInteger(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan limit evidence is inconsistent'
    );
  }
  return Number(value);
}

function requireSafePath(value: unknown): string {
  const normalized = normalizeProjectGradeSourceRelativePath(value);
  if (!normalized) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_PATH',
      'Source scan evidence path is outside the persisted relative-path boundary'
    );
  }
  return normalized;
}

function normalizeCollectedAt(value: string | Date): string {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_SOURCE_NOT_PROJECTABLE',
      'Source scan collection time is invalid'
    );
  }
  return date.toISOString();
}

function expectedFindingFingerprint(ruleKey: string, filePath: string, line: number): string {
  return sha256(`${ruleKey}\0${filePath}\0${line}`).slice(0, 32);
}

function assertSafeBoundary(
  source: ProjectGradeSourceScanEvidenceSource
): ProjectGradeSourceScanResult {
  if (
    source.status !== 'succeeded' ||
    !source.result ||
    !source.scanVersion ||
    !source.snapshotHash
  ) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_SOURCE_NOT_PROJECTABLE',
      'Only completed source scans with a persisted result can be projected'
    );
  }

  const result = source.result;
  if (source.scanVersion !== PROJECT_GRADE_SOURCE_SCAN_VERSION) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_SCAN_VERSION_UNSUPPORTED',
      'The source scan version is not supported by this projection version'
    );
  }
  if (
    source.rootKey !== result.rootKey ||
    source.scanVersion !== result.scanVersion ||
    source.snapshotHash !== result.snapshotHash
  ) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan history and result provenance do not match'
    );
  }
  if (
    source.evidenceScope !== 'authorized_local_source_snapshot' ||
    result.evidenceScope !== 'authorized_local_source_snapshot' ||
    source.productionAcceptance !== false ||
    result.productionAcceptance !== false ||
    result.externalScanningEnabled !== false ||
    result.sourceContentPersisted !== false ||
    result.executedSourceCode !== false ||
    result.installedDependencies !== false ||
    result.networkAccessed !== false
  ) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_UNSAFE_BOUNDARY',
      'Source scan result violates the local read-only evidence boundary'
    );
  }
  if (!/^sha256:[a-f0-9]{64}$/.test(result.snapshotHash)) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan snapshot hash is invalid'
    );
  }

  return result;
}

function validateAndCanonicalize(result: ProjectGradeSourceScanResult): {
  files: ProjectGradeSourceScanResult['files'];
  findings: ProjectGradeSourceFinding[];
  routes: ProjectGradeSourceRoute[];
  fileManifestDigest: string;
  routeInventoryDigest: string;
} {
  const files = result.files.map((file) => ({
    path: requireSafePath(file.path),
    sizeBytes: requireNonNegativeInteger(file.sizeBytes),
    sha256: String(file.sha256),
  }));
  if (files.some((file) => !/^[a-f0-9]{64}$/.test(file.sha256))) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan file digest is invalid'
    );
  }
  files.sort((left, right) => compareText(left.path, right.path));
  if (new Set(files.map((file) => file.path)).size !== files.length) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan file manifest contains duplicate paths'
    );
  }

  const canonicalFiles = files
    .map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}`)
    .join('\n');
  const expectedSnapshotHash = `sha256:${sha256(canonicalFiles)}`;
  if (expectedSnapshotHash !== result.snapshotHash) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan snapshot hash does not match the file manifest'
    );
  }

  const findings = result.findings.map((finding) => {
    const filePath = requireSafePath(finding.filePath);
    const line = requirePositiveInteger(finding.line);
    const mapping = FINDING_MAPPINGS[finding.ruleKey];
    if (!mapping) {
      return projectionError(
        'PROJECT_GRADE_SOURCE_EVIDENCE_RULE_UNMAPPED',
        'Source scan finding rule has no explicit ProjectGrade mapping'
      );
    }
    const fingerprint = String(finding.fingerprint);
    if (fingerprint !== expectedFindingFingerprint(finding.ruleKey, filePath, line)) {
      return projectionError(
        'PROJECT_GRADE_SOURCE_EVIDENCE_FINGERPRINT_INVALID',
        'Source scan finding fingerprint does not match its stable identity'
      );
    }
    if (!['info', 'warning', 'high'].includes(finding.severity)) {
      return projectionError(
        'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
        'Source scan finding severity is invalid'
      );
    }
    return { ...finding, filePath, line, fingerprint };
  });
  findings.sort(
    (left, right) =>
      compareText(left.filePath, right.filePath) ||
      left.line - right.line ||
      compareText(left.ruleKey, right.ruleKey)
  );
  if (new Set(findings.map((finding) => finding.fingerprint)).size !== findings.length) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan findings contain duplicate stable identities'
    );
  }

  const routes = result.routes.map((route) => {
    const filePath = requireSafePath(route.filePath);
    const line = requirePositiveInteger(route.line);
    if (
      route.framework !== 'express' ||
      typeof route.method !== 'string' ||
      !/^[A-Z]+$/.test(route.method) ||
      typeof route.routePath !== 'string' ||
      route.routePath.length === 0 ||
      route.routePath.length > 300
    ) {
      return projectionError(
        'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
        'Source scan route inventory is invalid'
      );
    }
    return { ...route, filePath, line };
  });
  routes.sort(
    (left, right) =>
      compareText(left.filePath, right.filePath) ||
      left.line - right.line ||
      compareText(left.method, right.method) ||
      compareText(left.routePath, right.routePath)
  );

  const summary = result.summary;
  const totalBytes = files.reduce((sum, file) => sum + file.sizeBytes, 0);
  if (
    requireNonNegativeInteger(summary.filesScanned) !== files.length ||
    requireNonNegativeInteger(summary.totalBytes) !== totalBytes ||
    requireNonNegativeInteger(summary.findings) !== findings.length ||
    requireNonNegativeInteger(summary.routes) !== routes.length
  ) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source scan summary does not match persisted evidence arrays'
    );
  }

  for (const value of Object.values(result.skipped)) requireNonNegativeInteger(value);
  for (const value of Object.values(result.limits)) requirePositiveInteger(value);
  for (const value of Object.values(result.projectSignals)) {
    if (typeof value !== 'boolean') {
      return projectionError(
        'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
        'Source scan project signal is invalid'
      );
    }
  }

  return {
    files,
    findings,
    routes,
    fileManifestDigest: `sha256:${sha256(canonicalFiles)}`,
    routeInventoryDigest: `sha256:${sha256(
      routes
        .map(
          (route) =>
            `${route.framework}\0${route.method}\0${route.routePath}\0${route.filePath}\0${route.line}`
        )
        .join('\n')
    )}`,
  };
}

function ruleForDimension(dimensionKey: ProjectGradeDimensionKey) {
  const rule = DEFAULT_PROJECT_GRADE_RULES.find(
    (candidate) => candidate.dimensionKey === dimensionKey
  );
  if (!rule) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RULE_UNMAPPED',
      'ProjectGrade baseline rule mapping is missing'
    );
  }
  return rule;
}

function draftIdentityHash(
  source: ProjectGradeSourceScanEvidenceSource,
  result: ProjectGradeSourceScanResult,
  descriptor: DraftDescriptor
): string {
  return sha256(
    stableStringify({
      projectionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
      projectId: source.projectId,
      ownerId: source.ownerId,
      teamId: source.teamId ?? null,
      sourceScanVersion: result.scanVersion,
      snapshotHash: result.snapshotHash,
      kind: descriptor.kind,
      dimensionKey: descriptor.dimensionKey,
      identity: descriptor.identity,
    })
  );
}

function createDraft(
  source: ProjectGradeSourceScanEvidenceSource,
  result: ProjectGradeSourceScanResult,
  collectedAt: string,
  descriptor: DraftDescriptor
): ProjectGradeSourceEvidenceDraft {
  const rule = ruleForDimension(descriptor.dimensionKey);
  const team = source.teamId === undefined ? {} : { teamId: source.teamId };
  return {
    evidenceId: `source-evidence:v1:${draftIdentityHash(source, result, descriptor)}`,
    projectId: source.projectId,
    ownerId: source.ownerId,
    ...team,
    rulePackKey: rule.rulePackKey,
    rulePackVersion: rule.rulePackVersion,
    ruleKey: rule.key,
    dimensionKey: rule.dimensionKey,
    level: 'source_static',
    factor: EVIDENCE_FACTORS.source_static,
    sourceType: 'source_file',
    source: `projectgrade-source-scan:${result.snapshotHash}`,
    collectedAt,
    title: descriptor.title,
    description: descriptor.description,
    kind: descriptor.kind,
    metadata: {
      projectionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
      sourceScanId: source.scanId,
      sourceScanVersion: result.scanVersion,
      snapshotHash: result.snapshotHash,
      sourceEvidenceKind: descriptor.kind,
      ...descriptor.metadata,
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
    },
    projectionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
    scoringDisposition: 'draft_only_not_adopted',
  };
}

function buildDescriptors(
  result: ProjectGradeSourceScanResult,
  canonical: ReturnType<typeof validateAndCanonicalize>
): DraftDescriptor[] {
  const descriptors: DraftDescriptor[] = [
    {
      kind: 'snapshot_manifest',
      dimensionKey: 'architecture_engineering',
      title: '授权源码快照清单已生成',
      description:
        '记录可重建的源码文件摘要、扫描边界与聚合计数；不包含完整源码，也不代表构建、部署或生产验收。',
      identity: { snapshotHash: result.snapshotHash },
      metadata: {
        fileCount: canonical.files.length,
        totalBytes: result.summary.totalBytes,
        findingCount: canonical.findings.length,
        routeCount: canonical.routes.length,
        fileManifestDigest: canonical.fileManifestDigest,
        skipped: { ...result.skipped },
      },
    },
  ];

  const signalKeys = Object.keys(SIGNAL_MAPPINGS) as Array<keyof ProjectGradeSourceProjectSignals>;
  for (const signal of signalKeys.sort(compareText)) {
    if (!result.projectSignals[signal]) continue;
    const mapping = SIGNAL_MAPPINGS[signal];
    descriptors.push({
      kind: 'project_signal',
      ...mapping,
      identity: { sourceSignal: signal },
      metadata: { sourceSignal: signal },
    });
  }

  if (canonical.routes.length > 0) {
    descriptors.push({
      kind: 'route_inventory',
      dimensionKey: 'requirements_completeness',
      title: '源码快照包含静态路由清单信号',
      description:
        '授权源码快照包含静态 Express 路由信号；路由字面量未进入草稿，且该信号不证明接口已运行或可从生产访问。',
      identity: { routeInventoryDigest: canonical.routeInventoryDigest },
      metadata: {
        routeCount: canonical.routes.length,
        routeInventoryDigest: canonical.routeInventoryDigest,
      },
    });
  }

  for (const finding of canonical.findings) {
    const mapping = FINDING_MAPPINGS[finding.ruleKey];
    descriptors.push({
      kind: 'finding',
      ...mapping,
      identity: { sourceFindingFingerprint: finding.fingerprint },
      metadata: {
        sourceRuleKey: finding.ruleKey,
        sourceFindingFingerprint: finding.fingerprint,
        sourceFindingSeverity: finding.severity,
        filePath: finding.filePath,
        line: finding.line,
      },
    });
  }

  return descriptors;
}

export function projectSourceScanEvidenceDrafts(
  source: ProjectGradeSourceScanEvidenceSource,
  options: { projectionVersion?: number } = {}
): ProjectGradeSourceEvidenceProjection {
  const projectionVersion =
    options.projectionVersion ?? PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION;
  if (projectionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION_UNSUPPORTED',
      'Requested SourceScan evidence projection version is not supported'
    );
  }

  const scanId = requireIdentifier(source.scanId, 'scanId');
  const projectId = requireIdentifier(source.projectId, 'projectId');
  const ownerId = requireIdentifier(source.ownerId, 'ownerId');
  const teamId =
    source.teamId === undefined ? undefined : requireIdentifier(source.teamId, 'teamId');
  const collectedAt = normalizeCollectedAt(source.createdAt);
  const result = assertSafeBoundary(source);
  const canonical = validateAndCanonicalize(result);
  const normalizedSource: ProjectGradeSourceScanEvidenceSource = {
    ...source,
    scanId,
    projectId,
    ownerId,
    ...(teamId === undefined ? {} : { teamId }),
  };

  const drafts = buildDescriptors(result, canonical)
    .map((descriptor) => createDraft(normalizedSource, result, collectedAt, descriptor))
    .sort((left, right) => compareText(left.evidenceId, right.evidenceId));

  if (new Set(drafts.map((draft) => draft.evidenceId)).size !== drafts.length) {
    return projectionError(
      'PROJECT_GRADE_SOURCE_EVIDENCE_RESULT_INCONSISTENT',
      'Source evidence draft identities are not unique'
    );
  }

  const draftSetHash = `sha256:${sha256(stableStringify(drafts))}`;
  const team = teamId === undefined ? {} : { teamId };
  return {
    projectionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
    sourceScanId: scanId,
    projectId,
    ownerId,
    ...team,
    sourceScanVersion: result.scanVersion,
    snapshotHash: result.snapshotHash,
    draftSetHash,
    collectedAt,
    evidenceScope: 'authorized_local_source_snapshot',
    scoringDisposition: 'draft_only_not_adopted',
    productionAcceptance: false,
    externalScanningEnabled: false,
    drafts,
  };
}
