import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  Card,
  Col,
  Descriptions,
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
  FolderOpenOutlined,
  PlusOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import { extractApiError, projectGradeAPI } from '@/services/api';

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
    | 'url_scan_execute';
  outcome: 'attempted' | 'succeeded' | 'failed';
  targetType: 'finding' | 'remediation' | 'evaluation_run' | 'url_scan';
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

function hasAuthenticatedSession(): boolean {
  return typeof window !== 'undefined' && Boolean(window.localStorage.getItem('token'));
}

function hasHttpStatus(error: unknown, status: number): boolean {
  if (!error || typeof error !== 'object') return false;
  return (error as { response?: { status?: number } }).response?.status === status;
}

function readApiErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  return String((error as { response?: { data?: { code?: unknown } } }).response?.data?.code || '');
}

const ProjectGradePage: React.FC = () => {
  const [run, setRun] = useState<ProjectGradeRun | null>(null);
  const [scope, setScope] = useState<AssessmentScope | null>(null);
  const [reportSource, setReportSource] = useState<ReportSource>('baseline');
  const [baselineError, setBaselineError] = useState('');
  const [baselineLoading, setBaselineLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState('');
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
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
  const [projects, setProjects] = useState<ProjectWorkspaceProject[]>([]);
  const [selectedProject, setSelectedProject] = useState<ProjectWorkspaceProject | null>(null);
  const [projectRuns, setProjectRuns] = useState<ProjectGradeRun[]>([]);
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
  const authenticated = hasAuthenticatedSession();

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

  const loadBaseline = useCallback(async () => {
    setBaselineLoading(true);
    setBaselineError('');
    try {
      const response = (await projectGradeAPI.getBaseline()) as unknown as BaselineResponse;
      setRun(response.data.run);
      setScope(response.data.assessmentScope);
      setReportSource('baseline');
    } catch (requestError) {
      setBaselineError(extractApiError(requestError, '无法加载 ProjectGrade 内部基线结果'));
    } finally {
      setBaselineLoading(false);
    }
  }, []);

  const loadProjects = useCallback(async () => {
    setWorkspaceLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.listProjects()) as unknown as ProjectsResponse;
      setProjects(response.data.projects);
      setSelectedProject((current) => {
        if (!current) return null;
        return (
          response.data.projects.find((project) => project.projectId === current.projectId) || null
        );
      });
    } catch (requestError) {
      setWorkspaceError(extractApiError(requestError, '无法加载我的 ProjectGrade 项目'));
    } finally {
      setWorkspaceLoading(false);
    }
  }, []);

  const loadProjectRuns = useCallback(async (projectId: string) => {
    setHistoryLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.listProjectRuns(
        projectId
      )) as unknown as ProjectRunsResponse;
      setProjectRuns(response.data.runs);
    } catch (requestError) {
      setProjectRuns([]);
      setWorkspaceError(extractApiError(requestError, '无法加载该项目的评估历史'));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

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
      if (urlScanHistoryRequestSequenceRef.current !== requestSequence) return;
      setUrlScanHistory(response.data.scans);
      setUrlScanHistoryScope(response.data.scope);
    } catch (requestError) {
      if (urlScanHistoryRequestSequenceRef.current !== requestSequence) return;
      setUrlScanHistory([]);
      setUrlScanHistoryScope(null);
      setUrlScanHistoryError(extractApiError(requestError, '无法加载网址快速体检历史'));
    } finally {
      if (urlScanHistoryRequestSequenceRef.current === requestSequence) {
        setUrlScanHistoryLoading(false);
      }
    }
  }, []);

  const loadProjectWorkflow = useCallback(async (projectId: string) => {
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
      setPersistedEvidence(evidenceResponse.data.evidence);
      setPersistedFindings(findingsResponse.data.findings);
      setRemediationTasks(remediationsResponse.data.remediations);
    } catch (requestError) {
      setPersistedEvidence([]);
      setPersistedFindings([]);
      setRemediationTasks([]);
      setWorkspaceError(extractApiError(requestError, '无法加载项目证据、Finding 与整改任务'));
    } finally {
      setWorkflowLoading(false);
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
      if (auditRequestSequenceRef.current !== requestSequence) return;
      setAuditLogs(response.data.audit);
      setAuditLoadedProjectId(projectId);
    } catch (requestError) {
      if (auditRequestSequenceRef.current !== requestSequence) return;
      setAuditLogs([]);
      setAuditLoadedProjectId(null);
      if (hasHttpStatus(requestError, 403)) {
        setAuditAccessDenied(true);
      } else {
        setAuditError(extractApiError(requestError, '无法加载项目审计记录'));
      }
    } finally {
      if (auditRequestSequenceRef.current === requestSequence) {
        setAuditLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadBaseline();
    if (authenticated) {
      void loadProjects();
    }
  }, [authenticated, loadBaseline, loadProjects]);

  const selectProject = useCallback(
    (project: ProjectWorkspaceProject) => {
      auditRequestSequenceRef.current += 1;
      setAuditLoading(false);
      clearUrlScanState();
      setSelectedProject(project);
      setProjectRuns([]);
      setPersistedEvidence([]);
      setPersistedFindings([]);
      setRemediationTasks([]);
      setAuditLogs([]);
      setAuditLoadedProjectId(null);
      setAuditAccessDenied(false);
      setAuditError('');
      void Promise.all([
        loadProjectRuns(project.projectId),
        loadProjectWorkflow(project.projectId),
        loadProjectUrlScanHistory(project.projectId),
      ]);
    },
    [clearUrlScanState, loadProjectRuns, loadProjectUrlScanHistory, loadProjectWorkflow]
  );

  const createProject = async (values: CreateProjectValues) => {
    setWorkspaceLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.createProject({
        projectName: values.projectName.trim(),
        projectType: values.projectType,
        projectUrl: values.projectUrl?.trim() || undefined,
        description: values.description?.trim() || undefined,
      })) as unknown as CreateProjectResponse;
      const project = response.data.project;
      auditRequestSequenceRef.current += 1;
      setAuditLoading(false);
      clearUrlScanState();
      setProjects((current) => [
        project,
        ...current.filter((item) => item.projectId !== project.projectId),
      ]);
      setSelectedProject(project);
      setProjectRuns([]);
      setPersistedEvidence([]);
      setPersistedFindings([]);
      setRemediationTasks([]);
      setAuditLogs([]);
      setAuditLoadedProjectId(null);
      setAuditAccessDenied(false);
      setAuditError('');
      form.resetFields();
    } catch (requestError) {
      setWorkspaceError(extractApiError(requestError, '无法创建 ProjectGrade 项目'));
    } finally {
      setWorkspaceLoading(false);
    }
  };

  const runPersistedEvaluation = async () => {
    if (!selectedProject) return;
    setRunLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.runProjectEvaluation(
        selectedProject.projectId
      )) as unknown as RunResponse;
      setRun(response.data.run);
      setScope(persistedAssessmentScope);
      setReportSource('persisted');
      await Promise.all([
        loadProjects(),
        loadProjectRuns(selectedProject.projectId),
        loadProjectWorkflow(selectedProject.projectId),
      ]);
    } catch (requestError) {
      setWorkspaceError(extractApiError(requestError, '无法创建该项目的持久化评估记录'));
    } finally {
      setRunLoading(false);
    }
  };

  const runUrlQuickScan = async () => {
    if (!selectedProject) return;
    if (!selectedProject.projectUrl) {
      setUrlScanError('请先创建或选择已登记 HTTP(S) 地址的项目');
      return;
    }

    const requestSequence = urlScanRequestSequenceRef.current + 1;
    urlScanRequestSequenceRef.current = requestSequence;
    setUrlScanLoading(true);
    setUrlScanError('');
    setUrlScanResult(null);
    setUrlScanScope(null);
    try {
      const response = (await projectGradeAPI.runProjectUrlQuickScan(
        selectedProject.projectId
      )) as unknown as ProjectGradeUrlScanResponse;
      if (urlScanRequestSequenceRef.current !== requestSequence) return;
      setUrlScanResult(response.data.scan);
      setUrlScanScope(response.data.scope);
      await loadProjectUrlScanHistory(selectedProject.projectId);
    } catch (requestError) {
      if (urlScanRequestSequenceRef.current !== requestSequence) return;
      const code = readApiErrorCode(requestError);
      setUrlScanError(
        code === 'PROJECT_GRADE_EXTERNAL_SCANNING_DISABLED'
          ? '网址快速体检的服务端 Feature Flag 当前关闭；这是默认安全状态。'
          : extractApiError(requestError, '无法完成项目登记网址的快速体检')
      );
      await loadProjectUrlScanHistory(selectedProject.projectId);
    } finally {
      if (urlScanRequestSequenceRef.current === requestSequence) {
        setUrlScanLoading(false);
      }
    }
  };

  const openHistoryRun = async (runId: string) => {
    setRunLoading(true);
    setWorkspaceError('');
    try {
      const response = (await projectGradeAPI.getRun(runId)) as unknown as RunResponse;
      setRun(response.data.run);
      setScope(persistedAssessmentScope);
      setReportSource('persisted');
    } catch (requestError) {
      setWorkspaceError(extractApiError(requestError, '无法加载所选的评估记录'));
    } finally {
      setRunLoading(false);
    }
  };

  const rebuildProjection = async (record: ProjectGradeRun) => {
    if (!selectedProject) return;
    setProjectionRebuildLoading(record.runId);
    setWorkspaceError('');
    try {
      await projectGradeAPI.rebuildProjection(record.runId);
      await Promise.all([
        loadProjects(),
        loadProjectRuns(selectedProject.projectId),
        loadProjectWorkflow(selectedProject.projectId),
        auditLoadedProjectId === selectedProject.projectId
          ? loadProjectAudit(selectedProject.projectId)
          : Promise.resolve(),
      ]);
    } catch (requestError) {
      setWorkspaceError(
        hasHttpStatus(requestError, 403)
          ? '当前账户没有执行投影重建的权限'
          : extractApiError(requestError, '无法重建评估投影')
      );
    } finally {
      setProjectionRebuildLoading(null);
    }
  };

  const createRemediation = async (finding: PersistedFinding) => {
    if (!selectedProject) return;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.createRemediation(selectedProject.projectId, finding.findingId);
      await loadProjectWorkflow(selectedProject.projectId);
    } catch (requestError) {
      setWorkspaceError(extractApiError(requestError, '无法创建整改任务'));
    } finally {
      setWorkflowLoading(false);
    }
  };

  const submitFindingWorkflow = async (values: FindingWorkflowValues) => {
    if (!selectedProject || !findingWorkflowTarget) return;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.updateFindingWorkflow(
        selectedProject.projectId,
        findingWorkflowTarget.findingId,
        {
          status: values.status,
          note: values.note.trim(),
        }
      );
      setFindingWorkflowTarget(null);
      findingWorkflowForm.resetFields();
      await loadProjectWorkflow(selectedProject.projectId);
    } catch (requestError) {
      setWorkspaceError(
        extractApiError(requestError, '无法更新 Finding 工作流；请确认管理员权限和填写说明')
      );
    } finally {
      setWorkflowLoading(false);
    }
  };

  const submitRemediation = async (values: RemediationUpdateValues) => {
    if (!selectedProject || !remediationTarget) return;
    setWorkflowLoading(true);
    setWorkspaceError('');
    try {
      await projectGradeAPI.updateRemediation(selectedProject.projectId, remediationTarget.taskId, {
        status: values.status,
        completionNote: values.completionNote?.trim() || undefined,
        retestRunId: values.retestRunId || undefined,
      });
      setRemediationTarget(null);
      remediationForm.resetFields();
      await loadProjectWorkflow(selectedProject.projectId);
    } catch (requestError) {
      setWorkspaceError(
        extractApiError(requestError, '无法更新整改任务；验证状态须由服务端复测规则判定')
      );
    } finally {
      setWorkflowLoading(false);
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
      width: 100,
      render: (_: unknown, record: ProjectGradeRun) => (
        <Space size="small" wrap>
          <Button type="link" size="small" onClick={() => void openHistoryRun(record.runId)}>
            查看报告
          </Button>
          <Button
            type="link"
            size="small"
            loading={projectionRebuildLoading === record.runId}
            onClick={() => void rebuildProjection(record)}
          >
            管理员重建投影
          </Button>
        </Space>
      ),
    },
  ];

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
              <Button type="primary" size="small" href="/login?redirect=%2Fproject-grade">
                去登录
              </Button>
            }
          />
        ) : (
          <>
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
                      loading={workspaceLoading}
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
                      loading={workspaceLoading}
                      onClick={() => void loadProjects()}
                    >
                      刷新
                    </Button>
                  }
                >
                  <Spin spinning={workspaceLoading}>
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
                      disabled={selectedProject.status !== 'active' || !selectedProject.projectUrl}
                    >
                      网址快速体检（Batch 1）
                    </Button>
                    <Button
                      type="primary"
                      onClick={() => void runPersistedEvaluation()}
                      loading={runLoading}
                      disabled={selectedProject.status !== 'active'}
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
                </Descriptions>
                <Paragraph type="secondary" style={{ marginTop: 12 }}>
                  “创建持久化评估记录”仍只保存 AIbak 内部确定性基线；“网址快速体检”只使用项目已登记
                  URL，不接受临时地址，不执行 JavaScript、Lighthouse、Git、CI
                  或生产链路验收，也不修改最终评分。
                </Paragraph>
                <Alert
                  type="info"
                  showIcon
                  style={{ marginTop: 12 }}
                  message="Batch 1 外部网址快速体检默认关闭"
                  description="启用后也只允许项目成员对数据库中已登记的 HTTP(S) 地址发起单次、限时、限大小的服务端观察；结果不是 Lighthouse 或真实浏览器报告，也不构成生产验收。"
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
