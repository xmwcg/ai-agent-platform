import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
  Drawer,
  Empty,
  Form,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Space,
  Spin,
  Statistic,
  Table,
  Tabs,
  Tag,
  Typography,
} from 'antd';
import {
  BarChartOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  FolderOpenOutlined,
  HistoryOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { extractApiError, projectGradeAPI } from '@/services/api';
import type { ImportedProjectDraft } from './ProjectGrade/project-import';
import { buildLoginPath } from '@/utils/safe-return-to';
import { buildProjectGradeUpgradeUrl } from './Pricing/payment-context';
import {
  buildProjectReportPdfFileName,
  formatReportDeliveryBytes,
  parseAttachmentFileName,
  saveBlobAsDownload,
} from './ProjectGrade/report-delivery';
import {
  isCurrentProjectRequest,
  isCurrentRequestSequence,
  isSourceEvidenceEvaluationDisabled,
} from './project-grade-request-guard';

const { Title, Paragraph, Text } = Typography;

type Severity = 'P0' | 'P1' | 'P2' | 'P3';
type EvidenceLevel =
  'production_automatic' | 'ci_integration' | 'source_static' | 'documentation' | 'none';
type ProjectType = 'website' | 'saas' | 'ai_application';
type ProjectStatus = 'active' | 'archived';
type ReportSource = 'baseline' | 'persisted';

interface RuleSnapshot {
  ruleKey: string;
  title: string;
  weight: number;
  completion: number;
  evidenceLevel: EvidenceLevel;
  evidenceFactor: number;
  awardedScore: number;
  notes: string;
  evidenceIds: string[];
}

interface DimensionSnapshot {
  dimensionKey: string;
  label: string;
  weight: number;
  rawScore: number;
  normalizedScore: number;
  rules: RuleSnapshot[];
}

interface ProjectGradeEvidence {
  id: string;
  level: EvidenceLevel;
  factor: number;
  title: string;
  description: string;
  source: string;
  verifiedAt?: string;
}

interface ProjectGradeFinding {
  id: string;
  severity: Severity;
  status: 'open' | 'accepted' | 'resolved' | 'false_positive';
  title: string;
  description: string;
  recommendation: string;
}

interface ReleaseGate {
  status: 'PASS' | 'CONDITIONAL' | 'BLOCKED';
  highestSeverity: Severity | 'NONE';
  scoreCap: number;
  blockedForRelease: boolean;
  blockedForPaidSale: boolean;
  reasons: string[];
}

interface ProjectGradeRun {
  runId: string;
  projectName: string;
  projectType: string;
  projectUrl?: string;
  rulePackKey: string;
  rulePackVersion: string;
  assessedAt: string;
  rawTotalScore: number;
  finalTotalScore: number;
  normalizedScore: number;
  grade: string;
  releaseGate: ReleaseGate;
  snapshots: DimensionSnapshot[];
  evidence: ProjectGradeEvidence[];
  findings: ProjectGradeFinding[];
  productionVerified: boolean;
  summary: string;
}

interface ProjectWorkspaceProject {
  projectId: string;
  name: string;
  description?: string;
  projectType: ProjectType;
  projectUrl?: string;
  status: ProjectStatus;
  latestRunId?: string;
  latestScore?: number;
  latestGrade?: string;
  latestAssessedAt?: string;
  updatedAt?: string;
}

interface AssessmentScope {
  mode: string;
  target: string;
  productionAcceptance: boolean;
  note: string;
}

interface BaselineResponse {
  success: boolean;
  data: {
    run: ProjectGradeRun;
    assessmentScope: AssessmentScope;
  };
}

interface ProjectsResponse {
  success: boolean;
  data: {
    projects: ProjectWorkspaceProject[];
  };
}

type ProjectGradeQuotaResource =
  | 'project_grade_url_scan'
  | 'project_grade_source_scan'
  | 'project_grade_evaluation'
  | 'project_grade_report_publish'
  | 'project_grade_report_download';

interface ProjectGradeQuotaEntitlement {
  resource: ProjectGradeQuotaResource;
  label: string;
  used: number;
  limit: number;
  remaining: number;
}

interface ProjectGradeEntitlements {
  plan: { id: 'free' | 'pro' | 'max' | 'team'; name: string; expired: boolean; upgradeUrl: string };
  projects: { used: number; limit: number; remaining: number };
  daily: Record<ProjectGradeQuotaResource, ProjectGradeQuotaEntitlement>;
  capabilities: {
    reportPublishEnabled: boolean;
    reportDownloadEnabled: boolean;
    reportValidityDays: number;
    removeAibakBranding: boolean;
  };
  accounting: { timezone: 'UTC'; resetsAt: string };
}

interface ProjectGradeEntitlementsResponse {
  success: boolean;
  data: { entitlements: ProjectGradeEntitlements };
}

interface CreateProjectResponse {
  success: boolean;
  data: {
    project: ProjectWorkspaceProject;
  };
}

interface ProjectRunsResponse {
  success: boolean;
  data: {
    runs: ProjectGradeRun[];
  };
}

interface ProjectGradePublishedReport {
  reportId: string;
  publicId: string;
  runId: string;
  projectId: string;
  title: string;
  projectName: string;
  projectKind: ProjectType;
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: Severity | null;
  isPublic: boolean;
  publishedAt: string;
  publishedBy?: string;
  expiresAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
  sharedCount: number;
  contentFingerprint?: string;
}

interface ProjectReportsResponse {
  success: boolean;
  data: {
    reports: ProjectGradePublishedReport[];
    productionAcceptance: false;
  };
}

interface ProjectGradeReportDelivery {
  deliveryId: string;
  reportId: string;
  publicId: string;
  runId: string;
  projectId: string;
  requestedBy: string;
  format: 'pdf';
  planId: 'free' | 'pro' | 'max' | 'team';
  branding: 'aibak' | 'white_label';
  contentFingerprint: string;
  documentFingerprint: string;
  fileName: string;
  byteLength: number;
  reportPublishedAt: string;
  reportExpiresAt: string;
  deliveredAt: string;
}

interface ProjectReportDeliveriesResponse {
  success: boolean;
  data: {
    deliveries: ProjectGradeReportDelivery[];
    productionAcceptance: false;
  };
}

interface ProjectReportPdfResponse {
  data: Blob;
  headers: unknown;
}

interface RunResponse {
  success: boolean;
  data: {
    run: ProjectGradeRun;
  };
}

interface ProjectGradeUrlCheck {
  key: string;
  status: 'pass' | 'warning' | 'fail';
  title: string;
  detail: string;
}

interface ProjectGradeUrlQuickScanResult {
  scanVersion: string;
  requestedUrl: string;
  finalUrl: string;
  statusCode: number;
  contentType: string;
  responseBytes: number;
  durationMs: number;
  redirectChain: string[];
  checks: ProjectGradeUrlCheck[];
  metadata: {
    title?: string;
    description?: string;
    htmlLang?: string;
    canonical?: string;
    viewport?: string;
    h1Count: number;
  };
  staticSignals: {
    charset?: string;
    robots?: string;
    noindex: boolean;
    openGraphTitle?: string;
    openGraphDescription?: string;
    images: {
      total: number;
      missingAlt: number;
    };
    buttons: {
      total: number;
      missingAccessibleName: number;
    };
    formControls: {
      total: number;
      missingAccessibleName: number;
    };
  };
  securityHeaders: {
    present: string[];
    missing: string[];
  };
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  note: string;
}

interface ProjectGradeUrlScanScope {
  batch: 1;
  authenticatedOnly: boolean;
  registeredProjectUrlOnly: boolean;
  externalScanningEnabled: boolean;
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  note: string;
}

interface ProjectGradeUrlScanResponse {
  success: boolean;
  data: {
    scan: ProjectGradeUrlQuickScanResult;
    scope: ProjectGradeUrlScanScope;
    persisted: true;
  };
}

interface ProjectGradeUrlScanRun {
  scanId: string;
  projectId: string;
  createdBy: string;
  status: 'succeeded' | 'failed';
  requestedUrl: string;
  finalUrl?: string;
  scanVersion?: string;
  statusCode?: number;
  durationMs?: number;
  result?: ProjectGradeUrlQuickScanResult;
  errorCode?: string;
  errorSummary?: string;
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  createdAt: string;
}

interface ProjectGradeUrlScanHistoryScope {
  evidenceScope: 'single_server_http_observation';
  productionAcceptance: false;
  note: string;
}

interface ProjectGradeUrlScanHistoryResponse {
  success: boolean;
  data: {
    scans: ProjectGradeUrlScanRun[];
    scope: ProjectGradeUrlScanHistoryScope;
  };
}

interface ProjectGradeSourceFileEvidence {
  path: string;
  sizeBytes: number;
  sha256: string;
}

interface ProjectGradeSourceFinding {
  ruleKey: string;
  severity: 'info' | 'warning' | 'high';
  filePath: string;
  line: number;
  message: string;
  fingerprint: string;
}

interface ProjectGradeSourceRoute {
  framework: 'express';
  method: string;
  routePath: string;
  filePath: string;
  line: number;
}

interface ProjectGradeSourceScanResult {
  scanVersion: string;
  rootKey: string;
  snapshotHash: string;
  files: ProjectGradeSourceFileEvidence[];
  findings: ProjectGradeSourceFinding[];
  routes: ProjectGradeSourceRoute[];
  projectSignals: {
    hasTests: boolean;
    hasDocker: boolean;
    hasCi: boolean;
    hasLicense: boolean;
    hasPackageManifest: boolean;
  };
  summary: {
    filesScanned: number;
    totalBytes: number;
    findings: number;
    routes: number;
  };
  skipped: {
    ignoredDirectories: number;
    unsupportedExtensions: number;
    binaryFiles: number;
    symbolicLinks: number;
  };
  limits: {
    maxFiles: number;
    maxFileBytes: number;
    maxTotalBytes: number;
    timeoutMs: number;
  };
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
  executedSourceCode: false;
  installedDependencies: false;
  networkAccessed: false;
}

interface ProjectGradeSourceScanScope {
  batch: 2;
  authenticatedOnly: true;
  serverRegisteredRootOnly: true;
  acceptedPathInput: false;
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
  executedSourceCode: false;
  networkAccessed: false;
  note: string;
}

interface ProjectGradeSourceScanResponse {
  success: boolean;
  data: {
    scan: ProjectGradeSourceScanResult;
    scope: ProjectGradeSourceScanScope;
    persisted: true;
  };
}

interface ProjectGradeSourceScanRun {
  scanId: string;
  projectId: string;
  createdBy: string;
  status: 'succeeded' | 'failed';
  rootKey: string;
  scanVersion?: string;
  snapshotHash?: string;
  result?: ProjectGradeSourceScanResult;
  errorCode?: string;
  errorSummary?: string;
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  createdAt: string;
}

interface ProjectGradeSourceScanHistoryScope {
  evidenceScope: 'authorized_local_source_snapshot';
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
  note: string;
}

interface ProjectGradeSourceScanHistoryResponse {
  success: boolean;
  data: {
    scans: ProjectGradeSourceScanRun[];
    scope: ProjectGradeSourceScanHistoryScope;
  };
}

type ProjectGradeSourceEvidenceDraftKind =
  'snapshot_manifest' | 'project_signal' | 'route_inventory' | 'finding';

interface ProjectGradeSourceEvidenceDraftMetadata {
  projectionVersion: 1;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  sourceEvidenceKind: ProjectGradeSourceEvidenceDraftKind;
  sourceRuleKey?: string;
  sourceSignal?: string;
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

interface ProjectGradeSourceEvidenceDraft {
  evidenceId: string;
  projectId: string;
  rulePackKey: string;
  rulePackVersion: string;
  ruleKey: string;
  dimensionKey: string;
  level: 'source_static';
  factor: number;
  sourceType: 'source_file';
  source: string;
  collectedAt: string;
  title: string;
  description: string;
  kind: ProjectGradeSourceEvidenceDraftKind;
  metadata: ProjectGradeSourceEvidenceDraftMetadata;
  projectionVersion: 1;
  scoringDisposition: 'draft_only_not_adopted';
}

interface ProjectGradeSourceEvidenceDraftPreview {
  projectionVersion: 1;
  sourceScanId: string;
  projectId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  collectedAt: string;
  evidenceScope: 'authorized_local_source_snapshot';
  scoringDisposition: 'draft_only_not_adopted';
  productionAcceptance: false;
  externalScanningEnabled: false;
  sourceContentPersisted: false;
  drafts: ProjectGradeSourceEvidenceDraft[];
}

interface ProjectGradeSourceEvidenceAdoption {
  adoptionId: string;
  targetId: string;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  projectionVersion: 1;
  adoptionVersion: 1;
  draftCount: number;
  createdBy: string;
  createdAt: string;
  evidenceScope: 'authorized_local_source_snapshot';
  scoringDisposition: 'adopted_pending_evaluation';
  productionAcceptance: false;
  externalScanningEnabled: false;
}

interface ProjectGradeSourceEvidenceDraftResponse {
  success: boolean;
  data: {
    preview: ProjectGradeSourceEvidenceDraftPreview;
    scope: {
      scoringDisposition: 'draft_only_not_adopted';
      productionAcceptance: false;
      externalScanningEnabled: false;
      sourceContentPersisted: false;
      note: string;
    };
  };
}

interface ProjectGradeSourceEvidenceAdoptionListResponse {
  success: boolean;
  data: {
    adoptions: ProjectGradeSourceEvidenceAdoption[];
    scope: {
      persisted: true;
      scoringDisposition: 'adopted_pending_evaluation';
      evaluationRunCreated: false;
      productionAcceptance: false;
      externalScanningEnabled: false;
      note: string;
    };
  };
}

interface ProjectGradeSourceEvidenceAdoptionResponse {
  success: boolean;
  data: {
    adoption: ProjectGradeSourceEvidenceAdoption;
    scope: ProjectGradeSourceEvidenceAdoptionListResponse['data']['scope'];
  };
}

interface ProjectGradeSourceEvidenceEvaluationRun extends ProjectGradeRun {
  evaluationInputKind: 'source_evidence_adoption';
  adoptionId: string;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  sourceEvidenceProjectionVersion: number;
  sourceEvidenceAdoptionVersion: number;
  sourceEvidenceScoringPolicyVersion: number;
  projectionStatus: 'pending' | 'projecting' | 'ready' | 'failed';
  projectionError?: string;
}

interface ProjectGradeSourceEvidenceEvaluationResponse {
  success: boolean;
  data: {
    run: ProjectGradeSourceEvidenceEvaluationRun;
    scope: {
      persisted: true;
      evaluationInputKind: 'source_evidence_adoption';
      immutableAdoptionInput: true;
      productionVerified: false;
      productionAcceptance: false;
      externalScanningEnabled: false;
      note: string;
    };
  };
}

interface CreateProjectValues {
  projectName: string;
  projectType: ProjectType;
  projectUrl?: string;
  description?: string;
}

type FindingWorkflowStatus =
  'open' | 'in_progress' | 'ready_for_retest' | 'verified' | 'accepted_risk' | 'false_positive';
type RemediationStatus =
  'open' | 'in_progress' | 'blocked' | 'ready_for_retest' | 'verified' | 'cancelled';

interface PersistedEvidence extends ProjectGradeEvidence {
  evidenceId: string;
  runId: string;
  ruleKey: string;
  dimensionKey: string;
  sourceType: string;
  collectedAt: string;
}

interface PersistedFinding {
  findingId: string;
  runId: string;
  ruleKey: string;
  dimensionKey: string;
  severity: Severity;
  snapshotStatus: string;
  currentStatus: FindingWorkflowStatus;
  title: string;
  description: string;
  recommendation: string;
  evidenceIds: string[];
  detectedAt: string;
  resolutionNote?: string;
  workflowUpdatedAt?: string;
}

interface RemediationTask {
  taskId: string;
  findingId: string;
  sourceRunId: string;
  severity: Severity;
  title: string;
  description: string;
  recommendation: string;
  status: RemediationStatus;
  dueAt?: string;
  slaHours?: number;
  retestRunId?: string;
  completionNote?: string;
  verifiedAt?: string;
  updatedAt?: string;
}

interface ProjectGradeAuditLog {
  auditId: string;
  operationId: string;
  action:
    | 'finding_workflow_update'
    | 'remediation_create'
    | 'remediation_update'
    | 'projection_rebuild'
    | 'projection_recovery'
    | 'url_scan_execute'
    | 'source_scan_execute'
    | 'source_evidence_adopt'
    | 'source_evidence_evaluate'
    | 'report_publish'
    | 'report_revoke';
  outcome: 'attempted' | 'succeeded' | 'failed';
  targetType:
    | 'finding'
    | 'remediation'
    | 'evaluation_run'
    | 'url_scan'
    | 'source_scan'
    | 'evidence_adoption'
    | 'report';
  targetId: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  errorCode?: string;
  errorSummary?: string;
  createdAt: string;
}

interface WorkflowResponse<T> {
  success: boolean;
  data: T;
}

interface FindingWorkflowValues {
  status: FindingWorkflowStatus;
  note: string;
}

interface RemediationUpdateValues {
  status: RemediationStatus;
  completionNote?: string;
  retestRunId?: string;
}

const evidenceLabels: Record<EvidenceLevel, { text: string; color: string }> = {
  production_automatic: { text: '生产自动验证', color: 'success' },
  ci_integration: { text: 'CI / 集成测试', color: 'processing' },
  source_static: { text: '源码静态证据', color: 'blue' },
  documentation: { text: '文档声明', color: 'gold' },
  none: { text: '无证据', color: 'default' },
};

const projectTypeLabels: Record<ProjectType, string> = {
  website: '网站',
  saas: 'SaaS',
  ai_application: 'AI 应用',
};

const severityColors: Record<Severity, string> = {
  P0: 'magenta',
  P1: 'red',
  P2: 'orange',
  P3: 'gold',
};

const persistedAssessmentScope: AssessmentScope = {
  mode: 'persisted_internal_repository',
  target: 'AIbak 服务端内部仓库',
  productionAcceptance: false,
  note: '当前持久化评估对象仍为 AIbak 服务端内部仓库；尚未启用外部 URL、Git 仓库、CI 或生产链路扫描。',
};

function gateColor(status: ReleaseGate['status']): string {
  if (status === 'PASS') return 'success';
  if (status === 'CONDITIONAL') return 'warning';
  return 'error';
}

function formatDate(value?: string): string {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('zh-CN');
}

type ProjectGradeReportLifecycleStatus = 'public' | 'expired' | 'revoked';

function reportLifecycleStatus(
  report: ProjectGradePublishedReport
): ProjectGradeReportLifecycleStatus {
  if (!report.isPublic || report.revokedAt) return 'revoked';
  const expiresAt = new Date(report.expiresAt).getTime();
  return Number.isFinite(expiresAt) && expiresAt <= Date.now() ? 'expired' : 'public';
}

function summarizeSourceEvidenceDimensions(
  drafts: ProjectGradeSourceEvidenceDraft[]
): Array<[string, number]> {
  const counts = drafts.reduce<Record<string, number>>((current, draft) => {
    current[draft.dimensionKey] = (current[draft.dimensionKey] || 0) + 1;
    return current;
  }, {});
  return Object.entries(counts).sort(([left], [right]) => left.localeCompare(right));
}

function hasAuthenticatedSession(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem('token'));
}

function hasHttpStatus(error: unknown, status: number): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { response?: { status?: number } }).response?.status === status;
}

function readApiErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const directCode = (error as { code?: unknown }).code;
  const responseCode = (error as { response?: { data?: { code?: unknown } } }).response?.data?.code;
  return String(responseCode || directCode || '');
}

function readResponseHeader(headers: unknown, name: string): string | undefined {
  if (!headers || typeof headers !== 'object') return undefined;
  const get = (headers as { get?: (headerName: string) => unknown }).get;
  if (typeof get === 'function') {
    const value = get.call(headers, name);
    return typeof value === 'string' ? value : undefined;
  }
  const record = headers as Record<string, unknown>;
  const value = record[name] ?? record[name.toLowerCase()];
  return typeof value === 'string' ? value : undefined;
}

interface ProjectGradePageProps {
  initialProjectDraft?: ImportedProjectDraft;
  onImportedDraftConsumed?: () => void;
}

const ProjectGradePage: React.FC<ProjectGradePageProps> = ({
  initialProjectDraft,
  onImportedDraftConsumed,
}) => {
  const [run, setRun] = useState<ProjectGradeRun | null>(null);
  const [scope, setScope] = useState<AssessmentScope | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource>('baseline');
  const [baselineError, setBaselineError] = useState('');
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [entitlements, setEntitlements] = useState<ProjectGradeEntitlements | null>(null);
  const [entitlementsLoading, setEntitlementsLoading] = useState(false);
  const [entitlementsError, setEntitlementsError] = useState('');
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectCreating, setProjectCreating] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [runLoading, setRunLoading] = useState(false);
  const [urlScanLoading, setUrlScanLoading] = useState(false);
  const [urlScanResult, setUrlScanResult] = useState<ProjectGradeUrlQuickScanResult | null>(null);
  const [urlScanScope, setUrlScanScope] = useState<ProjectGradeUrlScanScope | null>(null);
  const [urlScanError, setUrlScanError] = useState('');
  const urlScanRequestSequenceRef = useRef(0);
  const [urlScanHistory, setUrlScanHistory] = useState<ProjectGradeUrlScanRun[]>([]);
  const [urlScanHistoryScope, setUrlScanHistoryScope] =
    useState<ProjectGradeUrlScanHistoryScope | null>(null);
  const [urlScanHistoryLoading, setUrlScanHistoryLoading] = useState(false);
  const [urlScanHistoryError, setUrlScanHistoryError] = useState('');
  const [selectedUrlScanSnapshot, setSelectedUrlScanSnapshot] =
    useState<ProjectGradeUrlScanRun | null>(null);
  const urlScanHistoryRequestSequenceRef = useRef(0);
  const [sourceScanLoading, setSourceScanLoading] = useState(false);
  const [sourceScanResult, setSourceScanResult] = useState<ProjectGradeSourceScanResult | null>(
    null
  );
  const [sourceScanScope, setSourceScanScope] = useState<ProjectGradeSourceScanScope | null>(null);
  const [sourceScanError, setSourceScanError] = useState('');
  const sourceScanRequestSequenceRef = useRef(0);
  const [sourceScanHistory, setSourceScanHistory] = useState<ProjectGradeSourceScanRun[]>([]);
  const [sourceScanHistoryScope, setSourceScanHistoryScope] =
    useState<ProjectGradeSourceScanHistoryScope | null>(null);
  const [sourceScanHistoryLoading, setSourceScanHistoryLoading] = useState(false);
  const [sourceScanHistoryError, setSourceScanHistoryError] = useState('');
  const [selectedSourceScanSnapshot, setSelectedSourceScanSnapshot] =
    useState<ProjectGradeSourceScanRun | null>(null);
  const sourceScanHistoryRequestSequenceRef = useRef(0);
  const [sourceEvidenceDraft, setSourceEvidenceDraft] =
    useState<ProjectGradeSourceEvidenceDraftPreview | null>(null);
  const [sourceEvidenceDraftScopeNote, setSourceEvidenceDraftScopeNote] = useState('');
  const [sourceEvidenceDraftLoading, setSourceEvidenceDraftLoading] = useState(false);
  const [sourceEvidenceDraftLoadingSourceScanId, setSourceEvidenceDraftLoadingSourceScanId] =
    useState<string | null>(null);
  const [sourceEvidenceDraftError, setSourceEvidenceDraftError] = useState('');
  const sourceEvidenceDraftRequestSequenceRef = useRef(0);
  const [sourceEvidenceAdoptions, setSourceEvidenceAdoptions] = useState<
    ProjectGradeSourceEvidenceAdoption[]
  >([]);
  const [sourceEvidenceAdoptionsScopeNote, setSourceEvidenceAdoptionsScopeNote] = useState('');
  const [sourceEvidenceAdoptionsLoading, setSourceEvidenceAdoptionsLoading] = useState(false);
  const [sourceEvidenceAdoptionsError, setSourceEvidenceAdoptionsError] = useState('');
  const [sourceEvidenceAdoptionsAccessDenied, setSourceEvidenceAdoptionsAccessDenied] =
    useState(false);
  const sourceEvidenceAdoptionRequestSequenceRef = useRef(0);
  const sourceEvidenceOperationRequestSequenceRef = useRef(0);
  const [sourceEvidenceAdopting, setSourceEvidenceAdopting] = useState(false);
  const [sourceEvidenceEvaluatingAdoptionId, setSourceEvidenceEvaluatingAdoptionId] = useState<
    string | null
  >(null);
  const [sourceEvidenceOperationError, setSourceEvidenceOperationError] = useState('');
  const [sourceEvidenceOperationNotice, setSourceEvidenceOperationNotice] = useState('');
  const [sourceEvidenceLastEvaluation, setSourceEvidenceLastEvaluation] =
    useState<ProjectGradeSourceEvidenceEvaluationRun | null>(null);
  const [projects, setProjects] = useState<ProjectWorkspaceProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWorkspaceProject | null>(null);
  const selectedProjectIdRef = useRef<string | null>(null);
  const projectsRequestSequenceRef = useRef(0);
  const projectCreateRequestSequenceRef = useRef(0);
  const projectRunsRequestSequenceRef = useRef(0);
  const projectWorkflowRequestSequenceRef = useRef(0);
  const projectReportsRequestSequenceRef = useRef(0);
  const reportDeliveryRequestSequenceRef = useRef(0);
  const reportDownloadRequestSequenceRef = useRef(0);
  const reportOperationRequestSequenceRef = useRef(0);
  const reportRequestSequenceRef = useRef(0);
  const reportProjectIdRef = useRef<string | null>(null);
  const projectionRebuildRequestSequenceRef = useRef(0);
  const workflowMutationRequestSequenceRef = useRef(0);
  const [projectRuns, setProjectRuns] = useState<ProjectGradeRun[]>([]);
  const [projectReports, setProjectReports] = useState<ProjectGradePublishedReport[]>([]);
  const [projectReportsLoading, setProjectReportsLoading] = useState(false);
  const [projectReportsError, setProjectReportsError] = useState('');
  const [reportDeliveryTarget, setReportDeliveryTarget] =
    useState<ProjectGradePublishedReport | null>(null);
  const [reportDeliveries, setReportDeliveries] = useState<ProjectGradeReportDelivery[]>([]);
  const [reportDeliveriesLoading, setReportDeliveriesLoading] = useState(false);
  const [reportDeliveriesError, setReportDeliveriesError] = useState('');
  const [reportDownloadLoading, setReportDownloadLoading] = useState<string | null>(null);
  const [reportOperationLoading, setReportOperationLoading] = useState<string | null>(null);
  const [reportRevocationTarget, setReportRevocationTarget] =
    useState<ProjectGradePublishedReport | null>(null);
  const [reportRevocationReason, setReportRevocationReason] = useState('');
  const [persistedEvidence, setPersistedEvidence] = useState<PersistedEvidence[]>([]);
  const [persistedFindings, setPersistedFindings] = useState<PersistedFinding[]>([]);
  const [remediationTasks, setRemediationTasks] = useState<RemediationTask[]>([]);
  const [auditLogs, setAuditLogs] = useState<ProjectGradeAuditLog[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditLoadedProjectId, setAuditLoadedProjectId] = useState<string | null>(null);
  const [auditAccessDenied, setAuditAccessDenied] = useState(false);
  const [auditError, setAuditError] = useState('');
  const auditRequestSequenceRef = useRef(0);
  const [projectionRebuildLoading, setProjectionRebuildLoading] = useState<string | null>(null);
  const [workflowLoading, setWorkflowLoading] = useState(false);
  const [findingWorkflowTarget, setFindingWorkflowTarget] = useState<PersistedFinding | null>(null);
  const [remediationTarget, setRemediationTarget] = useState<RemediationTask | null>(null);
  const [findingWorkflowForm] = Form.useForm<FindingWorkflowValues>();
  const [remediationForm] = Form.useForm<RemediationUpdateValues>();
  const [form] = Form.useForm<CreateProjectValues>();
  const importedDraftAppliedRef = useRef('');
  const authenticated = hasAuthenticatedSession();
  const loginReturnTo =
    typeof window === 'undefined'
      ? '/project-grade/projects'
      : `${window.location.pathname}${window.location.search}`;
  const loginHref = buildLoginPath(loginReturnTo);

  useEffect(() => {
    if (!authenticated || !initialProjectDraft) return;
    const draftKey = `${initialProjectDraft.projectType}:${initialProjectDraft.projectUrl}`;
    if (importedDraftAppliedRef.current === draftKey) return;
    form.setFieldsValue(initialProjectDraft);
    importedDraftAppliedRef.current = draftKey;
  }, [authenticated, form, initialProjectDraft]);

  const clearUrlScanState = useCallback(() => {
    urlScanRequestSequenceRef.current += 1;
    urlScanHistoryRequestSequenceRef.current += 1;
    setUrlScanLoading(false);
    setUrlScanResult(null);
    setUrlScanScope(null);
    setUrlScanError('');
    setUrlScanHistory([]);
    setUrlScanHistoryScope(null);
    setUrlScanHistoryLoading(false);
    setUrlScanHistoryError('');
    setSelectedUrlScanSnapshot(null);
  }, []);

  const clearSourceScanState = useCallback(() => {
    sourceScanRequestSequenceRef.current += 1;
    sourceScanHistoryRequestSequenceRef.current += 1;
    setSourceScanLoading(false);
    setSourceScanResult(null);
    setSourceScanScope(null);
    setSourceScanError('');
    setSourceScanHistory([]);
    setSourceScanHistoryScope(null);
    setSourceScanHistoryLoading(false);
    setSourceScanHistoryError('');
    setSelectedSourceScanSnapshot(null);
  }, []);

  const clearSourceEvidenceState = useCallback(() => {
    sourceEvidenceDraftRequestSequenceRef.current += 1;
    sourceEvidenceAdoptionRequestSequenceRef.current += 1;
    sourceEvidenceOperationRequestSequenceRef.current += 1;
    setSourceEvidenceDraft(null);
    setSourceEvidenceDraftScopeNote('');
    setSourceEvidenceDraftLoading(false);
    setSourceEvidenceDraftLoadingSourceScanId(null);
    setSourceEvidenceDraftError('');
    setSourceEvidenceAdoptions([]);
    setSourceEvidenceAdoptionsScopeNote('');
    setSourceEvidenceAdoptionsLoading(false);
    setSourceEvidenceAdoptionsError('');
    setSourceEvidenceAdoptionsAccessDenied(false);
    setSourceEvidenceAdopting(false);
    setSourceEvidenceEvaluatingAdoptionId(null);
    setSourceEvidenceOperationError('');
    setSourceEvidenceOperationNotice('');
    setSourceEvidenceLastEvaluation(null);
  }, []);

  const clearProjectWorkspaceState = useCallback((nextProjectId: string | null) => {
    projectRunsRequestSequenceRef.current += 1;
    projectWorkflowRequestSequenceRef.current += 1;
    projectReportsRequestSequenceRef.current += 1;
    reportDeliveryRequestSequenceRef.current += 1;
    reportDownloadRequestSequenceRef.current += 1;
    reportOperationRequestSequenceRef.current += 1;
    reportRequestSequenceRef.current += 1;
    projectionRebuildRequestSequenceRef.current += 1;
    workflowMutationRequestSequenceRef.current += 1;
    auditRequestSequenceRef.current += 1;
    setHistoryLoading(false);
    setRunLoading(false);
    setWorkflowLoading(false);
    setProjectReportsLoading(false);
    setReportOperationLoading(null);
    setProjectionRebuildLoading(null);
    setProjectRuns([]);
    setProjectReports([]);
    setProjectReportsError('');
    setReportDeliveryTarget(null);
    setReportDeliveries([]);
    setReportDeliveriesLoading(false);
    setReportDeliveriesError('');
    setReportDownloadLoading(null);
    setReportRevocationTarget(null);
    setReportRevocationReason('');
    setPersistedEvidence([]);
    setPersistedFindings([]);
    setRemediationTasks([]);
    setAuditLogs([]);
    setAuditLoadedProjectId(null);
    setAuditLoading(false);
    setAuditAccessDenied(false);
    setAuditError('');
    setFindingWorkflowTarget(null);
    setRemediationTarget(null);

    if (reportProjectIdRef.current && reportProjectIdRef.current !== nextProjectId) {
      reportProjectIdRef.current = null;
      setRun(null);
      setScope(null);
      setReportSource('baseline');
    }
  }, []);

  const loadBaseline = useCallback(async () => {
    const requestSequence = reportRequestSequenceRef.current + 1;
    reportRequestSequenceRef.current = requestSequence;
    setBaselineLoading(true);
    setBaselineError('');
    try {
      const response = (await projectGradeAPI.getBaseline()) as unknown as BaselineResponse;
      if (reportRequestSequenceRef.current !== requestSequence) return;
      reportProjectIdRef.current = null;
      setRun(response.data.run);
      setScope(response.data.assessmentScope);
      setReportSource('baseline');
    } catch (requestError) {
      if (reportRequestSequenceRef.current !== requestSequence) return;
      setBaselineError(extractApiError(requestError, '无法加载 ProjectGrade 内部基线结果'));
    } finally {
      if (reportRequestSequenceRef.current === requestSequence) {
        setBaselineLoading(false);
      }
    }
  }, []);

  const loadEntitlements = useCallback(async () => {
    setEntitlementsLoading(true);
    setEntitlementsError('');
    try {
      const response =
        (await projectGradeAPI.getEntitlements()) as unknown as ProjectGradeEntitlementsResponse;
      setEntitlements(response.data.entitlements);
    } catch (requestError) {
      setEntitlementsError(extractApiError(requestError, '无法加载智评通套餐与额度'));
    } finally {
      setEntitlementsLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    const requestSequence = projectsRequestSequenceRef.current + 1;
    projectsRequestSequenceRef.current = requestSequence;
    setProjectsLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.listProjects()) as unknown as ProjectsResponse;
      if (!isCurrentRequestSequence(projectsRequestSequenceRef.current, requestSequence)) {
        return;
      }

      const nextProjects = response.data.projects;
      const activeProjectId = selectedProjectIdRef.current;
      setProjects(nextProjects);
      if (!activeProjectId) {
        setSelectedProject(null);
        return;
      }

      const nextProject =
        nextProjects.find((project) => project.projectId === activeProjectId) || null;
      if (nextProject) {
        setSelectedProject(nextProject);
        return;
      }

      selectedProjectIdRef.current = null;
      clearUrlScanState();
      clearSourceScanState();
      clearSourceEvidenceState();
      clearProjectWorkspaceState(null);
      setSelectedProject(null);
      setWorkspaceError('当前选择的项目已不可访问或已删除，请重新选择项目。');
    } catch (requestError) {
      if (!isCurrentRequestSequence(projectsRequestSequenceRef.current, requestSequence)) {
        return;
      }
      setWorkspaceError(extractApiError(requestError, '无法加载我的 ProjectGrade 项目'));
    } finally {
      if (isCurrentRequestSequence(projectsRequestSequenceRef.current, requestSequence)) {
        setProjectsLoading(false);
      }
    }
  }, [
    clearProjectWorkspaceState,
    clearSourceEvidenceState,
    clearSourceScanState,
    clearUrlScanState,
  ]);

  const loadProjectRuns = useCallback(async (projectId: string) => {
    const requestSequence = projectRunsRequestSequenceRef.current + 1;
    projectRunsRequestSequenceRef.current = requestSequence;
    setHistoryLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.listProjectRuns(
        projectId
      )) as unknown as ProjectRunsResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectRunsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setProjectRuns(response.data.runs);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectRunsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setProjectRuns([]);
      setWorkspaceError(extractApiError(requestError, '无法加载该项目的评估历史'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectRunsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setHistoryLoading(false);
      }
    }
  }, []);

  const loadProjectReports = useCallback(async (projectId: string) => {
    const requestSequence = projectReportsRequestSequenceRef.current + 1;
    projectReportsRequestSequenceRef.current = requestSequence;
    setProjectReportsLoading(true);
    setProjectReportsError('');
    try {
      const response = (await projectGradeAPI.listProjectReports(
        projectId
      )) as unknown as ProjectReportsResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectReportsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setProjectReports(response.data.reports);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectReportsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setProjectReports([]);
      setProjectReportsError(extractApiError(requestError, '无法加载项目正式报告'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectReportsRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setProjectReportsLoading(false);
      }
    }
  }, []);

  const loadProjectReportDeliveries = useCallback(
    async (projectId: string, report: ProjectGradePublishedReport) => {
      const requestSequence = reportDeliveryRequestSequenceRef.current + 1;
      reportDeliveryRequestSequenceRef.current = requestSequence;
      setReportDeliveryTarget(report);
      setReportDeliveriesLoading(true);
      setReportDeliveriesError('');
      try {
        const response = (await projectGradeAPI.listProjectReportDeliveries(
          projectId,
          report.publicId
        )) as unknown as ProjectReportDeliveriesResponse;
        if (
          !isCurrentProjectRequest({
            activeProjectId: selectedProjectIdRef.current,
            requestProjectId: projectId,
            activeSequence: reportDeliveryRequestSequenceRef.current,
            requestSequence,
          })
        ) {
          return;
        }
        setReportDeliveries(response.data.deliveries);
      } catch (requestError) {
        if (
          !isCurrentProjectRequest({
            activeProjectId: selectedProjectIdRef.current,
            requestProjectId: projectId,
            activeSequence: reportDeliveryRequestSequenceRef.current,
            requestSequence,
          })
        ) {
          return;
        }
        setReportDeliveries([]);
        setReportDeliveriesError(
          hasHttpStatus(requestError, 403)
            ? '交付记录仅项目管理员可查看。'
            : extractApiError(requestError, '无法加载 PDF 交付记录')
        );
      } finally {
        if (
          isCurrentProjectRequest({
            activeProjectId: selectedProjectIdRef.current,
            requestProjectId: projectId,
            activeSequence: reportDeliveryRequestSequenceRef.current,
            requestSequence,
          })
        ) {
          setReportDeliveriesLoading(false);
        }
      }
    },
    []
  );

  const loadProjectUrlScanHistory = useCallback(async (projectId: string) => {
    const requestSequence = urlScanHistoryRequestSequenceRef.current + 1;
    urlScanHistoryRequestSequenceRef.current = requestSequence;
    setUrlScanHistoryLoading(true);
    setUrlScanHistoryError('');
    try {
      const response = (await projectGradeAPI.listProjectUrlScans(
        projectId,
        20
      )) as unknown as ProjectGradeUrlScanHistoryResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setUrlScanHistory(response.data.scans);
      setUrlScanHistoryScope(response.data.scope);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setUrlScanHistory([]);
      setUrlScanHistoryScope(null);
      setUrlScanHistoryError(extractApiError(requestError, '无法加载网址快速体检历史'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setUrlScanHistoryLoading(false);
      }
    }
  }, []);

  const loadProjectSourceScanHistory = useCallback(async (projectId: string) => {
    const requestSequence = sourceScanHistoryRequestSequenceRef.current + 1;
    sourceScanHistoryRequestSequenceRef.current = requestSequence;
    setSourceScanHistoryLoading(true);
    setSourceScanHistoryError('');
    try {
      const response = (await projectGradeAPI.listProjectSourceScans(
        projectId,
        20
      )) as unknown as ProjectGradeSourceScanHistoryResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setSourceScanHistory(response.data.scans);
      setSourceScanHistoryScope(response.data.scope);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setSourceScanHistory([]);
      setSourceScanHistoryScope(null);
      setSourceScanHistoryError(extractApiError(requestError, '无法加载授权源码扫描历史'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanHistoryRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setSourceScanHistoryLoading(false);
      }
    }
  }, []);

  const loadProjectSourceEvidenceAdoptions = useCallback(async (projectId: string) => {
    const requestSequence = sourceEvidenceAdoptionRequestSequenceRef.current + 1;
    sourceEvidenceAdoptionRequestSequenceRef.current = requestSequence;
    setSourceEvidenceAdoptions([]);
    setSourceEvidenceAdoptionsScopeNote('');
    setSourceEvidenceAdoptionsLoading(true);
    setSourceEvidenceAdoptionsError('');
    setSourceEvidenceAdoptionsAccessDenied(false);
    try {
      const response = (await projectGradeAPI.listProjectSourceEvidenceAdoptions(
        projectId,
        20
      )) as unknown as ProjectGradeSourceEvidenceAdoptionListResponse;
      if (
        sourceEvidenceAdoptionRequestSequenceRef.current !== requestSequence ||
        selectedProjectIdRef.current !== projectId
      ) {
        return;
      }
      setSourceEvidenceAdoptions(response.data.adoptions);
      setSourceEvidenceAdoptionsScopeNote(response.data.scope.note);
    } catch (requestError) {
      if (
        sourceEvidenceAdoptionRequestSequenceRef.current !== requestSequence ||
        selectedProjectIdRef.current !== projectId
      ) {
        return;
      }
      setSourceEvidenceAdoptions([]);
      setSourceEvidenceAdoptionsScopeNote('');
      if (hasHttpStatus(requestError, 403)) {
        setSourceEvidenceAdoptionsAccessDenied(true);
      } else {
        setSourceEvidenceAdoptionsError(extractApiError(requestError, '无法加载源码证据采纳清单'));
      }
    } finally {
      if (
        sourceEvidenceAdoptionRequestSequenceRef.current === requestSequence &&
        selectedProjectIdRef.current === projectId
      ) {
        setSourceEvidenceAdoptionsLoading(false);
      }
    }
  }, []);

  const loadProjectSourceEvidenceDraft = useCallback(
    async (projectId: string, sourceScanId: string) => {
      const requestSequence = sourceEvidenceDraftRequestSequenceRef.current + 1;
      sourceEvidenceDraftRequestSequenceRef.current = requestSequence;
      setSourceEvidenceDraft(null);
      setSourceEvidenceDraftScopeNote('');
      setSourceEvidenceDraftLoading(true);
      setSourceEvidenceDraftLoadingSourceScanId(sourceScanId);
      setSourceEvidenceDraftError('');
      setSourceEvidenceOperationError('');
      setSourceEvidenceOperationNotice('');
      try {
        const response = (await projectGradeAPI.getProjectSourceEvidenceDraft(
          projectId,
          sourceScanId
        )) as unknown as ProjectGradeSourceEvidenceDraftResponse;
        if (
          sourceEvidenceDraftRequestSequenceRef.current !== requestSequence ||
          selectedProjectIdRef.current !== projectId ||
          response.data.preview.projectId !== projectId ||
          response.data.preview.sourceScanId !== sourceScanId
        ) {
          return;
        }
        setSourceEvidenceDraft(response.data.preview);
        setSourceEvidenceDraftScopeNote(response.data.scope.note);
      } catch (requestError) {
        if (
          sourceEvidenceDraftRequestSequenceRef.current !== requestSequence ||
          selectedProjectIdRef.current !== projectId
        ) {
          return;
        }
        setSourceEvidenceDraft(null);
        setSourceEvidenceDraftScopeNote('');
        const code = readApiErrorCode(requestError);
        const mappedMessage: Record<string, string> = {
          PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账号没有管理员权限，不能读取源码证据草稿。',
          PROJECT_GRADE_SOURCE_SCAN_NOT_FOUND: '所选成功扫描已不存在或不可用于证据草稿投影。',
          PROJECT_GRADE_SOURCE_TARGET_MISSING: '当前项目没有活动的服务端授权源码目标。',
          PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED:
            '所选扫描不再满足安全投影契约，服务端已拒绝生成草稿。',
        };
        setSourceEvidenceDraftError(
          mappedMessage[code] || extractApiError(requestError, '无法生成源码证据草稿预览')
        );
      } finally {
        if (
          sourceEvidenceDraftRequestSequenceRef.current === requestSequence &&
          selectedProjectIdRef.current === projectId
        ) {
          setSourceEvidenceDraftLoading(false);
          setSourceEvidenceDraftLoadingSourceScanId(null);
        }
      }
    },
    []
  );

  const loadProjectWorkflow = useCallback(async (projectId: string) => {
    const requestSequence = projectWorkflowRequestSequenceRef.current + 1;
    projectWorkflowRequestSequenceRef.current = requestSequence;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      const [evidenceResponse, findingsResponse, remediationsResponse] = (await Promise.all([
        projectGradeAPI.listProjectEvidence(projectId),
        projectGradeAPI.listProjectFindings(projectId),
        projectGradeAPI.listProjectRemediations(projectId),
      ])) as unknown as [
        WorkflowResponse<{ evidence: PersistedEvidence[] }>,
        WorkflowResponse<{ findings: PersistedFinding[] }>,
        WorkflowResponse<{ remediations: RemediationTask[] }>,
      ];
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectWorkflowRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setPersistedEvidence(evidenceResponse.data.evidence);
      setPersistedFindings(findingsResponse.data.findings);
      setRemediationTasks(remediationsResponse.data.remediations);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectWorkflowRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setPersistedEvidence([]);
      setPersistedFindings([]);
      setRemediationTasks([]);
      setWorkspaceError(extractApiError(requestError, '无法加载项目证据、Finding 与整改任务'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectWorkflowRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setWorkflowLoading(false);
      }
    }
  }, []);

  const loadProjectAudit = useCallback(async (projectId: string) => {
    const requestSequence = auditRequestSequenceRef.current + 1;
    auditRequestSequenceRef.current = requestSequence;
    setAuditLoading(true);
    setAuditError('');
    setAuditAccessDenied(false);
    try {
      const response = (await projectGradeAPI.listProjectAudit(
        projectId
      )) as unknown as WorkflowResponse<{ audit: ProjectGradeAuditLog[] }>;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: auditRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setAuditLogs(response.data.audit);
      setAuditLoadedProjectId(projectId);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: auditRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setAuditLogs([]);
      setAuditLoadedProjectId(null);
      if (hasHttpStatus(requestError, 403)) {
        setAuditAccessDenied(true);
      } else {
        setAuditError(extractApiError(requestError, '无法加载项目审计记录'));
      }
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: auditRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setAuditLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!authenticated) {
      projectsRequestSequenceRef.current += 1;
      projectCreateRequestSequenceRef.current += 1;
      selectedProjectIdRef.current = null;
      setProjectsLoading(false);
      setProjectCreating(false);
      setEntitlements(null);
      setEntitlementsLoading(false);
      setEntitlementsError('');
      clearUrlScanState();
      clearSourceScanState();
      clearSourceEvidenceState();
      clearProjectWorkspaceState(null);
      setSelectedProject(null);
      setProjects([]);
    }

    void loadBaseline();
    if (authenticated) {
      void Promise.all([loadProjects(), loadEntitlements()]);
    }
  }, [
    authenticated,
    clearProjectWorkspaceState,
    clearSourceEvidenceState,
    clearSourceScanState,
    clearUrlScanState,
    loadBaseline,
    loadEntitlements,
    loadProjects,
  ]);

  const selectProject = useCallback(
    (project: ProjectWorkspaceProject) => {
      clearUrlScanState();
      clearSourceScanState();
      clearSourceEvidenceState();
      clearProjectWorkspaceState(project.projectId);
      selectedProjectIdRef.current = project.projectId;
      setSelectedProject(project);
      void Promise.all([
        loadProjectRuns(project.projectId),
        loadProjectReports(project.projectId),
        loadProjectWorkflow(project.projectId),
        loadProjectUrlScanHistory(project.projectId),
        loadProjectSourceScanHistory(project.projectId),
        loadProjectSourceEvidenceAdoptions(project.projectId),
      ]);
    },
    [
      clearProjectWorkspaceState,
      clearSourceEvidenceState,
      clearSourceScanState,
      clearUrlScanState,
      loadProjectReports,
      loadProjectRuns,
      loadProjectSourceEvidenceAdoptions,
      loadProjectSourceScanHistory,
      loadProjectUrlScanHistory,
      loadProjectWorkflow,
    ]
  );

  const runUrlQuickScanForProject = async (project: ProjectWorkspaceProject) => {
    if (!project.projectUrl) {
      setUrlScanError('请先创建或选择已登记 HTTP(S) 地址的项目');
      return;
    }

    const projectId = project.projectId;
    const requestSequence = urlScanRequestSequenceRef.current + 1;
    urlScanRequestSequenceRef.current = requestSequence;
    setUrlScanLoading(true);
    setUrlScanError('');
    setUrlScanResult(null);
    setUrlScanScope(null);
    try {
      const response = (await projectGradeAPI.runProjectUrlQuickScan(
        projectId
      )) as unknown as ProjectGradeUrlScanResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setUrlScanResult(response.data.scan);
      setUrlScanScope(response.data.scope);
      await loadProjectUrlScanHistory(projectId);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      setUrlScanError(
        code === 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED'
          ? '项目已保存，但网址快速体检的服务端 Feature Flag 当前关闭；这是默认安全状态。'
          : extractApiError(requestError, '项目已保存，但服务端重新体检未完成')
      );
      await loadProjectUrlScanHistory(projectId);
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: urlScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setUrlScanLoading(false);
        void loadEntitlements();
      }
    }
  };

  const createProject = async (values: CreateProjectValues) => {
    const requestSequence = projectCreateRequestSequenceRef.current + 1;
    projectCreateRequestSequenceRef.current = requestSequence;
    setProjectCreating(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.createProject({
        projectName: values.projectName.trim(),
        projectType: values.projectType,
        projectUrl: values.projectUrl?.trim() || undefined,
        description: values.description?.trim() || undefined,
      })) as unknown as CreateProjectResponse;
      if (
        !isCurrentRequestSequence(projectCreateRequestSequenceRef.current, requestSequence) ||
        !hasAuthenticatedSession()
      ) {
        return;
      }

      const project = response.data.project;
      projectsRequestSequenceRef.current += 1;
      setProjectsLoading(false);
      clearUrlScanState();
      clearSourceScanState();
      clearSourceEvidenceState();
      clearProjectWorkspaceState(project.projectId);
      selectedProjectIdRef.current = project.projectId;
      setProjects((current) => [
        project,
        ...current.filter((item) => item.projectId !== project.projectId),
      ]);
      setSelectedProject(project);
      form.resetFields();

      if (initialProjectDraft) {
        onImportedDraftConsumed?.();
        if (project.projectUrl) {
          await runUrlQuickScanForProject(project);
        }
      }
    } catch (requestError) {
      if (!isCurrentRequestSequence(projectCreateRequestSequenceRef.current, requestSequence)) {
        return;
      }
      setWorkspaceError(extractApiError(requestError, '无法创建 ProjectGrade 项目'));
    } finally {
      if (isCurrentRequestSequence(projectCreateRequestSequenceRef.current, requestSequence)) {
        setProjectCreating(false);
        void loadEntitlements();
      }
    }
  };

  const runPersistedEvaluation = async () => {
    if (!selectedProject) return;

    const projectId = selectedProject.projectId;
    const requestSequence = reportRequestSequenceRef.current + 1;
    reportRequestSequenceRef.current = requestSequence;
    setRunLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.runProjectEvaluation(
        projectId
      )) as unknown as RunResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      reportProjectIdRef.current = projectId;
      setRun(response.data.run);
      setScope(persistedAssessmentScope);
      setReportSource('persisted');
      await Promise.all([
        loadProjects(),
        loadEntitlements(),
        loadProjectRuns(projectId),
        loadProjectWorkflow(projectId),
      ]);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setWorkspaceError(extractApiError(requestError, '无法创建该项目的持久化评估记录'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setRunLoading(false);
      }
    }
  };

  const runUrlQuickScan = async () => {
    if (!selectedProject) return;
    await runUrlQuickScanForProject(selectedProject);
  };

  const runSourceScan = async () => {
    if (!selectedProject) return;

    const projectId = selectedProject.projectId;
    clearSourceEvidenceState();
    const requestSequence = sourceScanRequestSequenceRef.current + 1;
    sourceScanRequestSequenceRef.current = requestSequence;
    setSourceScanLoading(true);
    setSourceScanError('');
    setSourceScanResult(null);
    setSourceScanScope(null);
    try {
      const response = (await projectGradeAPI.runProjectSourceScan(
        projectId
      )) as unknown as ProjectGradeSourceScanResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setSourceScanResult(response.data.scan);
      setSourceScanScope(response.data.scope);
      await Promise.all([
        loadProjectSourceScanHistory(projectId),
        loadProjectSourceEvidenceAdoptions(projectId),
        loadEntitlements(),
      ]);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      const mappedMessage: Record<string, string> = {
        PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账号不是项目 owner 或团队管理员，不能执行源码扫描。',
        PROJECT_GRADE_SOURCE_TARGET_MISSING: '当前项目没有可用的服务端登记源码目标。',
        PROJECT_GRADE_SOURCE_TARGET_FORBIDDEN: '当前源码目标不在服务端授权范围内。',
        PROJECT_GRADE_PROJECT_ARCHIVED: '已归档项目不能执行源码扫描。',
        PROJECT_GRADE_AUDIT_UNAVAILABLE: '审计服务不可用，已安全阻止源码扫描。',
        PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE: '扫描历史不可用，结果未被作为成功记录返回。',
        PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT: '扫描结果未通过路径安全校验，已拒绝保存。',
      };
      setSourceScanError(
        mappedMessage[code] || extractApiError(requestError, '无法完成授权本地源码扫描')
      );
      await Promise.all([
        loadProjectSourceScanHistory(projectId),
        loadProjectSourceEvidenceAdoptions(projectId),
      ]);
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: sourceScanRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setSourceScanLoading(false);
      }
    }
  };

  const confirmSourceEvidenceAdoption = () => {
    if (!selectedProject || !sourceEvidenceDraft) return;

    const projectId = selectedProject.projectId;
    const preview = sourceEvidenceDraft;
    Modal.confirm({
      title: '确认采纳当前源码证据草稿？',
      okText: '固定采纳清单',
      cancelText: '取消',
      width: 640,
      content: (
        <Space direction="vertical" size="small" style={{ width: '100%', marginTop: 12 }}>
          <Text>
            本操作只把当前 <Text code>{preview.draftSetHash}</Text> 对应的证据草稿固定为不可变
            Adoption Manifest。
          </Text>
          <Text type="secondary">
            Draft 与 Adoption 本身都不计分，也不会创建或修改
            EvaluationRun；外部扫描、生产验证和生产验收仍保持关闭。
          </Text>
        </Space>
      ),
      onOk: async () => {
        const operationSequence = sourceEvidenceOperationRequestSequenceRef.current + 1;
        sourceEvidenceOperationRequestSequenceRef.current = operationSequence;
        setSourceEvidenceAdopting(true);
        setSourceEvidenceOperationError('');
        setSourceEvidenceOperationNotice('');
        try {
          const response = (await projectGradeAPI.adoptProjectSourceEvidence(projectId, {
            sourceScanId: preview.sourceScanId,
            expectedDraftSetHash: preview.draftSetHash,
            adoptionVersion: 1,
          })) as unknown as ProjectGradeSourceEvidenceAdoptionResponse;
          if (
            sourceEvidenceOperationRequestSequenceRef.current !== operationSequence ||
            selectedProjectIdRef.current !== projectId
          ) {
            return;
          }
          setSourceEvidenceOperationNotice(
            `采纳清单已固定：${response.data.adoption.adoptionId}。尚未创建评估运行，也未改变项目评分。`
          );
          await loadProjectSourceEvidenceAdoptions(projectId);
        } catch (requestError) {
          if (
            sourceEvidenceOperationRequestSequenceRef.current !== operationSequence ||
            selectedProjectIdRef.current !== projectId
          ) {
            return;
          }
          const code = readApiErrorCode(requestError);
          const mappedMessage: Record<string, string> = {
            PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED:
              '源码扫描已不再满足安全投影契约，未创建采纳清单。',
            PROJECT_GRADE_SOURCE_EVIDENCE_DRAFT_SET_CHANGED:
              '证据草稿集合已变化，请重新加载 Draft Preview 后再确认采纳。',
            PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION_UNSUPPORTED:
              '当前采纳协议版本不受服务端支持，未创建采纳清单。',
            PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_UNAVAILABLE:
              '采纳清单持久化失败，服务端没有把本次操作报告为成功。',
            PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账号没有管理员权限，不能采纳源码证据。',
          };
          setSourceEvidenceOperationError(
            mappedMessage[code] || extractApiError(requestError, '无法采纳源码证据草稿')
          );
        } finally {
          if (
            sourceEvidenceOperationRequestSequenceRef.current === operationSequence &&
            selectedProjectIdRef.current === projectId
          ) {
            setSourceEvidenceAdopting(false);
          }
        }
      },
    });
  };

  const runSourceEvidenceEvaluation = async (adoption: ProjectGradeSourceEvidenceAdoption) => {
    if (!selectedProject) return;

    const projectId = selectedProject.projectId;
    const reportSequence = reportRequestSequenceRef.current + 1;
    reportRequestSequenceRef.current = reportSequence;
    const operationSequence = sourceEvidenceOperationRequestSequenceRef.current + 1;
    sourceEvidenceOperationRequestSequenceRef.current = operationSequence;
    setSourceEvidenceEvaluatingAdoptionId(adoption.adoptionId);
    setSourceEvidenceOperationError('');
    setSourceEvidenceOperationNotice('');
    setSourceEvidenceLastEvaluation(null);
    try {
      const response = (await projectGradeAPI.runProjectSourceEvidenceEvaluation(projectId, {
        adoptionId: adoption.adoptionId,
      })) as unknown as ProjectGradeSourceEvidenceEvaluationResponse;
      if (
        sourceEvidenceOperationRequestSequenceRef.current !== operationSequence ||
        selectedProjectIdRef.current !== projectId
      ) {
        return;
      }

      const evaluationRun = response.data.run;
      setSourceEvidenceLastEvaluation(evaluationRun);
      if (evaluationRun.projectionStatus === 'ready') {
        if (
          isCurrentProjectRequest({
            activeProjectId: selectedProjectIdRef.current,
            requestProjectId: projectId,
            activeSequence: reportRequestSequenceRef.current,
            requestSequence: reportSequence,
          })
        ) {
          reportProjectIdRef.current = projectId;
          setRun(evaluationRun);
          setScope({
            mode: 'source_evidence_adoption',
            target: adoption.adoptionId,
            productionAcceptance: response.data.scope.productionAcceptance,
            note: response.data.scope.note,
          });
          setReportSource('persisted');
          setSourceEvidenceOperationNotice(
            `来源证据评估运行 ${evaluationRun.runId} 已完成整体重算；生产验证与生产验收仍为 false。`
          );
        } else {
          setSourceEvidenceOperationNotice(
            `来源证据评估运行 ${evaluationRun.runId} 已完成整体重算；当前报告视图保持用户最后选择。`
          );
        }
      } else if (evaluationRun.projectionStatus === 'failed') {
        setSourceEvidenceOperationError(
          evaluationRun.projectionError ||
            `评估运行 ${evaluationRun.runId} 投影失败，未将其作为已完成评分展示。`
        );
      } else {
        setSourceEvidenceOperationNotice(
          `评估运行 ${evaluationRun.runId} 当前为 ${evaluationRun.projectionStatus}，尚未作为完成评分展示。`
        );
      }

      await Promise.all([
        loadProjects(),
        loadEntitlements(),
        loadProjectRuns(projectId),
        loadProjectWorkflow(projectId),
        loadProjectSourceEvidenceAdoptions(projectId),
      ]);
    } catch (requestError) {
      if (
        sourceEvidenceOperationRequestSequenceRef.current !== operationSequence ||
        selectedProjectIdRef.current !== projectId
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      const mappedMessage: Record<string, string> = {
        PROJECT_GRADE_PROJECTION_IN_PROGRESS:
          '同一采纳清单的评估投影正在进行，请稍后刷新；当前页面不会把它伪报为已完成。',
        PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_NOT_FOUND: '所选采纳清单已不存在或不属于当前项目。',
        PROJECT_GRADE_SOURCE_EVIDENCE_SCAN_UNAVAILABLE:
          '采纳清单对应的成功源码扫描已不可用，服务端已拒绝评估。',
        PROJECT_GRADE_SOURCE_EVIDENCE_TARGET_UNAVAILABLE:
          '采纳清单对应的授权源码目标已不可用，服务端已拒绝评估。',
        PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED:
          '采纳清单无法按原版本重建证据草稿，服务端已失败关闭。',
        PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_REJECTED:
          '不可变采纳输入与当前评分契约不匹配，服务端已拒绝评估。',
        PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_UNAVAILABLE:
          '评估运行持久化或投影失败，未产生可报告的完成评分。',
        PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账号没有管理员权限，不能创建来源证据评估。',
      };
      setSourceEvidenceOperationError(
        mappedMessage[code] || extractApiError(requestError, '无法创建来源证据评估运行')
      );
      await Promise.all([
        loadProjectRuns(projectId),
        loadProjectSourceEvidenceAdoptions(projectId),
      ]);
    } finally {
      if (
        sourceEvidenceOperationRequestSequenceRef.current === operationSequence &&
        selectedProjectIdRef.current === projectId
      ) {
        setSourceEvidenceEvaluatingAdoptionId(null);
      }
    }
  };

  const openHistoryRun = async (runId: string) => {
    const projectId = selectedProjectIdRef.current;
    if (!projectId) return;

    const requestSequence = reportRequestSequenceRef.current + 1;
    reportRequestSequenceRef.current = requestSequence;
    setRunLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.getRun(runId)) as unknown as RunResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      reportProjectIdRef.current = projectId;
      setRun(response.data.run);
      setScope(persistedAssessmentScope);
      setReportSource('persisted');
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setWorkspaceError(extractApiError(requestError, '无法加载所选的评估记录'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setRunLoading(false);
      }
    }
  };

  const rebuildProjection = async (record: ProjectGradeRun) => {
    if (!selectedProject) return;

    const projectId = selectedProject.projectId;
    const requestSequence = projectionRebuildRequestSequenceRef.current + 1;
    projectionRebuildRequestSequenceRef.current = requestSequence;
    const shouldRefreshAudit = auditLoadedProjectId === projectId;
    setProjectionRebuildLoading(record.runId);
    setWorkspaceError('');
    try {
      await projectGradeAPI.rebuildProjection(record.runId);
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectionRebuildRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      await Promise.all([
        loadProjects(),
        loadProjectRuns(projectId),
        loadProjectWorkflow(projectId),
        shouldRefreshAudit ? loadProjectAudit(projectId) : Promise.resolve(),
      ]);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectionRebuildRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      setWorkspaceError(
        hasHttpStatus(requestError, 403)
          ? '当前账户没有执行投影重建的权限'
          : code === 'PROJECT_GRADE_PROJECTION_IN_PROGRESS' || hasHttpStatus(requestError, 409)
            ? '该评估运行的投影正在进行，请稍后刷新；页面不会把它伪报为已完成。'
            : extractApiError(requestError, '无法重建评估投影')
      );
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: projectionRebuildRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setProjectionRebuildLoading(null);
      }
    }
  };

  const publishEvaluationReport = (record: ProjectGradeRun) => {
    if (!selectedProject) return;
    if (!entitlements?.capabilities.reportPublishEnabled) {
      Modal.warning({
        title: '当前套餐不包含正式报告发布',
        content: '请升级智评通套餐后发布正式报告。服务端仍会执行最终权益校验。',
      });
      return;
    }
    if (!quotaAvailable('project_grade_report_publish')) {
      Modal.warning({
        title: '今日正式报告发布额度已用尽',
        content: '请等待 UTC 日额度重置或升级套餐。服务端额度账本是最终权威。',
      });
      return;
    }

    const projectId = selectedProject.projectId;
    const previousReport = projectReports.find((report) => report.runId === record.runId);
    const lifecycle = previousReport ? reportLifecycleStatus(previousReport) : null;
    Modal.confirm({
      title: lifecycle ? '重新发布正式报告' : '发布正式报告',
      content:
        lifecycle === 'revoked'
          ? '将复用原公开编号和不可变报告内容，并重新开始套餐有效期。'
          : lifecycle === 'expired'
            ? '该报告已过期；重新发布将复用原公开编号和不可变内容。'
            : '正式报告只使用服务端持久化评分、维度和 Finding，发布后内容摘要不可修改。',
      okText: lifecycle ? '确认重新发布' : '确认发布',
      cancelText: '取消',
      onOk: async () => {
        const requestSequence = reportOperationRequestSequenceRef.current + 1;
        reportOperationRequestSequenceRef.current = requestSequence;
        const operationKey = `publish:${record.runId}`;
        const shouldRefreshAudit = auditLoadedProjectId === projectId;
        setReportOperationLoading(operationKey);
        setProjectReportsError('');
        try {
          const response = (await projectGradeAPI.publishProjectReport(
            projectId,
            record.runId
          )) as unknown as WorkflowResponse<{ report: ProjectGradePublishedReport }>;
          if (
            !isCurrentProjectRequest({
              activeProjectId: selectedProjectIdRef.current,
              requestProjectId: projectId,
              activeSequence: reportOperationRequestSequenceRef.current,
              requestSequence,
            })
          ) {
            return;
          }
          await Promise.all([
            loadProjectReports(projectId),
            loadEntitlements(),
            shouldRefreshAudit ? loadProjectAudit(projectId) : Promise.resolve(),
          ]);
          Modal.success({
            title: lifecycle ? '正式报告已重新发布' : '正式报告已发布',
            content: `公开编号：${response.data.report.publicId}；到期时间：${formatDate(
              response.data.report.expiresAt
            )}`,
          });
        } catch (requestError) {
          if (
            !isCurrentProjectRequest({
              activeProjectId: selectedProjectIdRef.current,
              requestProjectId: projectId,
              activeSequence: reportOperationRequestSequenceRef.current,
              requestSequence,
            })
          ) {
            return;
          }
          const code = readApiErrorCode(requestError);
          const mappedMessage: Record<string, string> = {
            PROJECT_GRADE_REPORT_PUBLISH_PLAN_REQUIRED:
              '当前套餐不包含正式报告发布权益，请升级后重试。',
            PROJECT_GRADE_REPORT_ALREADY_PUBLISHED:
              '该评估运行已有仍在有效期内的公开报告，请直接查看现有报告。',
            PROJECT_GRADE_REPORT_RUN_NOT_READY: '该评估运行尚未形成可发布的就绪投影。',
            PROJECT_GRADE_REPORT_CONTENT_MISMATCH:
              '当前投影与原不可变报告内容不一致，请创建新的评估运行后发布。',
            PROJECT_GRADE_REPORT_PROJECT_ARCHIVED: '归档项目不能发布正式报告。',
            PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账户没有发布正式报告的管理员权限。',
          };
          setProjectReportsError(
            mappedMessage[code] || extractApiError(requestError, '无法发布正式报告')
          );
          return;
        } finally {
          if (
            isCurrentProjectRequest({
              activeProjectId: selectedProjectIdRef.current,
              requestProjectId: projectId,
              activeSequence: reportOperationRequestSequenceRef.current,
              requestSequence,
            })
          ) {
            setReportOperationLoading(null);
          }
        }
      },
    });
  };

  const downloadFormalReport = async (report: ProjectGradePublishedReport) => {
    if (!selectedProject) return;
    const lifecycle = reportLifecycleStatus(report);
    if (lifecycle !== 'public') {
      Modal.warning({
        title: lifecycle === 'expired' ? '正式报告已过期' : '正式报告已撤销',
        content: '请先从对应评估运行重新发布正式报告，再生成新的 PDF 交付。',
      });
      return;
    }
    if (!report.contentFingerprint) {
      Modal.warning({
        title: '报告缺少不可变内容指纹',
        content: '旧报告不能作为正式 PDF 交付，请重新发布后再下载。',
      });
      return;
    }
    if (!entitlements?.capabilities.reportDownloadEnabled) {
      Modal.warning({
        title: '当前套餐不包含 PDF 正式交付',
        content: '升级智评通套餐后可下载带内容指纹和文档指纹的正式 PDF 报告。',
        okText: '查看套餐',
        onOk: () => {
          window.location.href = entitlements?.plan.upgradeUrl || buildProjectGradeUpgradeUrl();
        },
      });
      return;
    }
    if (!quotaAvailable('project_grade_report_download')) {
      Modal.warning({
        title: '今日 PDF 下载额度已用尽',
        content: '请等待 UTC 日额度重置或升级套餐。服务端原子额度账本是最终权威。',
        okText: '查看套餐',
        onOk: () => {
          window.location.href = entitlements.plan.upgradeUrl || buildProjectGradeUpgradeUrl();
        },
      });
      return;
    }

    const projectId = selectedProject.projectId;
    const requestSequence = reportDownloadRequestSequenceRef.current + 1;
    reportDownloadRequestSequenceRef.current = requestSequence;
    setReportDownloadLoading(report.publicId);
    setProjectReportsError('');
    try {
      const response = (await projectGradeAPI.downloadProjectReportPdf(
        projectId,
        report.publicId
      )) as unknown as ProjectReportPdfResponse;
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportDownloadRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      if (!(response.data instanceof Blob) || response.data.size <= 0) {
        throw new Error('服务端没有返回有效的 PDF 文件');
      }
      const disposition = readResponseHeader(response.headers, 'content-disposition');
      const fileName =
        parseAttachmentFileName(disposition) ||
        buildProjectReportPdfFileName(report.title, report.publicId);
      saveBlobAsDownload(response.data, fileName);

      const refreshDeliveryHistory = reportDeliveryTarget?.publicId === report.publicId;
      const shouldRefreshAudit = auditLoadedProjectId === projectId;
      await Promise.all([
        loadEntitlements(),
        refreshDeliveryHistory ? loadProjectReportDeliveries(projectId, report) : Promise.resolve(),
        shouldRefreshAudit ? loadProjectAudit(projectId) : Promise.resolve(),
      ]);
      const deliveryId = readResponseHeader(response.headers, 'x-aibak-delivery-id');
      const branding = readResponseHeader(response.headers, 'x-aibak-report-branding');
      Modal.success({
        title: '正式 PDF 已交付',
        content: `文件：${fileName}；品牌：${
          branding === 'white_label' ? '去品牌' : 'AIbak'
        }${deliveryId ? `；交付编号：${deliveryId}` : ''}`,
      });
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportDownloadRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      const mappedMessage: Record<string, string> = {
        PROJECT_GRADE_QUOTA_EXCEEDED: '当前套餐不包含 PDF 下载或今日下载额度已用尽。',
        PROJECT_GRADE_REPORT_DOWNLOAD_PLAN_REQUIRED: '当前套餐不包含正式报告 PDF 下载权益。',
        PROJECT_GRADE_REPORT_DOWNLOAD_REVOKED: '该正式报告已撤销，请重新发布后再下载。',
        PROJECT_GRADE_REPORT_DOWNLOAD_EXPIRED: '该正式报告已过期，请重新发布后再下载。',
        PROJECT_GRADE_REPORT_FINGERPRINT_MISSING: '该报告缺少不可变内容指纹，不能正式交付。',
        PROJECT_GRADE_REPORT_PDF_UNAVAILABLE: 'PDF 生成服务暂时不可用，请稍后重试。',
        PROJECT_GRADE_ENTITLEMENT_SERVICE_UNAVAILABLE: '智评通权益服务暂时不可用，请稍后重试。',
        PROJECT_GRADE_REPORT_NOT_FOUND: '该正式报告已不存在或不属于当前项目。',
        PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账户没有下载该正式报告的权限。',
      };
      const errorMessage =
        mappedMessage[code] || extractApiError(requestError, '无法下载正式 PDF 报告');
      setProjectReportsError(errorMessage);
      Modal.error({ title: 'PDF 交付失败', content: errorMessage });
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportDownloadRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setReportDownloadLoading(null);
      }
    }
  };

  const submitReportRevocation = async () => {
    if (!selectedProject || !reportRevocationTarget) return;
    const reason = reportRevocationReason.trim();
    if (!reason) {
      setProjectReportsError('撤销正式报告必须填写原因。');
      return;
    }

    const projectId = selectedProject.projectId;
    const publicId = reportRevocationTarget.publicId;
    const requestSequence = reportOperationRequestSequenceRef.current + 1;
    reportOperationRequestSequenceRef.current = requestSequence;
    const shouldRefreshAudit = auditLoadedProjectId === projectId;
    setReportOperationLoading(`revoke:${publicId}`);
    setProjectReportsError('');
    try {
      await projectGradeAPI.revokeProjectReport(projectId, publicId, reason);
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportOperationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setReportRevocationTarget(null);
      setReportRevocationReason('');
      await Promise.all([
        loadProjectReports(projectId),
        shouldRefreshAudit ? loadProjectAudit(projectId) : Promise.resolve(),
      ]);
      Modal.success({
        title: '正式报告已撤销',
        content: '公开访问已关闭；不可变报告内容和撤销审计仍被保留。',
      });
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportOperationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      const code = readApiErrorCode(requestError);
      const mappedMessage: Record<string, string> = {
        PROJECT_GRADE_REPORT_NOT_FOUND: '该正式报告已不存在或不属于当前项目。',
        PROJECT_GRADE_REPORT_ALREADY_REVOKED: '该正式报告已经撤销。',
        PROJECT_GRADE_PROJECT_FORBIDDEN: '当前账户没有撤销正式报告的管理员权限。',
      };
      setProjectReportsError(
        mappedMessage[code] || extractApiError(requestError, '无法撤销正式报告')
      );
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: reportOperationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setReportOperationLoading(null);
      }
    }
  };

  const createRemediation = async (finding: PersistedFinding) => {
    if (!selectedProject) return;

    const projectId = selectedProject.projectId;
    const requestSequence = workflowMutationRequestSequenceRef.current + 1;
    workflowMutationRequestSequenceRef.current = requestSequence;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.createRemediation(projectId, finding.findingId);
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      await loadProjectWorkflow(projectId);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setWorkspaceError(extractApiError(requestError, '无法创建整改任务'));
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setWorkflowLoading(false);
      }
    }
  };

  const submitFindingWorkflow = async (values: FindingWorkflowValues) => {
    if (!selectedProject || !findingWorkflowTarget) return;

    const projectId = selectedProject.projectId;
    const findingId = findingWorkflowTarget.findingId;
    const requestSequence = workflowMutationRequestSequenceRef.current + 1;
    workflowMutationRequestSequenceRef.current = requestSequence;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.updateFindingWorkflow(projectId, findingId, {
        status: values.status,
        note: values.note.trim(),
      });
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setFindingWorkflowTarget(null);
      findingWorkflowForm.resetFields();
      await loadProjectWorkflow(projectId);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setWorkspaceError(
        extractApiError(requestError, '无法更新 Finding 工作流；请确认管理员权限和填写说明')
      );
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setWorkflowLoading(false);
      }
    }
  };

  const submitRemediation = async (values: RemediationUpdateValues) => {
    if (!selectedProject || !remediationTarget) return;

    const projectId = selectedProject.projectId;
    const taskId = remediationTarget.taskId;
    const requestSequence = workflowMutationRequestSequenceRef.current + 1;
    workflowMutationRequestSequenceRef.current = requestSequence;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.updateRemediation(projectId, taskId, {
        status: values.status,
        completionNote: values.completionNote?.trim() || undefined,
        retestRunId: values.retestRunId || undefined,
      });
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setRemediationTarget(null);
      remediationForm.resetFields();
      await loadProjectWorkflow(projectId);
    } catch (requestError) {
      if (
        !isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        return;
      }
      setWorkspaceError(
        extractApiError(requestError, '无法更新整改任务；验证状态须由服务端复测规则判定')
      );
    } finally {
      if (
        isCurrentProjectRequest({
          activeProjectId: selectedProjectIdRef.current,
          requestProjectId: projectId,
          activeSequence: workflowMutationRequestSequenceRef.current,
          requestSequence,
        })
      ) {
        setWorkflowLoading(false);
      }
    }
  };

  const dimensionColumns = [
    {
      title: '评分维度',
      dataIndex: 'label',
      key: 'label',
      width: 230,
      render: (value: string, record: DimensionSnapshot) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">权重 {record.weight} / 1000</Text>
        </Space>
      ),
    },
    {
      title: '维度完成率',
      dataIndex: 'normalizedScore',
      key: 'normalizedScore',
      width: 240,
      render: (value: number) => <Progress percent={value} size="small" status="normal" />,
    },
    {
      title: '原始得分',
      dataIndex: 'rawScore',
      key: 'rawScore',
      width: 130,
      render: (value: number, record: DimensionSnapshot) => (
        <Text strong>
          {value} / {record.weight}
        </Text>
      ),
    },
    {
      title: '证据与完成度',
      key: 'rule',
      render: (_: unknown, record: DimensionSnapshot) => {
        const rule = record.rules[0];
        if (!rule) return <Tag>未配置规则</Tag>;
        const evidence = evidenceLabels[rule.evidenceLevel];
        return (
          <Space direction="vertical" size={2}>
            <Space wrap>
              <Tag color={evidence.color}>
                {evidence.text} × {rule.evidenceFactor}
              </Tag>
              <Tag>完成度 {Math.round(rule.completion * 100)}%</Tag>
            </Space>
            <Text type="secondary">{rule.notes}</Text>
          </Space>
        );
      },
    },
  ];

  const findingColumns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 80,
      render: (value: Severity) => <Tag color={severityColors[value]}>{value}</Tag>,
    },
    { title: '问题', dataIndex: 'title', key: 'title', width: 280 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '事实与整改建议',
      key: 'detail',
      render: (_: unknown, record: ProjectGradeFinding) => (
        <Space direction="vertical" size={4}>
          <Text>{record.description}</Text>
          <Text type="secondary">建议：{record.recommendation}</Text>
        </Space>
      ),
    },
  ];

  const evidenceColumns = [
    {
      title: '证据等级',
      dataIndex: 'level',
      key: 'level',
      width: 170,
      render: (value: EvidenceLevel, record: ProjectGradeEvidence) => {
        const evidence = evidenceLabels[value];
        return (
          <Tag color={evidence.color}>
            {evidence.text} × {record.factor}
          </Tag>
        );
      },
    },
    { title: '证据', dataIndex: 'title', key: 'title', width: 240 },
    {
      title: '来源与说明',
      key: 'source',
      render: (_: unknown, record: ProjectGradeEvidence) => (
        <Space direction="vertical" size={2}>
          <Text>{record.description}</Text>
          <Text code>{record.source}</Text>
        </Space>
      ),
    },
    {
      title: '生产核验',
      key: 'verified',
      width: 120,
      render: (_: unknown, record: ProjectGradeEvidence) =>
        record.level === 'production_automatic' && record.verifiedAt ? (
          <Tag color="success">已核验</Tag>
        ) : (
          <Tag>未计为生产证据</Tag>
        ),
    },
  ];

  const projectColumns = [
    {
      title: '项目',
      dataIndex: 'name',
      key: 'name',
      render: (value: string, record: ProjectWorkspaceProject) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.description || '未填写项目说明'}</Text>
        </Space>
      ),
    },
    {
      title: '类型',
      dataIndex: 'projectType',
      key: 'projectType',
      width: 120,
      render: (value: ProjectType) => <Tag>{projectTypeLabels[value]}</Tag>,
    },
    {
      title: '最近评估',
      key: 'latest',
      width: 190,
      render: (_: unknown, record: ProjectWorkspaceProject) =>
        record.latestRunId ? (
          <Space direction="vertical" size={0}>
            <Text strong>
              {record.latestScore === undefined
                ? '记录已保存'
                : `${record.latestScore.toFixed(1)} / 100`}
            </Text>
            <Text type="secondary">{formatDate(record.latestAssessedAt)}</Text>
          </Space>
        ) : (
          <Text type="secondary">尚未评估</Text>
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 95,
      render: (value: ProjectStatus) => (
        <Tag color={value === 'active' ? 'success' : 'default'}>
          {value === 'active' ? '进行中' : '已归档'}
        </Tag>
      ),
    },
  ];

  const persistedFindingColumns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 76,
      render: (value: Severity) => <Tag color={severityColors[value]}>{value}</Tag>,
    },
    { title: 'Finding', dataIndex: 'title', key: 'title', width: 250 },
    {
      title: '工作流状态',
      dataIndex: 'currentStatus',
      key: 'currentStatus',
      width: 150,
      render: (value: FindingWorkflowStatus, record: PersistedFinding) => (
        <Space direction="vertical" size={0}>
          <Tag>{value}</Tag>
          {record.resolutionNote && <Text type="secondary">{record.resolutionNote}</Text>}
        </Space>
      ),
    },
    {
      title: '事实与建议',
      key: 'detail',
      render: (_: unknown, record: PersistedFinding) => (
        <Space direction="vertical" size={2}>
          <Text>{record.description}</Text>
          <Text type="secondary">建议：{record.recommendation}</Text>
          <Text type="secondary">发现时间：{formatDate(record.detectedAt)}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 210,
      render: (_: unknown, record: PersistedFinding) => (
        <Space wrap>
          <Button
            size="small"
            onClick={() => {
              setFindingWorkflowTarget(record);
              findingWorkflowForm.setFieldsValue({ status: record.currentStatus, note: '' });
            }}
          >
            更新工作流
          </Button>
          <Button size="small" onClick={() => void createRemediation(record)}>
            创建整改任务
          </Button>
        </Space>
      ),
    },
  ];

  const persistedEvidenceColumns = [
    {
      title: '证据等级',
      dataIndex: 'level',
      key: 'level',
      width: 170,
      render: (value: EvidenceLevel, record: PersistedEvidence) => {
        const evidence = evidenceLabels[value];
        return (
          <Tag color={evidence.color}>
            {evidence.text} × {record.factor}
          </Tag>
        );
      },
    },
    { title: '证据', dataIndex: 'title', key: 'title', width: 240 },
    {
      title: '来源',
      key: 'source',
      render: (_: unknown, record: PersistedEvidence) => (
        <Space direction="vertical" size={2}>
          <Text>{record.description}</Text>
          <Text code>{record.source}</Text>
          <Text type="secondary">收集于 {formatDate(record.collectedAt)}</Text>
        </Space>
      ),
    },
  ];

  const remediationColumns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'severity',
      width: 76,
      render: (value: Severity) => <Tag color={severityColors[value]}>{value}</Tag>,
    },
    { title: '整改任务', dataIndex: 'title', key: 'title', width: 250 },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 150,
      render: (value: RemediationStatus, record: RemediationTask) => (
        <Space direction="vertical" size={0}>
          <Tag>{value}</Tag>
          {record.verifiedAt && (
            <Text type="secondary">核验于 {formatDate(record.verifiedAt)}</Text>
          )}
        </Space>
      ),
    },
    {
      title: '复测与截止',
      key: 'retest',
      width: 210,
      render: (_: unknown, record: RemediationTask) => (
        <Space direction="vertical" size={2}>
          <Text>截止：{formatDate(record.dueAt)}</Text>
          <Text type="secondary">复测记录：{record.retestRunId || '尚未关联'}</Text>
        </Space>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      width: 110,
      render: (_: unknown, record: RemediationTask) => (
        <Button
          size="small"
          onClick={() => {
            setRemediationTarget(record);
            remediationForm.setFieldsValue({
              status: record.status,
              completionNote: record.completionNote,
              retestRunId: record.retestRunId,
            });
          }}
        >
          更新任务
        </Button>
      ),
    },
  ];

  const auditColumns = [
    {
      title: '时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (value: string) => formatDate(value),
    },
    {
      title: '操作',
      dataIndex: 'action',
      key: 'action',
      width: 180,
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: '结果',
      dataIndex: 'outcome',
      key: 'outcome',
      width: 110,
      render: (value: ProjectGradeAuditLog['outcome']) => (
        <Tag
          color={value === 'succeeded' ? 'success' : value === 'failed' ? 'error' : 'processing'}
        >
          {value}
        </Tag>
      ),
    },
    {
      title: '目标与状态变化',
      key: 'target',
      render: (_: unknown, record: ProjectGradeAuditLog) => (
        <Space direction="vertical" size={2}>
          <Text>
            {record.targetType}: {record.targetId}
          </Text>
          {(record.fromStatus || record.toStatus) && (
            <Text type="secondary">
              {record.fromStatus || '—'} → {record.toStatus || '—'}
            </Text>
          )}
          {record.reason && <Text type="secondary">说明：{record.reason}</Text>}
          {record.errorCode && <Text type="secondary">失败代码：{record.errorCode}</Text>}
        </Space>
      ),
    },
  ];

  const urlScanHistoryColumns = [
    {
      title: '扫描时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value: string) => formatDate(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: ProjectGradeUrlScanRun['status']) => (
        <Tag color={value === 'succeeded' ? 'success' : 'error'}>
          {value === 'succeeded' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: 'HTTP',
      dataIndex: 'statusCode',
      key: 'statusCode',
      width: 80,
      render: (value?: number) => value ?? '—',
    },
    {
      title: '扫描版本',
      dataIndex: 'scanVersion',
      key: 'scanVersion',
      width: 150,
      render: (value?: string) => value || '—',
    },
    {
      title: '净化后的地址 / 失败摘要',
      key: 'summary',
      render: (_: unknown, record: ProjectGradeUrlScanRun) =>
        record.status === 'succeeded' ? (
          <Text ellipsis={{ tooltip: record.finalUrl || record.requestedUrl }}>
            {record.finalUrl || record.requestedUrl}
          </Text>
        ) : (
          <Space direction="vertical" size={0}>
            <Text type="danger">{record.errorCode || 'URL_SCAN_FAILED'}</Text>
            <Text type="secondary">{record.errorSummary || '扫描未完成'}</Text>
          </Space>
        ),
    },
    {
      title: '耗时',
      dataIndex: 'durationMs',
      key: 'durationMs',
      width: 100,
      render: (value?: number) => (value === undefined ? '—' : `${value} ms`),
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_: unknown, record: ProjectGradeUrlScanRun) =>
        record.status === 'succeeded' && record.result ? (
          <Button type="link" size="small" onClick={() => setSelectedUrlScanSnapshot(record)}>
            查看快照
          </Button>
        ) : (
          <Text type="secondary">不可查看</Text>
        ),
    },
  ];

  const sourceScanHistoryColumns = [
    {
      title: '扫描时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value: string) => formatDate(value),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (value: ProjectGradeSourceScanRun['status']) => (
        <Tag color={value === 'succeeded' ? 'success' : 'error'}>
          {value === 'succeeded' ? '成功' : '失败'}
        </Tag>
      ),
    },
    {
      title: '授权根',
      dataIndex: 'rootKey',
      key: 'rootKey',
      width: 190,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '证据摘要 / 失败摘要',
      key: 'summary',
      render: (_: unknown, record: ProjectGradeSourceScanRun) =>
        record.status === 'succeeded' && record.result ? (
          <Space direction="vertical" size={0}>
            <Text>
              {record.result.summary.filesScanned} 文件 · {record.result.summary.findings} 发现 ·{' '}
              {record.result.summary.routes} 路由
            </Text>
            <Text type="secondary" ellipsis={{ tooltip: record.snapshotHash }}>
              快照 {record.snapshotHash?.slice(0, 16) || '—'}…
            </Text>
          </Space>
        ) : (
          <Space direction="vertical" size={0}>
            <Text type="danger">{record.errorCode || 'SOURCE_SCAN_FAILED'}</Text>
            <Text type="secondary">{record.errorSummary || '扫描未完成'}</Text>
          </Space>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 210,
      render: (_: unknown, record: ProjectGradeSourceScanRun) =>
        record.status === 'succeeded' ? (
          <Space size={0} wrap>
            <Button
              type="link"
              size="small"
              disabled={!record.result}
              onClick={() => setSelectedSourceScanSnapshot(record)}
            >
              查看快照
            </Button>
            <Button
              type="link"
              size="small"
              loading={sourceEvidenceDraftLoadingSourceScanId === record.scanId}
              onClick={() => {
                if (selectedProject) {
                  void loadProjectSourceEvidenceDraft(selectedProject.projectId, record.scanId);
                }
              }}
            >
              预览证据草稿
            </Button>
          </Space>
        ) : (
          <Text type="secondary">不可查看</Text>
        ),
    },
  ];

  const sourceEvidenceDraftColumns = [
    {
      title: '草稿标题',
      dataIndex: 'title',
      key: 'title',
      width: 260,
      render: (value: string, record: ProjectGradeSourceEvidenceDraft) => (
        <Space direction="vertical" size={0}>
          <Text strong>{value}</Text>
          <Text type="secondary">{record.description}</Text>
        </Space>
      ),
    },
    {
      title: '评分维度',
      dataIndex: 'dimensionKey',
      key: 'dimensionKey',
      width: 190,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '草稿类型',
      dataIndex: 'kind',
      key: 'kind',
      width: 150,
      render: (value: ProjectGradeSourceEvidenceDraftKind) => <Tag>{value}</Tag>,
    },
    {
      title: '规则',
      dataIndex: 'ruleKey',
      key: 'ruleKey',
      width: 190,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '安全来源',
      dataIndex: 'source',
      key: 'source',
      width: 260,
      render: (value: string) => (
        <Text code ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
  ];

  const sourceEvidenceAdoptionColumns = [
    {
      title: '采纳时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (value: string) => formatDate(value),
    },
    {
      title: 'Adoption Manifest',
      dataIndex: 'adoptionId',
      key: 'adoptionId',
      width: 250,
      render: (value: string) => (
        <Text copyable code ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: 'SourceScan',
      dataIndex: 'sourceScanId',
      key: 'sourceScanId',
      width: 180,
      render: (value: string) => <Text code>{value}</Text>,
    },
    {
      title: '草稿数',
      dataIndex: 'draftCount',
      key: 'draftCount',
      width: 90,
    },
    {
      title: '版本',
      key: 'versions',
      width: 130,
      render: (_: unknown, record: ProjectGradeSourceEvidenceAdoption) => (
        <Text>
          P{record.projectionVersion} / A{record.adoptionVersion}
        </Text>
      ),
    },
    {
      title: '计分状态',
      dataIndex: 'scoringDisposition',
      key: 'scoringDisposition',
      width: 210,
      render: (value: ProjectGradeSourceEvidenceAdoption['scoringDisposition']) => (
        <Tag color="warning">{value}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 190,
      render: (_: unknown, record: ProjectGradeSourceEvidenceAdoption) => (
        <Button
          type="primary"
          size="small"
          loading={sourceEvidenceEvaluatingAdoptionId === record.adoptionId}
          disabled={
            !quotaAvailable('project_grade_evaluation') ||
            isSourceEvidenceEvaluationDisabled({
              adoptionInProgress: sourceEvidenceAdopting,
              evaluationInProgress: Boolean(sourceEvidenceEvaluatingAdoptionId),
              projectActive: selectedProject?.status === 'active',
            })
          }
          onClick={() => void runSourceEvidenceEvaluation(record)}
        >
          创建来源证据评估
        </Button>
      ),
    },
  ];

  const reportDeliveryColumns = [
    {
      title: '交付时间',
      dataIndex: 'deliveredAt',
      key: 'deliveredAt',
      width: 180,
      render: (value: string) => formatDate(value),
    },
    {
      title: '交付编号',
      dataIndex: 'deliveryId',
      key: 'deliveryId',
      width: 220,
      render: (value: string) => (
        <Text copyable code ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: '请求人',
      dataIndex: 'requestedBy',
      key: 'requestedBy',
      width: 180,
      render: (value: string) => (
        <Text copyable ellipsis={{ tooltip: value }}>
          {value}
        </Text>
      ),
    },
    {
      title: '套餐 / 品牌',
      key: 'commercial',
      width: 150,
      render: (_: unknown, record: ProjectGradeReportDelivery) => (
        <Space direction="vertical" size={0}>
          <Tag color="blue">{record.planId.toUpperCase()}</Tag>
          <Text type="secondary">
            {record.branding === 'white_label' ? '去品牌' : 'AIbak 品牌'}
          </Text>
        </Space>
      ),
    },
    {
      title: '文件',
      key: 'file',
      width: 230,
      render: (_: unknown, record: ProjectGradeReportDelivery) => (
        <Space direction="vertical" size={0}>
          <Text ellipsis={{ tooltip: record.fileName }}>{record.fileName}</Text>
          <Text type="secondary">{formatReportDeliveryBytes(record.byteLength)}</Text>
        </Space>
      ),
    },
    {
      title: '内容 / PDF 指纹',
      key: 'fingerprints',
      width: 300,
      render: (_: unknown, record: ProjectGradeReportDelivery) => (
        <Space direction="vertical" size={0}>
          <Text copyable code ellipsis={{ tooltip: record.contentFingerprint }}>
            {record.contentFingerprint}
          </Text>
          <Text copyable code ellipsis={{ tooltip: record.documentFingerprint }}>
            {record.documentFingerprint}
          </Text>
        </Space>
      ),
    },
  ];

  const reportColumns = [
    {
      title: '正式报告',
      key: 'report',
      width: 280,
      render: (_: unknown, record: ProjectGradePublishedReport) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.title}</Text>
          <Text copyable code>
            {record.publicId}
          </Text>
        </Space>
      ),
    },
    {
      title: '评分',
      key: 'score',
      width: 120,
      render: (_: unknown, record: ProjectGradePublishedReport) => (
        <Space direction="vertical" size={0}>
          <Text strong>{record.externalScore.toFixed(1)} / 100</Text>
          <Tag>{record.verdict} 等级</Tag>
        </Space>
      ),
    },
    {
      title: '状态',
      key: 'status',
      width: 110,
      render: (_: unknown, record: ProjectGradePublishedReport) => {
        const status = reportLifecycleStatus(record);
        return (
          <Tag
            color={status === 'public' ? 'success' : status === 'expired' ? 'warning' : 'default'}
          >
            {status === 'public' ? '公开' : status === 'expired' ? '已过期' : '已撤销'}
          </Tag>
        );
      },
    },
    {
      title: '发布与到期',
      key: 'lifecycle',
      width: 230,
      render: (_: unknown, record: ProjectGradePublishedReport) => (
        <Space direction="vertical" size={0}>
          <Text>发布：{formatDate(record.publishedAt)}</Text>
          <Text type="secondary">到期：{formatDate(record.expiresAt)}</Text>
          {record.revokedAt && <Text type="secondary">撤销：{formatDate(record.revokedAt)}</Text>}
        </Space>
      ),
    },
    {
      title: '内容指纹',
      dataIndex: 'contentFingerprint',
      key: 'contentFingerprint',
      width: 240,
      render: (value?: string) =>
        value ? (
          <Text copyable code ellipsis={{ tooltip: value }}>
            {value}
          </Text>
        ) : (
          <Text type="secondary">旧报告未回填</Text>
        ),
    },
    {
      title: '操作',
      key: 'action',
      width: 390,
      render: (_: unknown, record: ProjectGradePublishedReport) => {
        const status = reportLifecycleStatus(record);
        const downloadDisabled =
          status !== 'public' ||
          !record.contentFingerprint ||
          !entitlements?.capabilities.reportDownloadEnabled ||
          !quotaAvailable('project_grade_report_download');
        const downloadDisabledReason =
          status === 'expired'
            ? '报告已过期，请重新发布'
            : status === 'revoked'
              ? '报告已撤销，请重新发布'
              : !record.contentFingerprint
                ? '旧报告缺少内容指纹，请重新发布'
                : !entitlements
                  ? '正在加载套餐权益'
                  : !entitlements.capabilities.reportDownloadEnabled
                    ? '当前套餐不包含 PDF 下载权益'
                    : !quotaAvailable('project_grade_report_download')
                      ? '今日 PDF 下载额度已用尽'
                      : undefined;
        return (
          <Space size="small" wrap>
            {status === 'public' && (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  window.open(
                    `/project-grade/reports/${record.publicId}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                查看公开报告
              </Button>
            )}
            <Button
              type="link"
              size="small"
              icon={<DownloadOutlined />}
              title={downloadDisabledReason}
              disabled={downloadDisabled}
              loading={reportDownloadLoading === record.publicId}
              onClick={() => void downloadFormalReport(record)}
            >
              下载 PDF
            </Button>
            <Button
              type="link"
              size="small"
              icon={<HistoryOutlined />}
              onClick={() => {
                if (!selectedProject) return;
                void loadProjectReportDeliveries(selectedProject.projectId, record);
              }}
            >
              交付记录
            </Button>
            {status === 'public' && (
              <Button
                danger
                type="link"
                size="small"
                loading={reportOperationLoading === `revoke:${record.publicId}`}
                onClick={() => {
                  setProjectReportsError('');
                  setReportRevocationReason('');
                  setReportRevocationTarget(record);
                }}
              >
                撤销
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  const historyColumns = [
    {
      title: '评估时间',
      dataIndex: 'assessedAt',
      key: 'assessedAt',
      render: (value: string) => formatDate(value),
    },
    {
      title: '得分',
      dataIndex: 'normalizedScore',
      key: 'normalizedScore',
      width: 110,
      render: (value: number) => <Text strong>{value.toFixed(1)} / 100</Text>,
    },
    { title: '等级', dataIndex: 'grade', key: 'grade', width: 80 },
    {
      title: '门禁',
      key: 'gate',
      width: 110,
      render: (_: unknown, record: ProjectGradeRun) => (
        <Tag color={gateColor(record.releaseGate.status)}>{record.releaseGate.status}</Tag>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 360,
      render: (_: unknown, record: ProjectGradeRun) => {
        const report = projectReports.find((item) => item.runId === record.runId);
        const lifecycle = report ? reportLifecycleStatus(report) : null;
        const publishDisabled =
          selectedProject?.status !== 'active' ||
          !entitlements?.capabilities.reportPublishEnabled ||
          !quotaAvailable('project_grade_report_publish');
        const publishDisabledReason =
          selectedProject?.status !== 'active'
            ? '归档项目不能发布正式报告'
            : !entitlements?.capabilities.reportPublishEnabled
              ? '当前套餐不包含正式报告发布权益'
              : !quotaAvailable('project_grade_report_publish')
                ? '今日正式报告发布额度已用尽'
                : undefined;

        return (
          <Space size="small" wrap>
            <Button type="link" size="small" onClick={() => void openHistoryRun(record.runId)}>
              查看内部报告
            </Button>
            {report && lifecycle === 'public' ? (
              <Button
                type="link"
                size="small"
                onClick={() =>
                  window.open(
                    `/project-grade/reports/${report.publicId}`,
                    '_blank',
                    'noopener,noreferrer'
                  )
                }
              >
                打开公开报告
              </Button>
            ) : (
              <Button
                type="link"
                size="small"
                disabled={publishDisabled}
                title={publishDisabledReason}
                loading={reportOperationLoading === `publish:${record.runId}`}
                onClick={() => void publishEvaluationReport(record)}
              >
                {report ? '重新发布' : '发布正式报告'}
              </Button>
            )}
            <Button
              type="link"
              size="small"
              loading={projectionRebuildLoading === record.runId}
              onClick={() => void rebuildProjection(record)}
            >
              管理员重建投影
            </Button>
          </Space>
        );
      },
    },
  ];

  const projectCapacityExhausted = Boolean(
    entitlements && entitlements.projects.limit !== -1 && entitlements.projects.remaining <= 0
  );
  const quotaAvailable = (resource: ProjectGradeQuotaResource): boolean => {
    const quota = entitlements?.daily[resource];
    return !quota || quota.limit === -1 || quota.remaining > 0;
  };
  const formatQuota = (quota: ProjectGradeQuotaEntitlement): string =>
    quota.limit === -1 ? `${quota.used} / 无限` : `${quota.used} / ${quota.limit}`;

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} align="middle">
        <Col flex="auto">
          <Title level={3} style={{ marginBottom: 4 }}>
            <BarChartOutlined /> AIbak 智评通 ProjectGrade
          </Title>
          <Paragraph type="secondary" style={{ marginBottom: 0 }}>
            Batch 0：确定性评分与证据门禁；Batch 1：受 Feature Flag 和 SSRF 边界保护的网址快速体检。
          </Paragraph>
        </Col>
        <Col>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => void loadBaseline()}
            loading={baselineLoading}
          >
            刷新内部基线
          </Button>
        </Col>
      </Row>

      <Alert
        type="warning"
        showIcon
        style={{ marginTop: 16, marginBottom: 16 }}
        message="当前页面不构成生产验收"
        description={
          scope?.note || '本页面不会把源码存在、持久化记录或本地测试结果声明为生产完成。'
        }
      />

      {baselineError && (
        <Alert
          type="error"
          showIcon
          message="内部基线加载失败"
          description={baselineError}
          action={
            <Button size="small" onClick={() => void loadBaseline()}>
              重试
            </Button>
          }
          style={{ marginBottom: 16 }}
        />
      )}

      <Card
        title={
          <Space>
            <FolderOpenOutlined />
            我的项目
          </Space>
        }
        style={{ marginBottom: 16 }}
      >
        {!authenticated ? (
          <Alert
            type="info"
            showIcon
            message="登录后可创建项目并保留评估历史"
            description="项目工作区需要账户授权；未登录时仍可查看不持久化的 AIbak 内部基线。"
            action={
              <Button type="primary" size="small" href={loginHref}>
                去登录
              </Button>
            }
          />
        ) : (
          <>
            <Card
              size="small"
              title="套餐与智评通权益"
              style={{ marginBottom: 16 }}
              extra={
                <Space>
                  <Button
                    size="small"
                    loading={entitlementsLoading}
                    onClick={() => void loadEntitlements()}
                  >
                    刷新额度
                  </Button>
                  <Button size="small" type="primary" href={buildProjectGradeUpgradeUrl()}>
                    升级套餐
                  </Button>
                </Space>
              }
            >
              {entitlementsError && (
                <Alert
                  type="error"
                  showIcon
                  style={{ marginBottom: 12 }}
                  message="权益状态加载失败"
                  description={entitlementsError}
                />
              )}
              <Spin spinning={entitlementsLoading}>
                {entitlements ? (
                  <>
                    <Row gutter={[12, 12]}>
                      <Col xs={12} md={6} xl={4}>
                        <Statistic title="当前套餐" value={entitlements.plan.name} />
                      </Col>
                      <Col xs={12} md={6} xl={4}>
                        <Statistic
                          title="活动项目"
                          value={
                            entitlements.projects.limit === -1
                              ? `${entitlements.projects.used} / 无限`
                              : `${entitlements.projects.used} / ${entitlements.projects.limit}`
                          }
                        />
                      </Col>
                      {(
                        [
                          'project_grade_url_scan',
                          'project_grade_source_scan',
                          'project_grade_evaluation',
                          'project_grade_report_publish',
                        ] as ProjectGradeQuotaResource[]
                      ).map((resource) => (
                        <Col xs={12} md={6} xl={4} key={resource}>
                          <Statistic
                            title={entitlements.daily[resource].label}
                            value={formatQuota(entitlements.daily[resource])}
                          />
                        </Col>
                      ))}
                    </Row>
                    <Text type="secondary">
                      每日额度按 UTC 结算，下次重置：{formatDate(entitlements.accounting.resetsAt)}
                      。 报告发布、下载和有效期仍由服务端套餐权益最终授权。
                    </Text>
                  </>
                ) : (
                  <Empty description="尚未取得套餐权益" image={Empty.PRESENTED_IMAGE_SIMPLE} />
                )}
              </Spin>
            </Card>
            <Alert
              type="info"
              showIcon
              style={{ marginBottom: 16 }}
              message="持久化记录的评估范围"
              description={persistedAssessmentScope.note}
            />
            {workspaceError && (
              <Alert
                type="error"
                showIcon
                message="项目工作区操作失败"
                description={workspaceError}
                action={
                  <Button size="small" onClick={() => void loadProjects()}>
                    重新加载项目
                  </Button>
                }
                style={{ marginBottom: 16 }}
              />
            )}
            {initialProjectDraft && (
              <Alert
                type="success"
                showIcon
                style={{ marginBottom: 16 }}
                message="已从免费网址体检安全带入项目地址"
                description="这里只带入经过清洗的 URL，不信任匿名页面的指数或证据。提交后会先创建项目，再由鉴权服务端重新扫描并保存本次项目体检历史。"
              />
            )}
            {projectCapacityExhausted && (
              <Alert
                type="warning"
                showIcon
                style={{ marginBottom: 16 }}
                message="当前套餐的活动项目数量已达上限"
                description="可以归档不再使用的项目，或升级套餐后继续创建。服务端会对并发创建请求执行容量保护。"
                action={
                  <Button size="small" type="primary" href={buildProjectGradeUpgradeUrl()}>
                    升级套餐
                  </Button>
                }
              />
            )}
            <Row gutter={[16, 16]}>
              <Col xs={24} xl={9}>
                <Card
                  size="small"
                  title={
                    <Space>
                      <PlusOutlined />
                      新建项目
                    </Space>
                  }
                >
                  <Form<CreateProjectValues>
                    form={form}
                    layout="vertical"
                    initialValues={{ projectType: 'website' }}
                    onFinish={(values) => void createProject(values)}
                  >
                    <Form.Item
                      label="项目名称"
                      name="projectName"
                      rules={[
                        {
                          required: true,
                          whitespace: true,
                          max: 120,
                          message: '请填写不超过 120 字的项目名称',
                        },
                      ]}
                    >
                      <Input maxLength={120} placeholder="例如：AIbak 主站" />
                    </Form.Item>
                    <Form.Item label="项目类型" name="projectType" rules={[{ required: true }]}>
                      <Select
                        options={Object.entries(projectTypeLabels).map(([value, label]) => ({
                          value,
                          label,
                        }))}
                      />
                    </Form.Item>
                    <Form.Item
                      label="项目地址（登记后可用于 Batch 1 快速体检）"
                      name="projectUrl"
                      rules={[{ type: 'url', message: '请输入有效 URL，或留空' }]}
                    >
                      <Input placeholder="https://example.com" />
                    </Form.Item>
                    <Form.Item
                      label="项目说明"
                      name="description"
                      rules={[{ max: 1000, message: '项目说明不能超过 1000 字' }]}
                    >
                      <Input.TextArea
                        rows={3}
                        maxLength={1000}
                        placeholder="可选，用于识别项目；不作为临时扫描地址。"
                      />
                    </Form.Item>
                    <Button
                      type="primary"
                      htmlType="submit"
                      loading={projectCreating}
                      disabled={projectCapacityExhausted}
                      icon={<PlusOutlined />}
                    >
                      创建项目
                    </Button>
                  </Form>
                </Card>
              </Col>
              <Col xs={24} xl={15}>
                <Card
                  size="small"
                  title="项目列表"
                  extra={
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={projectsLoading}
                      onClick={() => void loadProjects()}
                    >
                      刷新
                    </Button>
                  }
                >
                  <Spin spinning={projectsLoading}>
                    <Table
                      rowKey="projectId"
                      dataSource={projects}
                      columns={projectColumns}
                      size="small"
                      pagination={{ pageSize: 6, hideOnSinglePage: true }}
                      scroll={{ x: 760 }}
                      locale={{
                        emptyText: (
                          <Empty
                            description="还没有持久化项目"
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                          />
                        ),
                      }}
                      rowClassName={(record) =>
                        record.projectId === selectedProject?.projectId
                          ? 'ant-table-row-selected'
                          : ''
                      }
                      onRow={(record) => ({
                        onClick: () => selectProject(record),
                        style: { cursor: 'pointer' },
                      })}
                    />
                  </Spin>
                </Card>
              </Col>
            </Row>

            {selectedProject && (
              <Card
                size="small"
                title={`项目评估：${selectedProject.name}`}
                style={{ marginTop: 16 }}
                extra={
                  <Space wrap>
                    <Button
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => void runUrlQuickScan()}
                      loading={urlScanLoading}
                      disabled={
                        selectedProject.status !== 'active' ||
                        !selectedProject.projectUrl ||
                        !quotaAvailable('project_grade_url_scan')
                      }
                    >
                      网址快速体检（Batch 1）
                    </Button>
                    <Button
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => void runSourceScan()}
                      loading={sourceScanLoading}
                      disabled={
                        selectedProject.status !== 'active' ||
                        !quotaAvailable('project_grade_source_scan')
                      }
                    >
                      授权源码扫描（Batch 2）
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => void runPersistedEvaluation()}
                      loading={runLoading}
                      disabled={
                        selectedProject.status !== 'active' ||
                        !quotaAvailable('project_grade_evaluation')
                      }
                    >
                      创建持久化评估记录
                    </Button>
                  </Space>
                }
              >
                <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                  <Descriptions.Item label="项目类型">
                    {projectTypeLabels[selectedProject.projectType]}
                  </Descriptions.Item>
                  <Descriptions.Item label="登记地址">
                    {selectedProject.projectUrl || '未登记'}
                  </Descriptions.Item>
                  <Descriptions.Item label="项目状态">
                    {selectedProject.status === 'active' ? '进行中' : '已归档'}
                  </Descriptions.Item>
                  <Descriptions.Item label="评分边界">AIbak 服务端内部仓库</Descriptions.Item>
                  <Descriptions.Item label="网址体检边界">单次服务端 HTTP 观察</Descriptions.Item>
                  <Descriptions.Item label="源码扫描边界">
                    服务端登记的本地只读快照
                  </Descriptions.Item>
                </Descriptions>
                <Paragraph type="secondary" style={{ marginTop: 12 }}>
                  “创建持久化评估记录”仍只保存 AIbak 内部确定性基线；“网址快速体检”只使用项目已登记
                  URL；“授权源码扫描”只使用服务端登记的内部仓库根，不接受路径输入、不执行源码、不安装依赖、
                  不访问网络，也不修改最终评分或构成生产验收。
                </Paragraph>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="Batch 1 外部网址快速体检默认关闭"
                  description="启用后也只允许项目成员对数据库中已登记的 HTTP(S) 地址发起单次、限时、限大小的服务端观察；结果不是 Lighthouse 或真实浏览器报告，也不构成生产验收。"
                />
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="Batch 2 授权源码扫描采用失败关闭"
                  description="执行权限由服务端 owner/admin RBAC 决定；页面不提供 rootKey、相对路径或绝对路径输入。审计不可用、目标不合法或结果路径不安全时，服务端会拒绝扫描或拒绝保存。"
                />
                {!selectedProject.projectUrl && (
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginTop: 12 }}
                    message="当前项目未登记网址"
                    description="为避免任意 URL 覆盖和 SSRF 风险，本页面不提供临时扫描地址输入框。"
                  />
                )}
                {sourceScanError && (
                  <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setSourceScanError('')}
                    style={{ marginTop: 12 }}
                    message="授权源码扫描未完成"
                    description={sourceScanError}
                  />
                )}
                <Card
                  size="small"
                  title={`授权源码扫描历史 (${sourceScanHistory.length})`}
                  style={{ marginTop: 12 }}
                  extra={
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={sourceScanHistoryLoading}
                      onClick={() => void loadProjectSourceScanHistory(selectedProject.projectId)}
                    >
                      刷新历史
                    </Button>
                  }
                >
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="源码快照不进入最终评分，也不构成生产验收"
                    description={
                      sourceScanHistoryScope?.note ||
                      '历史只保存脱敏摘要、静态信号、限制和快照哈希；完整源码与绝对路径不会持久化。'
                    }
                  />
                  {sourceScanHistoryError && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="授权源码扫描历史加载失败"
                      description={sourceScanHistoryError}
                    />
                  )}
                  <Spin spinning={sourceScanHistoryLoading}>
                    <Table<ProjectGradeSourceScanRun>
                      rowKey="scanId"
                      dataSource={sourceScanHistory}
                      columns={sourceScanHistoryColumns}
                      size="small"
                      pagination={{ pageSize: 5, hideOnSinglePage: true }}
                      scroll={{ x: 980 }}
                      locale={{ emptyText: '当前项目尚无授权源码扫描历史' }}
                    />
                  </Spin>
                </Card>
                {sourceScanResult && (
                  <Card size="small" title="本次授权源码扫描结果" style={{ marginTop: 12 }}>
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="该结果不进入 ProjectGrade 最终评分"
                      description={
                        sourceScanScope?.note || '仅覆盖服务端授权的本地源码快照，不构成生产验收。'
                      }
                    />
                    <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                      <Descriptions.Item label="授权根">
                        <Text code>{sourceScanResult.rootKey}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="扫描版本">
                        {sourceScanResult.scanVersion}
                      </Descriptions.Item>
                      <Descriptions.Item label="文件数">
                        {sourceScanResult.summary.filesScanned}
                      </Descriptions.Item>
                      <Descriptions.Item label="总字节">
                        {sourceScanResult.summary.totalBytes}
                      </Descriptions.Item>
                      <Descriptions.Item label="静态发现">
                        {sourceScanResult.summary.findings}
                      </Descriptions.Item>
                      <Descriptions.Item label="Express 路由">
                        {sourceScanResult.summary.routes}
                      </Descriptions.Item>
                      <Descriptions.Item label="生产验收">
                        <Tag color="default">false</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="外部扫描">
                        <Tag color="default">false</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="快照哈希" span={4}>
                        <Text copyable code>
                          {sourceScanResult.snapshotHash}
                        </Text>
                      </Descriptions.Item>
                    </Descriptions>
                    <Space wrap style={{ marginTop: 12 }}>
                      <Tag color={sourceScanResult.projectSignals.hasTests ? 'success' : 'default'}>
                        tests
                      </Tag>
                      <Tag
                        color={sourceScanResult.projectSignals.hasDocker ? 'success' : 'default'}
                      >
                        docker
                      </Tag>
                      <Tag color={sourceScanResult.projectSignals.hasCi ? 'success' : 'default'}>
                        ci
                      </Tag>
                      <Tag
                        color={sourceScanResult.projectSignals.hasLicense ? 'success' : 'default'}
                      >
                        license
                      </Tag>
                      <Tag
                        color={
                          sourceScanResult.projectSignals.hasPackageManifest ? 'success' : 'default'
                        }
                      >
                        package manifest
                      </Tag>
                    </Space>
                    <Table<ProjectGradeSourceFinding>
                      rowKey="fingerprint"
                      dataSource={sourceScanResult.findings}
                      size="small"
                      style={{ marginTop: 12 }}
                      pagination={{ pageSize: 5, hideOnSinglePage: true }}
                      columns={[
                        {
                          title: '级别',
                          dataIndex: 'severity',
                          key: 'severity',
                          width: 100,
                          render: (value: ProjectGradeSourceFinding['severity']) => (
                            <Tag
                              color={
                                value === 'high'
                                  ? 'error'
                                  : value === 'warning'
                                    ? 'warning'
                                    : 'blue'
                              }
                            >
                              {value}
                            </Tag>
                          ),
                        },
                        { title: '规则', dataIndex: 'ruleKey', key: 'ruleKey', width: 180 },
                        {
                          title: '安全相对路径',
                          key: 'location',
                          width: 260,
                          render: (_: unknown, finding: ProjectGradeSourceFinding) => (
                            <Text code>
                              {finding.filePath}:{finding.line}
                            </Text>
                          ),
                        },
                        { title: '说明', dataIndex: 'message', key: 'message' },
                      ]}
                      locale={{ emptyText: '本次快照未产生静态发现' }}
                    />
                  </Card>
                )}
                <Card
                  size="small"
                  title="源码证据草稿预览（Draft Preview）"
                  style={{ marginTop: 12 }}
                  extra={
                    <Button
                      type="primary"
                      size="small"
                      loading={sourceEvidenceAdopting}
                      disabled={
                        !sourceEvidenceDraft ||
                        selectedProject.status !== 'active' ||
                        sourceEvidenceDraftLoading ||
                        Boolean(sourceEvidenceEvaluatingAdoptionId)
                      }
                      onClick={confirmSourceEvidenceAdoption}
                    >
                      管理员采纳
                    </Button>
                  }
                >
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Draft Preview 固定不计分"
                    description={
                      sourceEvidenceDraftScopeNote ||
                      '请从成功的 SourceScan 历史记录生成草稿预览。草稿只映射可重建的静态事实，不保存完整源码，也不会修改 EvaluationRun。'
                    }
                  />
                  {sourceEvidenceDraftError && (
                    <Alert
                      type="error"
                      showIcon
                      closable
                      onClose={() => setSourceEvidenceDraftError('')}
                      style={{ marginBottom: 12 }}
                      message="源码证据草稿加载失败"
                      description={sourceEvidenceDraftError}
                    />
                  )}
                  <Spin spinning={sourceEvidenceDraftLoading}>
                    {sourceEvidenceDraft ? (
                      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                        <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 4 }}>
                          <Descriptions.Item label="SourceScan ID">
                            <Text code>{sourceEvidenceDraft.sourceScanId}</Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="扫描版本">
                            {sourceEvidenceDraft.sourceScanVersion}
                          </Descriptions.Item>
                          <Descriptions.Item label="投影版本">
                            {sourceEvidenceDraft.projectionVersion}
                          </Descriptions.Item>
                          <Descriptions.Item label="草稿数量">
                            {sourceEvidenceDraft.drafts.length}
                          </Descriptions.Item>
                          <Descriptions.Item label="快照哈希" span={4}>
                            <Text copyable code>
                              {sourceEvidenceDraft.snapshotHash}
                            </Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="Draft Set Hash" span={4}>
                            <Text copyable code>
                              {sourceEvidenceDraft.draftSetHash}
                            </Text>
                          </Descriptions.Item>
                          <Descriptions.Item label="计分状态">
                            <Tag color="default">{sourceEvidenceDraft.scoringDisposition}</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="生产验收">
                            <Tag color="default">false</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="外部扫描">
                            <Tag color="default">false</Tag>
                          </Descriptions.Item>
                          <Descriptions.Item label="源码正文持久化">
                            <Tag color="default">false</Tag>
                          </Descriptions.Item>
                        </Descriptions>
                        <div>
                          <Text strong>维度分布：</Text>{' '}
                          <Space wrap>
                            {summarizeSourceEvidenceDimensions(sourceEvidenceDraft.drafts).map(
                              ([dimensionKey, count]) => (
                                <Tag key={dimensionKey} color="blue">
                                  {dimensionKey}: {count}
                                </Tag>
                              )
                            )}
                          </Space>
                        </div>
                        <Table<ProjectGradeSourceEvidenceDraft>
                          rowKey="evidenceId"
                          dataSource={sourceEvidenceDraft.drafts}
                          columns={sourceEvidenceDraftColumns}
                          size="small"
                          pagination={{ pageSize: 8, hideOnSinglePage: true }}
                          scroll={{ x: 1050 }}
                          locale={{ emptyText: '当前投影没有证据草稿' }}
                        />
                      </Space>
                    ) : (
                      <Empty
                        description="请在成功的授权源码扫描记录中点击“预览证据草稿”"
                        image={Empty.PRESENTED_IMAGE_SIMPLE}
                      />
                    )}
                  </Spin>
                </Card>

                <Card
                  size="small"
                  title={`证据采纳清单（Adoption Manifest，${sourceEvidenceAdoptions.length}）`}
                  style={{ marginTop: 12 }}
                  extra={
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={sourceEvidenceAdoptionsLoading}
                      onClick={() =>
                        void loadProjectSourceEvidenceAdoptions(selectedProject.projectId)
                      }
                    >
                      刷新清单
                    </Button>
                  }
                >
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="Adoption 只固定不可变证据清单，不会自行计分"
                    description={
                      sourceEvidenceAdoptionsScopeNote ||
                      '只有显式创建一个新的来源证据 EvaluationRun，才会基于同一不可变 Manifest 整体重算 Evidence、Finding、Snapshot、Score 与 ReleaseGate。'
                    }
                  />
                  {sourceEvidenceAdoptionsAccessDenied && (
                    <Alert
                      type="info"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="当前账号没有管理员读取权限"
                      description="SourceScan 历史可按项目查看，但 Draft、Adoption 与来源证据评估命令仅允许项目 owner/admin。"
                    />
                  )}
                  {sourceEvidenceAdoptionsError && (
                    <Alert
                      type="error"
                      showIcon
                      closable
                      onClose={() => setSourceEvidenceAdoptionsError('')}
                      style={{ marginBottom: 12 }}
                      message="采纳清单加载失败"
                      description={sourceEvidenceAdoptionsError}
                    />
                  )}
                  {sourceEvidenceOperationError && (
                    <Alert
                      type="error"
                      showIcon
                      closable
                      onClose={() => setSourceEvidenceOperationError('')}
                      style={{ marginBottom: 12 }}
                      message="来源证据操作未完成"
                      description={sourceEvidenceOperationError}
                    />
                  )}
                  {sourceEvidenceOperationNotice && (
                    <Alert
                      type="info"
                      showIcon
                      closable
                      onClose={() => setSourceEvidenceOperationNotice('')}
                      style={{ marginBottom: 12 }}
                      message="来源证据操作状态"
                      description={sourceEvidenceOperationNotice}
                    />
                  )}
                  {sourceEvidenceLastEvaluation && (
                    <Descriptions
                      bordered
                      size="small"
                      column={{ xs: 1, sm: 2, lg: 4 }}
                      style={{ marginBottom: 12 }}
                    >
                      <Descriptions.Item label="最近运行">
                        <Text code>{sourceEvidenceLastEvaluation.runId}</Text>
                      </Descriptions.Item>
                      <Descriptions.Item label="投影状态">
                        <Tag
                          color={
                            sourceEvidenceLastEvaluation.projectionStatus === 'ready'
                              ? 'success'
                              : sourceEvidenceLastEvaluation.projectionStatus === 'failed'
                                ? 'error'
                                : 'processing'
                          }
                        >
                          {sourceEvidenceLastEvaluation.projectionStatus}
                        </Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="输入类型">
                        {sourceEvidenceLastEvaluation.evaluationInputKind}
                      </Descriptions.Item>
                      <Descriptions.Item label="生产验证">
                        <Tag color="default">false</Tag>
                      </Descriptions.Item>
                    </Descriptions>
                  )}
                  <Spin spinning={sourceEvidenceAdoptionsLoading}>
                    <Table<ProjectGradeSourceEvidenceAdoption>
                      rowKey="adoptionId"
                      dataSource={sourceEvidenceAdoptions}
                      columns={sourceEvidenceAdoptionColumns}
                      size="small"
                      pagination={{ pageSize: 8, hideOnSinglePage: true }}
                      scroll={{ x: 1350 }}
                      locale={{
                        emptyText: sourceEvidenceAdoptionsAccessDenied
                          ? '无权读取采纳清单'
                          : '尚未创建源码证据采纳清单',
                      }}
                    />
                  </Spin>
                </Card>

                <Alert
                  type="warning"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="SourceScan → Draft → Adoption → Evaluation 固定边界"
                  description={
                    <ol style={{ margin: 0, paddingLeft: 20 }}>
                      <li>Draft Preview 不计分。</li>
                      <li>Adoption Manifest 只固定不可变证据清单。</li>
                      <li>只有新的 EvaluationRun 才会整体重算评分与发布门禁。</li>
                      <li>源码静态证据不构成生产验证。</li>
                      <li>externalScanningEnabled 固定为 false。</li>
                      <li>productionAcceptance 固定为 false。</li>
                    </ol>
                  }
                />

                {urlScanError && (
                  <Alert
                    type="warning"
                    showIcon
                    closable
                    onClose={() => setUrlScanError('')}
                    style={{ marginTop: 12 }}
                    message="网址快速体检未执行"
                    description={urlScanError}
                  />
                )}
                <Card
                  size="small"
                  title={`网址快速体检历史 (${urlScanHistory.length})`}
                  style={{ marginTop: 12 }}
                  extra={
                    <Button
                      size="small"
                      icon={<ReloadOutlined />}
                      loading={urlScanHistoryLoading}
                      onClick={() => void loadProjectUrlScanHistory(selectedProject.projectId)}
                    >
                      刷新历史
                    </Button>
                  }
                >
                  <Alert
                    type="warning"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message="历史快照不进入最终评分，也不构成生产验收"
                    description={
                      urlScanHistoryScope?.note ||
                      '历史记录仅代表单次服务端 HTTP/静态 HTML 观察，生产验收始终为 false。'
                    }
                  />
                  {urlScanHistoryError && (
                    <Alert
                      type="error"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="网址快速体检历史加载失败"
                      description={urlScanHistoryError}
                    />
                  )}
                  <Spin spinning={urlScanHistoryLoading}>
                    <Table<ProjectGradeUrlScanRun>
                      rowKey="scanId"
                      dataSource={urlScanHistory}
                      columns={urlScanHistoryColumns}
                      size="small"
                      pagination={{ pageSize: 5, hideOnSinglePage: true }}
                      scroll={{ x: 980 }}
                      locale={{ emptyText: '当前项目尚无网址快速体检历史' }}
                    />
                  </Spin>
                </Card>
                {urlScanResult && (
                  <Card size="small" title="本次网址快速体检结果" style={{ marginTop: 12 }}>
                    <Alert
                      type="warning"
                      showIcon
                      style={{ marginBottom: 12 }}
                      message="该结果不进入 ProjectGrade 最终评分"
                      description={urlScanResult.note}
                    />
                    <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                      <Descriptions.Item label="请求地址">
                        {urlScanResult.requestedUrl}
                      </Descriptions.Item>
                      <Descriptions.Item label="最终地址">
                        {urlScanResult.finalUrl}
                      </Descriptions.Item>
                      <Descriptions.Item label="HTTP 状态">
                        {urlScanResult.statusCode}
                      </Descriptions.Item>
                      <Descriptions.Item label="耗时">
                        {urlScanResult.durationMs} ms
                      </Descriptions.Item>
                      <Descriptions.Item label="响应大小">
                        {urlScanResult.responseBytes} 字节
                      </Descriptions.Item>
                      <Descriptions.Item label="证据范围">
                        {urlScanScope?.evidenceScope || urlScanResult.evidenceScope}
                      </Descriptions.Item>
                      <Descriptions.Item label="生产验收">
                        <Tag color="default">false</Tag>
                      </Descriptions.Item>
                      <Descriptions.Item label="登记 URL 限制">
                        <Tag color={urlScanScope?.registeredProjectUrlOnly ? 'success' : 'warning'}>
                          {urlScanScope?.registeredProjectUrlOnly ? '已强制' : '未确认'}
                        </Tag>
                      </Descriptions.Item>
                    </Descriptions>
                    <Card
                      size="small"
                      title="静态 HTML 信号（非完整 SEO / WCAG 验收）"
                      style={{ marginTop: 12 }}
                    >
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginBottom: 12 }}
                        message="仅检查本次响应中的静态标记"
                        description="不执行 JavaScript，不读取计算样式或动态可访问名称，也不替代搜索引擎抓取、真实浏览器、Lighthouse 或完整 WCAG 审计。"
                      />
                      <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
                        <Descriptions.Item label="字符集">
                          {urlScanResult.staticSignals.charset || '未声明'}
                        </Descriptions.Item>
                        <Descriptions.Item label="robots">
                          {urlScanResult.staticSignals.robots || '未声明'}
                        </Descriptions.Item>
                        <Descriptions.Item label="noindex">
                          <Tag color={urlScanResult.staticSignals.noindex ? 'warning' : 'success'}>
                            {urlScanResult.staticSignals.noindex ? '检测到' : '未检测到'}
                          </Tag>
                        </Descriptions.Item>
                        <Descriptions.Item label="OG 标题">
                          {urlScanResult.staticSignals.openGraphTitle || '未检测到'}
                        </Descriptions.Item>
                        <Descriptions.Item label="OG 描述" span={2}>
                          {urlScanResult.staticSignals.openGraphDescription || '未检测到'}
                        </Descriptions.Item>
                        <Descriptions.Item label="图片 alt">
                          缺少 {urlScanResult.staticSignals.images.missingAlt} /{' '}
                          {urlScanResult.staticSignals.images.total}
                        </Descriptions.Item>
                        <Descriptions.Item label="按钮名称">
                          缺少 {urlScanResult.staticSignals.buttons.missingAccessibleName} /{' '}
                          {urlScanResult.staticSignals.buttons.total}
                        </Descriptions.Item>
                        <Descriptions.Item label="表单控件名称">
                          缺少 {urlScanResult.staticSignals.formControls.missingAccessibleName} /{' '}
                          {urlScanResult.staticSignals.formControls.total}
                        </Descriptions.Item>
                      </Descriptions>
                    </Card>
                    <Table<ProjectGradeUrlCheck>
                      rowKey="key"
                      dataSource={urlScanResult.checks}
                      size="small"
                      pagination={false}
                      style={{ marginTop: 12 }}
                      columns={[
                        { title: '检查项', dataIndex: 'title', key: 'title', width: 180 },
                        {
                          title: '状态',
                          dataIndex: 'status',
                          key: 'status',
                          width: 100,
                          render: (value: ProjectGradeUrlCheck['status']) => (
                            <Tag
                              color={
                                value === 'pass'
                                  ? 'success'
                                  : value === 'warning'
                                    ? 'warning'
                                    : 'error'
                              }
                            >
                              {value === 'pass' ? '通过' : value === 'warning' ? '提示' : '失败'}
                            </Tag>
                          ),
                        },
                        { title: '观察结果', dataIndex: 'detail', key: 'detail' },
                      ]}
                    />
                  </Card>
                )}
                <Tabs
                  style={{ marginTop: 12 }}
                  items={[
                    {
                      key: 'history',
                      label: `评估历史 (${projectRuns.length})`,
                      children: (
                        <Spin spinning={historyLoading}>
                          <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="投影重建仅修复持久化投影"
                            description="重建投影不创建新评估，不扫描外部目标，也不构成生产验收；服务端管理员权限与审计记录是最终权威。"
                          />
                          <Table
                            rowKey="runId"
                            dataSource={projectRuns}
                            columns={historyColumns}
                            size="small"
                            pagination={{ pageSize: 5, hideOnSinglePage: true }}
                            scroll={{ x: 700 }}
                            locale={{ emptyText: '此项目尚无持久化评估记录' }}
                          />
                        </Spin>
                      ),
                    },
                    {
                      key: 'reports',
                      label: `正式报告 (${projectReports.length})`,
                      children: (
                        <Spin spinning={projectReportsLoading}>
                          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                            <Alert
                              type="info"
                              showIcon
                              message="正式报告内容不可变，公开生命周期可管理"
                              description="报告只采用服务端持久化评分、维度与 Finding；撤销或过期后可复用原公开编号重新发布。此处结果不构成生产环境验收。"
                            />
                            {projectReportsError && (
                              <Alert
                                type="error"
                                showIcon
                                message="正式报告操作失败"
                                description={projectReportsError}
                                closable
                                onClose={() => setProjectReportsError('')}
                              />
                            )}
                            <div>
                              <Button
                                icon={<ReloadOutlined />}
                                loading={projectReportsLoading}
                                onClick={() =>
                                  selectedProject &&
                                  void loadProjectReports(selectedProject.projectId)
                                }
                              >
                                刷新正式报告
                              </Button>
                            </div>
                            <Table
                              rowKey="reportId"
                              dataSource={projectReports}
                              columns={reportColumns}
                              size="small"
                              pagination={{ pageSize: 8, hideOnSinglePage: true }}
                              scroll={{ x: 1190 }}
                              locale={{ emptyText: '尚未发布正式报告' }}
                            />
                          </Space>
                        </Spin>
                      ),
                    },
                    {
                      key: 'findings',
                      label: `Finding (${persistedFindings.length})`,
                      children: (
                        <Spin spinning={workflowLoading}>
                          <Alert
                            type="warning"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="工作流操作受服务端 RBAC 和审计约束"
                            description="更新 Finding 必须提供说明，且仅管理员可执行；创建整改任务不等于整改已验证。"
                          />
                          <Table
                            rowKey="findingId"
                            dataSource={persistedFindings}
                            columns={persistedFindingColumns}
                            size="small"
                            pagination={{ pageSize: 6, hideOnSinglePage: true }}
                            scroll={{ x: 980 }}
                            locale={{ emptyText: '尚无持久化 Finding' }}
                          />
                        </Spin>
                      ),
                    },
                    {
                      key: 'remediations',
                      label: `整改任务 (${remediationTasks.length})`,
                      children: (
                        <Spin spinning={workflowLoading}>
                          <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="任务完成不等于整改已验证"
                            description="verified 仅在独立且更晚的复测投影就绪，并确认相同 Finding 指纹已消失时由服务端允许。"
                          />
                          <Table
                            rowKey="taskId"
                            dataSource={remediationTasks}
                            columns={remediationColumns}
                            size="small"
                            pagination={{ pageSize: 6, hideOnSinglePage: true }}
                            scroll={{ x: 900 }}
                            locale={{ emptyText: '尚无整改任务' }}
                          />
                        </Spin>
                      ),
                    },
                    {
                      key: 'evidence',
                      label: `证据 (${persistedEvidence.length})`,
                      children: (
                        <Spin spinning={workflowLoading}>
                          <Table
                            rowKey="evidenceId"
                            dataSource={persistedEvidence}
                            columns={persistedEvidenceColumns}
                            size="small"
                            pagination={{ pageSize: 8, hideOnSinglePage: true }}
                            scroll={{ x: 820 }}
                            locale={{ emptyText: '尚无持久化证据投影' }}
                          />
                        </Spin>
                      ),
                    },
                    {
                      key: 'audit',
                      label: '管理员审计',
                      children: (
                        <Spin spinning={auditLoading}>
                          <Alert
                            type="info"
                            showIcon
                            style={{ marginBottom: 12 }}
                            message="按需加载的管理员审计记录"
                            description="审计记录只在主动请求时加载；服务端仍是权限判断与审计数据范围的唯一权威。"
                            action={
                              <Button
                                size="small"
                                loading={auditLoading}
                                onClick={() => void loadProjectAudit(selectedProject.projectId)}
                              >
                                加载审计
                              </Button>
                            }
                          />
                          {auditAccessDenied ? (
                            <Alert
                              type="warning"
                              showIcon
                              message="当前账户没有审计查看权限"
                              description="未返回或展示任何审计数据。"
                            />
                          ) : auditError ? (
                            <Alert
                              type="error"
                              showIcon
                              message="审计记录加载失败"
                              description={auditError}
                            />
                          ) : auditLoadedProjectId === selectedProject.projectId ? (
                            <Table
                              rowKey="auditId"
                              dataSource={auditLogs}
                              columns={auditColumns}
                              size="small"
                              pagination={{ pageSize: 8, hideOnSinglePage: true }}
                              scroll={{ x: 900 }}
                              locale={{ emptyText: '暂无审计记录' }}
                            />
                          ) : (
                            <Empty
                              description="审计记录尚未加载"
                              image={Empty.PRESENTED_IMAGE_SIMPLE}
                            />
                          )}
                        </Spin>
                      ),
                    },
                  ]}
                />
              </Card>
            )}
          </>
        )}
      </Card>

      <Modal
        title="授权源码扫描历史快照"
        open={Boolean(selectedSourceScanSnapshot)}
        onCancel={() => setSelectedSourceScanSnapshot(null)}
        footer={null}
        width={1040}
      >
        {selectedSourceScanSnapshot?.result ? (
          <Space direction="vertical" size={16} style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="仅展示脱敏静态证据，不是评分或生产验收"
              description="完整源码、绝对路径、环境变量值和密钥不会在此展示或持久化；productionAcceptance、externalScanningEnabled 均为 false。"
            />
            <Descriptions size="small" column={{ xs: 1, sm: 2, lg: 4 }} bordered>
              <Descriptions.Item label="扫描时间">
                {formatDate(selectedSourceScanSnapshot.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="授权根">
                <Text code>{selectedSourceScanSnapshot.result.rootKey}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="扫描版本">
                {selectedSourceScanSnapshot.result.scanVersion}
              </Descriptions.Item>
              <Descriptions.Item label="文件数">
                {selectedSourceScanSnapshot.result.summary.filesScanned}
              </Descriptions.Item>
              <Descriptions.Item label="总字节">
                {selectedSourceScanSnapshot.result.summary.totalBytes}
              </Descriptions.Item>
              <Descriptions.Item label="发现数">
                {selectedSourceScanSnapshot.result.summary.findings}
              </Descriptions.Item>
              <Descriptions.Item label="路由数">
                {selectedSourceScanSnapshot.result.summary.routes}
              </Descriptions.Item>
              <Descriptions.Item label="生产验收">
                <Tag color="default">false</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="快照哈希" span={4}>
                <Text copyable code>
                  {selectedSourceScanSnapshot.result.snapshotHash}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="跳过目录">
                {selectedSourceScanSnapshot.result.skipped.ignoredDirectories}
              </Descriptions.Item>
              <Descriptions.Item label="不支持扩展名">
                {selectedSourceScanSnapshot.result.skipped.unsupportedExtensions}
              </Descriptions.Item>
              <Descriptions.Item label="二进制文件">
                {selectedSourceScanSnapshot.result.skipped.binaryFiles}
              </Descriptions.Item>
              <Descriptions.Item label="符号链接">
                {selectedSourceScanSnapshot.result.skipped.symbolicLinks}
              </Descriptions.Item>
            </Descriptions>
            <Table<ProjectGradeSourceFinding>
              rowKey="fingerprint"
              dataSource={selectedSourceScanSnapshot.result.findings}
              size="small"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              columns={[
                { title: '级别', dataIndex: 'severity', key: 'severity', width: 100 },
                { title: '规则', dataIndex: 'ruleKey', key: 'ruleKey', width: 180 },
                {
                  title: '安全相对路径',
                  key: 'location',
                  width: 280,
                  render: (_: unknown, finding: ProjectGradeSourceFinding) => (
                    <Text code>
                      {finding.filePath}:{finding.line}
                    </Text>
                  ),
                },
                { title: '说明', dataIndex: 'message', key: 'message' },
              ]}
              locale={{ emptyText: '该快照没有静态发现' }}
            />
            <Table<ProjectGradeSourceRoute>
              rowKey={(route) =>
                `${route.method}:${route.routePath}:${route.filePath}:${route.line}`
              }
              dataSource={selectedSourceScanSnapshot.result.routes}
              size="small"
              pagination={{ pageSize: 8, hideOnSinglePage: true }}
              columns={[
                { title: '方法', dataIndex: 'method', key: 'method', width: 100 },
                { title: '路由', dataIndex: 'routePath', key: 'routePath' },
                {
                  title: '安全相对路径',
                  key: 'location',
                  width: 320,
                  render: (_: unknown, route: ProjectGradeSourceRoute) => (
                    <Text code>
                      {route.filePath}:{route.line}
                    </Text>
                  ),
                },
              ]}
              locale={{ emptyText: '该快照没有识别到 Express 路由' }}
            />
          </Space>
        ) : (
          <Alert type="info" showIcon message="该历史记录没有可展示的成功快照" />
        )}
      </Modal>

      <Modal
        title="网址快速体检历史快照"
        open={Boolean(selectedUrlScanSnapshot)}
        footer={null}
        width={920}
        onCancel={() => setSelectedUrlScanSnapshot(null)}
      >
        {selectedUrlScanSnapshot?.result ? (
          <Space direction="vertical" size="middle" style={{ width: '100%' }}>
            <Alert
              type="warning"
              showIcon
              message="该快照仅为单次服务端 HTTP/静态 HTML 观察"
              description="快照中的 URL 已移除凭据、查询参数和片段；结果不进入最终评分，productionAcceptance 固定为 false。"
            />
            <Descriptions bordered size="small" column={{ xs: 1, sm: 2, lg: 3 }}>
              <Descriptions.Item label="请求地址">
                {selectedUrlScanSnapshot.result.requestedUrl}
              </Descriptions.Item>
              <Descriptions.Item label="最终地址">
                {selectedUrlScanSnapshot.result.finalUrl}
              </Descriptions.Item>
              <Descriptions.Item label="HTTP 状态">
                {selectedUrlScanSnapshot.result.statusCode}
              </Descriptions.Item>
              <Descriptions.Item label="扫描版本">
                {selectedUrlScanSnapshot.result.scanVersion}
              </Descriptions.Item>
              <Descriptions.Item label="耗时">
                {selectedUrlScanSnapshot.result.durationMs} ms
              </Descriptions.Item>
              <Descriptions.Item label="生产验收">
                <Tag color="default">false</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="字符集">
                {selectedUrlScanSnapshot.result.staticSignals.charset || '未声明'}
              </Descriptions.Item>
              <Descriptions.Item label="robots">
                {selectedUrlScanSnapshot.result.staticSignals.robots || '未声明'}
              </Descriptions.Item>
              <Descriptions.Item label="noindex">
                {selectedUrlScanSnapshot.result.staticSignals.noindex ? '检测到' : '未检测到'}
              </Descriptions.Item>
              <Descriptions.Item label="图片 alt">
                缺少 {selectedUrlScanSnapshot.result.staticSignals.images.missingAlt} /{' '}
                {selectedUrlScanSnapshot.result.staticSignals.images.total}
              </Descriptions.Item>
              <Descriptions.Item label="按钮名称">
                缺少 {selectedUrlScanSnapshot.result.staticSignals.buttons.missingAccessibleName} /{' '}
                {selectedUrlScanSnapshot.result.staticSignals.buttons.total}
              </Descriptions.Item>
              <Descriptions.Item label="表单控件名称">
                缺少{' '}
                {selectedUrlScanSnapshot.result.staticSignals.formControls.missingAccessibleName} /{' '}
                {selectedUrlScanSnapshot.result.staticSignals.formControls.total}
              </Descriptions.Item>
              <Descriptions.Item label="已检测安全响应头" span={3}>
                {selectedUrlScanSnapshot.result.securityHeaders.present.length
                  ? selectedUrlScanSnapshot.result.securityHeaders.present.join('、')
                  : '未检测到'}
              </Descriptions.Item>
              <Descriptions.Item label="缺失安全响应头" span={3}>
                {selectedUrlScanSnapshot.result.securityHeaders.missing.length
                  ? selectedUrlScanSnapshot.result.securityHeaders.missing.join('、')
                  : '无'}
              </Descriptions.Item>
            </Descriptions>
            <Table<ProjectGradeUrlCheck>
              rowKey="key"
              dataSource={selectedUrlScanSnapshot.result.checks}
              size="small"
              pagination={false}
              columns={[
                { title: '检查项', dataIndex: 'title', key: 'title', width: 180 },
                {
                  title: '状态',
                  dataIndex: 'status',
                  key: 'status',
                  width: 100,
                  render: (value: ProjectGradeUrlCheck['status']) => (
                    <Tag
                      color={
                        value === 'pass' ? 'success' : value === 'warning' ? 'warning' : 'error'
                      }
                    >
                      {value === 'pass' ? '通过' : value === 'warning' ? '提示' : '失败'}
                    </Tag>
                  ),
                },
                { title: '观察结果', dataIndex: 'detail', key: 'detail' },
              ]}
            />
          </Space>
        ) : (
          <Alert type="info" showIcon message="该历史记录没有可展示的成功快照" />
        )}
      </Modal>

      <Drawer
        title={
          reportDeliveryTarget ? `PDF 交付记录：${reportDeliveryTarget.title}` : 'PDF 交付记录'
        }
        width={980}
        open={Boolean(reportDeliveryTarget)}
        destroyOnClose
        onClose={() => {
          reportDeliveryRequestSequenceRef.current += 1;
          setReportDeliveryTarget(null);
          setReportDeliveries([]);
          setReportDeliveriesError('');
          setReportDeliveriesLoading(false);
        }}
        extra={
          reportDeliveryTarget && selectedProject ? (
            <Space>
              <Button
                icon={<ReloadOutlined />}
                loading={reportDeliveriesLoading}
                onClick={() =>
                  void loadProjectReportDeliveries(selectedProject.projectId, reportDeliveryTarget)
                }
              >
                刷新
              </Button>
              <Button
                type="primary"
                icon={<FilePdfOutlined />}
                loading={reportDownloadLoading === reportDeliveryTarget.publicId}
                disabled={
                  reportLifecycleStatus(reportDeliveryTarget) !== 'public' ||
                  !reportDeliveryTarget.contentFingerprint ||
                  !entitlements?.capabilities.reportDownloadEnabled ||
                  !quotaAvailable('project_grade_report_download')
                }
                onClick={() => void downloadFormalReport(reportDeliveryTarget)}
              >
                再次下载 PDF
              </Button>
            </Space>
          ) : null
        }
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="info"
            showIcon
            message="交付记录是长期保留的商业与审计凭证"
            description="每次成功生成 PDF 都会保存套餐、品牌类型、内容指纹和 PDF 文档指纹。交付记录仅项目管理员可查看，服务端授权是最终权威。"
          />
          {reportDeliveryTarget && (
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="公开编号">
                <Text copyable code>
                  {reportDeliveryTarget.publicId}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="报告状态">
                <Tag
                  color={
                    reportLifecycleStatus(reportDeliveryTarget) === 'public'
                      ? 'success'
                      : reportLifecycleStatus(reportDeliveryTarget) === 'expired'
                        ? 'warning'
                        : 'default'
                  }
                >
                  {reportLifecycleStatus(reportDeliveryTarget) === 'public'
                    ? '公开'
                    : reportLifecycleStatus(reportDeliveryTarget) === 'expired'
                      ? '已过期'
                      : '已撤销'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="内容指纹" span={2}>
                {reportDeliveryTarget.contentFingerprint ? (
                  <Text
                    copyable
                    code
                    ellipsis={{ tooltip: reportDeliveryTarget.contentFingerprint }}
                  >
                    {reportDeliveryTarget.contentFingerprint}
                  </Text>
                ) : (
                  <Text type="danger">缺少内容指纹，不能正式交付</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          )}
          {reportDeliveriesError && (
            <Alert
              type="error"
              showIcon
              message="无法读取交付记录"
              description={reportDeliveriesError}
            />
          )}
          <Table<ProjectGradeReportDelivery>
            rowKey="deliveryId"
            loading={reportDeliveriesLoading}
            dataSource={reportDeliveries}
            columns={reportDeliveryColumns}
            size="small"
            pagination={{ pageSize: 10, hideOnSinglePage: true }}
            scroll={{ x: 1260 }}
            locale={{ emptyText: reportDeliveriesLoading ? '正在加载' : '尚无 PDF 交付记录' }}
          />
        </Space>
      </Drawer>

      <Modal
        title={
          reportRevocationTarget ? `撤销正式报告：${reportRevocationTarget.title}` : '撤销正式报告'
        }
        open={Boolean(reportRevocationTarget)}
        confirmLoading={reportOperationLoading === `revoke:${reportRevocationTarget?.publicId}`}
        okText="确认撤销"
        okButtonProps={{ danger: true, disabled: !reportRevocationReason.trim() }}
        cancelText="取消"
        onCancel={() => {
          setReportRevocationTarget(null);
          setReportRevocationReason('');
          setProjectReportsError('');
        }}
        onOk={() => void submitReportRevocation()}
      >
        <Space direction="vertical" size="middle" style={{ width: '100%' }}>
          <Alert
            type="warning"
            showIcon
            message="撤销会立即关闭公开访问"
            description="撤销不会删除不可变报告内容、内容指纹或审计记录；撤销后仍可从对应评估运行重新发布。"
          />
          {reportRevocationTarget && (
            <Descriptions bordered size="small" column={1}>
              <Descriptions.Item label="公开编号">
                <Text copyable code>
                  {reportRevocationTarget.publicId}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="报告标题">{reportRevocationTarget.title}</Descriptions.Item>
            </Descriptions>
          )}
          {projectReportsError && <Alert type="error" showIcon message={projectReportsError} />}
          <div>
            <Text strong>撤销原因</Text>
            <Input.TextArea
              style={{ marginTop: 8 }}
              rows={4}
              value={reportRevocationReason}
              onChange={(event) => setReportRevocationReason(event.target.value)}
              maxLength={1000}
              showCount
              placeholder="请填写撤销原因，原因会写入审计记录"
            />
          </div>
        </Space>
      </Modal>

      <Modal
        title={
          findingWorkflowTarget
            ? `更新 Finding：${findingWorkflowTarget.title}`
            : '更新 Finding 工作流'
        }
        open={Boolean(findingWorkflowTarget)}
        confirmLoading={workflowLoading}
        okText="提交受审计变更"
        cancelText="取消"
        onCancel={() => {
          setFindingWorkflowTarget(null);
          findingWorkflowForm.resetFields();
        }}
        onOk={() => void findingWorkflowForm.submit()}
      >
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
          message="仅管理员可成功提交"
          description="服务端会重新执行权限检查并写入审计记录；前端不假设当前用户拥有管理员权限。"
        />
        <Form<FindingWorkflowValues>
          form={findingWorkflowForm}
          layout="vertical"
          onFinish={submitFindingWorkflow}
        >
          <Form.Item label="目标状态" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                'open',
                'in_progress',
                'ready_for_retest',
                'verified',
                'accepted_risk',
                'false_positive',
              ].map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item
            label="变更说明"
            name="note"
            rules={[
              { required: true, whitespace: true, message: '必须填写变更说明' },
              { max: 2000, message: '说明不能超过 2000 字' },
            ]}
          >
            <Input.TextArea
              rows={4}
              maxLength={2000}
              placeholder="说明风险接受、误报判断或复测依据"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={remediationTarget ? `更新整改任务：${remediationTarget.title}` : '更新整改任务'}
        open={Boolean(remediationTarget)}
        confirmLoading={workflowLoading}
        okText="保存任务"
        cancelText="取消"
        onCancel={() => {
          setRemediationTarget(null);
          remediationForm.resetFields();
        }}
        onOk={() => void remediationForm.submit()}
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="完成任务不等于整改已验证"
          description="若选择 verified，服务端会严格检查独立的更晚复测及 Finding 指纹消失条件。"
        />
        <Form<RemediationUpdateValues>
          form={remediationForm}
          layout="vertical"
          onFinish={submitRemediation}
        >
          <Form.Item label="任务状态" name="status" rules={[{ required: true }]}>
            <Select
              options={[
                'open',
                'in_progress',
                'blocked',
                'ready_for_retest',
                'verified',
                'cancelled',
              ].map((value) => ({ value, label: value }))}
            />
          </Form.Item>
          <Form.Item label="完成或阻塞说明" name="completionNote" rules={[{ max: 2000 }]}>
            <Input.TextArea
              rows={4}
              maxLength={2000}
              placeholder="建议在完成、阻塞或提请复测时填写说明"
            />
          </Form.Item>
          <Form.Item label="独立复测记录" name="retestRunId">
            <Select
              allowClear
              placeholder="选择更晚的持久化评估记录（仅在满足后端验证条件时可验证）"
              options={projectRuns.map((item) => ({
                value: item.runId,
                label: `${formatDate(item.assessedAt)} · ${item.normalizedScore.toFixed(1)} / 100`,
              }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Spin
        spinning={baselineLoading || runLoading}
        tip={runLoading ? '正在读取或创建持久化评估记录...' : '正在采集内部仓库证据并计算基线...'}
      >
        {run && (
          <Row gutter={[16, 16]}>
            <Col span={24}>
              <Card title={reportSource === 'persisted' ? '持久化评估报告' : 'AIbak 内部基线报告'}>
                <Row gutter={[16, 16]}>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="门禁后得分"
                      value={run.normalizedScore}
                      precision={1}
                      suffix="/100"
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic title="等级" value={run.grade} />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="原始分"
                      value={run.rawTotalScore}
                      precision={1}
                      suffix="/1000"
                    />
                  </Col>
                  <Col xs={12} md={6}>
                    <Statistic
                      title="发布门禁"
                      value={run.releaseGate.status}
                      valueStyle={{
                        color: run.releaseGate.status === 'PASS' ? '#389e0d' : '#cf1322',
                      }}
                    />
                  </Col>
                </Row>
                <Alert
                  style={{ marginTop: 16 }}
                  type={run.releaseGate.status === 'PASS' ? 'success' : 'error'}
                  showIcon
                  icon={<SafetyCertificateOutlined />}
                  message={`最高风险 ${run.releaseGate.highestSeverity}，得分上限 ${run.releaseGate.scoreCap}/1000`}
                  description={run.releaseGate.reasons.join('；') || '当前无活动门禁问题。'}
                />
                <Descriptions
                  bordered
                  size="small"
                  column={{ xs: 1, sm: 2, lg: 4 }}
                  style={{ marginTop: 16 }}
                >
                  <Descriptions.Item label="项目">{run.projectName}</Descriptions.Item>
                  <Descriptions.Item label="类型">{run.projectType}</Descriptions.Item>
                  <Descriptions.Item label="规则包">
                    {run.rulePackKey}@{run.rulePackVersion}
                  </Descriptions.Item>
                  <Descriptions.Item label="评估时间">
                    {formatDate(run.assessedAt)}
                  </Descriptions.Item>
                  <Descriptions.Item label="报告类型">
                    <Tag color={reportSource === 'persisted' ? 'processing' : 'default'}>
                      {reportSource === 'persisted' ? '持久化记录' : '内部基线'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="生产自动证据">
                    <Tag color={run.productionVerified ? 'success' : 'default'}>
                      {run.productionVerified ? '存在已核验证据' : '本次未发现'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="收费销售">
                    <Tag
                      color={
                        run.releaseGate.blockedForPaidSale
                          ? 'error'
                          : gateColor(run.releaseGate.status)
                      }
                    >
                      {run.releaseGate.blockedForPaidSale ? '阻断' : '未阻断'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="正式发布">
                    <Tag
                      color={
                        run.releaseGate.blockedForRelease
                          ? 'error'
                          : gateColor(run.releaseGate.status)
                      }
                    >
                      {run.releaseGate.blockedForRelease ? '阻断' : '未阻断'}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="评估范围" span={4}>
                    {scope?.target || '服务端配置仓库'}
                  </Descriptions.Item>
                </Descriptions>
                <Paragraph style={{ marginTop: 16, marginBottom: 0 }}>
                  <Text strong>评估摘要：</Text>
                  {run.summary}
                </Paragraph>
              </Card>
            </Col>

            <Col span={24}>
              <Card>
                <Tabs
                  defaultActiveKey="dimensions"
                  items={[
                    {
                      key: 'dimensions',
                      label: `评分维度 (${run.snapshots.length})`,
                      children: (
                        <Table
                          rowKey="dimensionKey"
                          dataSource={run.snapshots}
                          columns={dimensionColumns}
                          pagination={false}
                          scroll={{ x: 980 }}
                          size="middle"
                        />
                      ),
                    },
                    {
                      key: 'findings',
                      label: `门禁问题 (${run.findings.length})`,
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={run.findings}
                          columns={findingColumns}
                          pagination={false}
                          scroll={{ x: 980 }}
                          size="middle"
                        />
                      ),
                    },
                    {
                      key: 'evidence',
                      label: `证据清单 (${run.evidence.length})`,
                      children: (
                        <Table
                          rowKey="id"
                          dataSource={run.evidence}
                          columns={evidenceColumns}
                          pagination={{ pageSize: 12 }}
                          scroll={{ x: 920 }}
                          size="middle"
                          locale={{ emptyText: '当前没有可计分证据' }}
                        />
                      ),
                    },
                  ]}
                />
              </Card>
            </Col>
          </Row>
        )}
      </Spin>
    </div>
  );
};

export default ProjectGradePage;
