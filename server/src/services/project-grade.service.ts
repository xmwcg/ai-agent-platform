import fs from 'fs';
import path from 'path';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PLANS } from '../config/billing';
import { AppError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { resolveUserPlan } from '../middleware/subscription';
import { EvaluationRun, type IEvaluationRun } from '../models/EvaluationRun';
import {
  ProjectGradeAuditLog,
  type IProjectGradeAuditLog,
  type ProjectGradeAuditAction,
  type ProjectGradeAuditTargetType,
} from '../models/ProjectGradeAuditLog';
import {
  ProjectGradeEvidence as ProjectGradeEvidenceModel,
  type IProjectGradeEvidence,
} from '../models/ProjectGradeEvidence';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION,
  ProjectGradeEvidenceAdoption,
  type IProjectGradeEvidenceAdoption,
} from '../models/ProjectGradeEvidenceAdoption';
import {
  ProjectGradeFinding as ProjectGradeFindingModel,
  type IProjectGradeFinding,
} from '../models/ProjectGradeFinding';
import { ProjectGradeProject, type IProjectGradeProject } from '../models/ProjectGradeProject';
import {
  ProjectGradeRemediationTask,
  type IProjectGradeRemediationTask,
} from '../models/ProjectGradeRemediationTask';
import { ProjectGradeRule } from '../models/ProjectGradeRule';
import {
  ProjectGradeReport,
  type IPublicReportDocument,
  type PublicReportDimensionRow,
  type PublicReportFindingHighlight,
} from '../models/ProjectGradeReport';
import {
  ProjectGradeReportDelivery,
  type IProjectGradeReportDelivery,
} from '../models/ProjectGradeReportDelivery';
import { ProjectGradeScoreSnapshot } from '../models/ProjectGradeScoreSnapshot';
import {
  ProjectGradeScanTarget,
  type IProjectGradeScanTarget,
} from '../models/ProjectGradeScanTarget';
import {
  ProjectGradeSourceScanRun,
  type IProjectGradeSourceScanRun,
} from '../models/ProjectGradeSourceScanRun';
import {
  ProjectGradeUrlScanRun,
  type IProjectGradeUrlScanRun,
} from '../models/ProjectGradeUrlScanRun';
import { Team, type TeamRole } from '../models/Team';
import {
  DEFAULT_PROJECT_GRADE_RULES,
  PROJECT_GRADE_PROJECTION_VERSION,
  type CompletionRatio,
  type ProjectGradeDimensionKey,
  type ProjectGradeFindingWorkflowStatus,
  type ProjectGradeProjectType,
  type ProjectGradeRemediationStatus,
  type ProjectGradeRuleDefinition,
} from '../project-grade/config';
import {
  createEvidence,
  createFinding,
  evaluateProjectGrade,
  type ProjectGradeEvaluationResult,
  type ProjectGradeEvidence,
  type ProjectGradeFinding,
  type RuleEvaluationInput,
} from '../project-grade/engine';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
  ProjectGradeSourceEvidenceProjectionError,
  projectSourceScanEvidenceDrafts,
  type ProjectGradeSourceEvidenceDraft,
  type ProjectGradeSourceEvidenceProjection,
} from '../project-grade/source-scan-evidence-projection';
import {
  PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
  ProjectGradeSourceEvidenceEvaluationError,
  evaluateAdoptedSourceEvidence,
} from '../project-grade/source-evidence-adoption-evaluation';
import { normalizeProjectGradeSourceRelativePath } from '../project-grade/source-scan-safety';
import type { ProjectGradeSourceScanResult } from '../project-grade/source-scan.types';
import {
  ProjectGradeSourceScanService,
  type ProjectGradeSourceScanServiceOptions,
} from './project-grade-source-scan.service';
import {
  projectGradeUrlScanService,
  type ProjectGradeUrlQuickScanResult,
  type ProjectGradeUrlScanService,
} from './project-grade-url-scan.service';
import {
  renderProjectGradeReportPdf,
  type ProjectGradeReportPdfArtifact,
  type ProjectGradeReportPdfOptions,
} from './project-grade-report-pdf.service';

const PROJECT_GRADE_PROJECTION_LEASE_MS = 10 * 60 * 1000;
const PROJECT_GRADE_REPORT_PUBLICATION_VERSION = 1;
const PROJECT_GRADE_REPORT_SCOPE_NOTE =
  '该公开报告是服务端持久化评估的不可变摘要，不公开原始源码、内部路径、凭据或完整证据，并且不构成生产环境验收。';
const PROJECT_GRADE_REPORT_FINDING_LIMIT = 5;
const PROJECT_GRADE_REPORT_SEVERITY_RANK = { P0: 0, P1: 1, P2: 2, P3: 3 } as const;

class ProjectGradeProjectionLeaseLostError extends Error {
  constructor() {
    super('ProjectGrade projection lease ownership was lost');
    this.name = 'ProjectGradeProjectionLeaseLostError';
  }
}

export interface CreateProjectGradeProjectInput {
  ownerId: string;
  teamId?: string;
  name: string;
  description?: string;
  projectType: ProjectGradeProjectType | string;
  projectUrl?: string;
}

export interface ProjectGradeRuleSyncResult {
  rulePackKey: string;
  rulePackVersion: string;
  rules: number;
  matched: number;
  modified: number;
  upserted: number;
}

export interface CreateProjectGradeRemediationInput {
  assigneeId?: string;
  dueAt?: Date;
  slaHours?: number;
}

export interface UpdateProjectGradeRemediationInput {
  status?: ProjectGradeRemediationStatus;
  assigneeId?: string | null;
  dueAt?: Date | null;
  slaHours?: number | null;
  completionNote?: string;
  retestRunId?: string | null;
}

export interface UpdateProjectGradeFindingWorkflowInput {
  status: Extract<ProjectGradeFindingWorkflowStatus, 'open' | 'accepted_risk' | 'false_positive'>;
  note: string;
}

export interface AdoptProjectGradeSourceEvidenceInput {
  sourceScanId: string;
  expectedDraftSetHash: string;
  adoptionVersion: number;
}

export type ProjectGradeSourceEvidenceDraftPreview = Omit<
  ProjectGradeSourceEvidenceProjection,
  'ownerId' | 'teamId' | 'drafts'
> & {
  sourceContentPersisted: false;
  drafts: Array<Omit<ProjectGradeSourceEvidenceDraft, 'ownerId' | 'teamId'>>;
};

export interface ProjectGradeSourceEvidenceAdoptionSummary {
  adoptionId: string;
  targetId: string;
  sourceScanId: string;
  sourceScanVersion: string;
  snapshotHash: string;
  draftSetHash: string;
  projectionVersion: number;
  adoptionVersion: typeof PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION;
  draftCount: number;
  createdBy: string;
  createdAt: Date;
  evidenceScope: 'authorized_local_source_snapshot';
  scoringDisposition: 'adopted_pending_evaluation';
  productionAcceptance: false;
  externalScanningEnabled: false;
}

export interface RunProjectGradeSourceEvidenceEvaluationInput {
  adoptionId: string;
}

export interface PublishProjectGradeReportInput {
  title?: string;
}

export interface ProjectGradeReportListItem {
  reportId: string;
  publicId: string;
  runId: string;
  projectId: string;
  title: string;
  projectName: string;
  projectKind: 'website' | 'saas' | 'ai_application';
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: 'P0' | 'P1' | 'P2' | 'P3' | null;
  isPublic: boolean;
  publishedAt: Date;
  publishedBy?: string;
  expiresAt: Date;
  revokedAt?: Date;
  revokedBy?: string;
  revocationReason?: string;
  sharedCount: number;
  contentFingerprint?: string;
}

export interface ProjectGradeReportDeliveryListItem {
  deliveryId: string;
  reportId: string;
  publicId: string;
  projectId: string;
  requestedBy: string;
  format: 'pdf';
  planId: 'free' | 'pro' | 'max' | 'team';
  branding: 'aibak' | 'white_label';
  contentFingerprint: string;
  documentFingerprint: string;
  fileName: string;
  byteLength: number;
  reportPublishedAt: Date;
  reportExpiresAt: Date;
  deliveredAt: Date;
}

export interface ProjectGradeReportPdfDeliveryResult {
  artifact: ProjectGradeReportPdfArtifact;
  delivery: ProjectGradeReportDeliveryListItem;
}

type ProjectGradeReportPdfRenderer = (
  report: IPublicReportDocument,
  options: ProjectGradeReportPdfOptions
) => Promise<ProjectGradeReportPdfArtifact>;

interface ProjectGradeReportFingerprintInput {
  publicationVersion: number;
  runId: string;
  projectId: string;
  projectName: string;
  projectKind: 'website' | 'saas' | 'ai_application';
  title: string;
  verdict: 'S' | 'A' | 'B' | 'C' | 'D' | 'F';
  externalScore: number;
  internalScore: number;
  gateBlocked: 'P0' | 'P1' | 'P2' | 'P3' | null;
  dimensionSnapshot: PublicReportDimensionRow[];
  findingHighlights: PublicReportFindingHighlight[];
}

export interface RecoverExpiredProjectGradeProjectionsOptions {
  now?: Date;
  limit?: number;
  actorId?: string;
}

export interface RecoverExpiredProjectGradeProjectionsReport {
  scanned: number;
  recovered: number;
  skipped: number;
  failed: number;
  failures: Array<{ runId: string; code: string }>;
}

interface ProjectGradeAuditContext {
  operationId: string;
  projectId: string;
  ownerId: string;
  teamId?: string;
  actorId: string;
  action: ProjectGradeAuditAction;
  targetType: ProjectGradeAuditTargetType;
  targetId: string;
  fromStatus?: string;
  toStatus?: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}

const REMEDIATION_SLA_HOURS = {
  P0: 4,
  P1: 24,
  P2: 72,
  P3: 168,
} as const;

const REMEDIATION_TRANSITIONS: Record<
  ProjectGradeRemediationStatus,
  ProjectGradeRemediationStatus[]
> = {
  open: ['in_progress', 'blocked', 'cancelled'],
  in_progress: ['blocked', 'ready_for_retest', 'cancelled'],
  blocked: ['in_progress', 'cancelled'],
  ready_for_retest: ['in_progress', 'verified', 'cancelled'],
  verified: [],
  cancelled: [],
};

const TEAM_ROLE_RANK: Record<TeamRole, number> = {
  owner: 4,
  admin: 3,
  member: 2,
  viewer: 1,
};
export class ProjectGradeService {
  private readonly repoRoot: string;
  private readonly urlScanService: Pick<ProjectGradeUrlScanService, 'scanRegisteredUrl'>;
  private readonly sourceScanService: Pick<ProjectGradeSourceScanService, 'scan'>;
  private readonly reportPdfRenderer: ProjectGradeReportPdfRenderer;

  constructor(
    repoRoot = process.env.PROJECT_GRADE_REPO_ROOT || path.resolve(__dirname, '../../..'),
    urlScanService: Pick<
      ProjectGradeUrlScanService,
      'scanRegisteredUrl'
    > = projectGradeUrlScanService,
    sourceScanService?: Pick<ProjectGradeSourceScanService, 'scan'>,
    reportPdfRenderer: ProjectGradeReportPdfRenderer = renderProjectGradeReportPdf
  ) {
    this.repoRoot = repoRoot;
    this.urlScanService = urlScanService;
    this.reportPdfRenderer = reportPdfRenderer;
    const sourceScanOptions: ProjectGradeSourceScanServiceOptions = {
      allowedRoots: { aibak_server_repository: repoRoot },
    };
    this.sourceScanService =
      sourceScanService || new ProjectGradeSourceScanService(sourceScanOptions);
  }

  getRules(): ProjectGradeRuleDefinition[] {
    return DEFAULT_PROJECT_GRADE_RULES.map((rule) => ({
      ...rule,
      projectTypes: [...rule.projectTypes],
      evidenceGuidance: [...rule.evidenceGuidance],
      remediationGuidance: [...rule.remediationGuidance],
    }));
  }

  async syncDefaultRulePack(): Promise<ProjectGradeRuleSyncResult> {
    const rules = this.getRules();
    const result = await ProjectGradeRule.bulkWrite(
      rules.map((rule) => ({
        updateOne: {
          filter: {
            key: rule.key,
            rulePackKey: rule.rulePackKey,
            rulePackVersion: rule.rulePackVersion,
          },
          update: { $set: rule },
          upsert: true,
        },
      })),
      { ordered: true }
    );

    return {
      rulePackKey: rules[0]?.rulePackKey || 'aibak-projectgrade-core',
      rulePackVersion: rules[0]?.rulePackVersion || '0.1.0',
      rules: rules.length,
      matched: result.matchedCount,
      modified: result.modifiedCount,
      upserted: result.upsertedCount,
    };
  }

  async createProject(input: CreateProjectGradeProjectInput): Promise<{
    project: IProjectGradeProject;
    target: IProjectGradeScanTarget;
  }> {
    const projectType = this.normalizeProjectType(input.projectType);
    const teamId = input.teamId?.trim() || undefined;
    if (teamId) await this.assertTeamRole(teamId, input.ownerId, 'admin');

    const project = await ProjectGradeProject.create({
      ownerId: input.ownerId,
      teamId,
      name: input.name,
      description: input.description,
      projectType,
      projectUrl: input.projectUrl,
      status: 'active',
      createdBy: input.ownerId,
      updatedBy: input.ownerId,
    });

    try {
      const target = await ProjectGradeScanTarget.create({
        projectId: project.projectId,
        ownerId: input.ownerId,
        teamId,
        kind: 'internal_repository',
        label: 'AIbak 服务端仓库内部基线',
        scopeKey: 'aibak_server_repository',
        repositoryProvider: 'internal',
        status: 'active',
        createdBy: input.ownerId,
      });
      return { project, target };
    } catch (error) {
      await ProjectGradeProject.deleteOne({ projectId: project.projectId }).catch(() => undefined);
      throw error;
    }
  }

  async listProjects(userId: string): Promise<IProjectGradeProject[]> {
    const memberships = await Team.find({
      $or: [{ ownerId: userId }, { 'members.userId': userId }],
    })
      .select('_id')
      .lean();
    const teamIds = memberships.map((team) => String(team._id));
    const access = teamIds.length
      ? { $or: [{ ownerId: userId }, { teamId: { $in: teamIds } }] }
      : { ownerId: userId };

    return ProjectGradeProject.find({
      ...access,
      status: { $in: ['active', 'archived'] },
    }).sort({ updatedAt: -1 });
  }

  async getProjectForUser(
    projectId: string,
    userId: string,
    minimumRole: TeamRole = 'viewer'
  ): Promise<IProjectGradeProject> {
    const project = await ProjectGradeProject.findOne({ projectId });
    if (!project) {
      throw new AppError(404, 'ProjectGrade project not found', 'PROJECT_GRADE_PROJECT_NOT_FOUND');
    }
    if (project.ownerId === userId) return project;
    if (!project.teamId) {
      throw new AppError(
        403,
        'ProjectGrade project access denied',
        'PROJECT_GRADE_PROJECT_FORBIDDEN'
      );
    }
    await this.assertTeamRole(project.teamId, userId, minimumRole);
    return project;
  }

  async runProjectUrlQuickScan(
    projectId: string,
    userId: string
  ): Promise<ProjectGradeUrlQuickScanResult> {
    const project = await this.getProjectForUser(projectId, userId, 'member');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot be scanned',
        'PROJECT_GRADE_PROJECT_ARCHIVED'
      );
    }

    const projectUrl = project.projectUrl?.trim();
    if (!projectUrl) {
      throw new AppError(409, 'Project has no registered URL', 'PROJECT_GRADE_PROJECT_URL_MISSING');
    }

    const scanId = randomUUID();
    const requestedUrl = this.sanitizeUrlForHistory(projectUrl);
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'url_scan_execute',
      targetType: 'url_scan',
      targetId: scanId,
      metadata: {
        evidenceScope: 'single_server_http_observation',
        productionAcceptance: false,
      },
    });

    let result: ProjectGradeUrlQuickScanResult;
    try {
      result = await this.urlScanService.scanRegisteredUrl(projectUrl);
    } catch (scanError) {
      try {
        await ProjectGradeUrlScanRun.create({
          scanId,
          projectId: project.projectId,
          ownerId: project.ownerId,
          teamId: project.teamId,
          createdBy: userId,
          status: 'failed',
          requestedUrl,
          errorCode:
            scanError instanceof AppError
              ? scanError.code
              : 'PROJECT_GRADE_URL_SCAN_INTERNAL_ERROR',
          errorSummary: this.sanitizeUrlScanError(scanError),
          evidenceScope: 'single_server_http_observation',
          productionAcceptance: false,
        });
      } catch (persistenceError) {
        await this.finishAudit(audit, 'failed', persistenceError, {
          historyPersisted: false,
          scanCompleted: false,
        });
        throw new AppError(
          503,
          '网址体检历史暂时无法保存，本次结果未返回',
          'PROJECT_GRADE_URL_SCAN_HISTORY_UNAVAILABLE',
          this.sanitizeProjectionError(persistenceError)
        );
      }

      await this.finishAudit(audit, 'failed', scanError, { historyPersisted: true });
      throw scanError;
    }

    const persistedResult: ProjectGradeUrlQuickScanResult = {
      ...result,
      requestedUrl: this.sanitizeUrlForHistory(result.requestedUrl),
      finalUrl: this.sanitizeUrlForHistory(result.finalUrl),
      redirectChain: result.redirectChain.map((url) => this.sanitizeUrlForHistory(url)),
    };

    try {
      await ProjectGradeUrlScanRun.create({
        scanId,
        projectId: project.projectId,
        ownerId: project.ownerId,
        teamId: project.teamId,
        createdBy: userId,
        status: 'succeeded',
        requestedUrl: persistedResult.requestedUrl,
        finalUrl: persistedResult.finalUrl,
        scanVersion: result.scanVersion,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        result: persistedResult,
        evidenceScope: 'single_server_http_observation',
        productionAcceptance: false,
      });
    } catch (persistenceError) {
      await this.finishAudit(audit, 'failed', persistenceError, {
        historyPersisted: false,
        scanCompleted: true,
      });
      throw new AppError(
        503,
        '网址体检历史暂时无法保存，本次结果未返回',
        'PROJECT_GRADE_URL_SCAN_HISTORY_UNAVAILABLE',
        this.sanitizeProjectionError(persistenceError)
      );
    }

    await this.finishAudit(audit, 'succeeded', undefined, {
      historyPersisted: true,
      scanVersion: result.scanVersion,
      statusCode: result.statusCode,
      durationMs: result.durationMs,
    });
    return result;
  }

  async listProjectUrlScanRuns(
    projectId: string,
    userId: string,
    limit = 20
  ): Promise<IProjectGradeUrlScanRun[]> {
    const project = await this.getProjectForUser(projectId, userId, 'viewer');
    return ProjectGradeUrlScanRun.find(this.buildProjectTenantFilter(project))
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50));
  }

  async runProjectSourceScan(
    projectId: string,
    userId: string
  ): Promise<ProjectGradeSourceScanResult> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot be source scanned',
        'PROJECT_GRADE_PROJECT_ARCHIVED'
      );
    }

    const target = await ProjectGradeScanTarget.findOne({
      projectId: project.projectId,
      status: 'active',
      kind: 'internal_repository',
    });
    if (!target) {
      throw new AppError(
        409,
        'No active authorized source target exists',
        'PROJECT_GRADE_SOURCE_TARGET_MISSING'
      );
    }
    if (target.scopeKey !== 'aibak_server_repository' || target.repositoryProvider !== 'internal') {
      throw new AppError(
        403,
        'Source target is not authorized for local scanning',
        'PROJECT_GRADE_SOURCE_TARGET_FORBIDDEN'
      );
    }

    const scanId = randomUUID();
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'source_scan_execute',
      targetType: 'source_scan',
      targetId: scanId,
      metadata: {
        rootKey: target.scopeKey,
        evidenceScope: 'authorized_local_source_snapshot',
        productionAcceptance: false,
        externalScanningEnabled: false,
      },
    });

    let persistedResult: ProjectGradeSourceScanResult;
    try {
      const result = await this.sourceScanService.scan({ rootKey: target.scopeKey });
      persistedResult = this.sanitizeSourceScanResult(result, target.scopeKey);
    } catch (scanError) {
      try {
        await ProjectGradeSourceScanRun.create({
          scanId,
          projectId: project.projectId,
          ownerId: project.ownerId,
          teamId: project.teamId,
          createdBy: userId,
          status: 'failed',
          rootKey: target.scopeKey,
          errorCode:
            scanError instanceof AppError
              ? scanError.code
              : 'PROJECT_GRADE_SOURCE_SCAN_INTERNAL_ERROR',
          errorSummary: this.sanitizeSourceScanError(scanError),
          evidenceScope: 'authorized_local_source_snapshot',
          productionAcceptance: false,
        });
      } catch (persistenceError) {
        await this.finishAudit(audit, 'failed', persistenceError, {
          historyPersisted: false,
          scanCompleted: false,
        });
        throw new AppError(
          503,
          '源码快照历史暂时无法保存，本次结果未返回',
          'PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE',
          this.sanitizeProjectionError(persistenceError)
        );
      }

      await this.finishAudit(audit, 'failed', scanError, { historyPersisted: true });
      throw scanError;
    }

    try {
      await ProjectGradeSourceScanRun.create({
        scanId,
        projectId: project.projectId,
        ownerId: project.ownerId,
        teamId: project.teamId,
        createdBy: userId,
        status: 'succeeded',
        rootKey: target.scopeKey,
        scanVersion: persistedResult.scanVersion,
        snapshotHash: persistedResult.snapshotHash,
        result: persistedResult,
        evidenceScope: 'authorized_local_source_snapshot',
        productionAcceptance: false,
      });
    } catch (persistenceError) {
      await this.finishAudit(audit, 'failed', persistenceError, {
        historyPersisted: false,
        scanCompleted: true,
      });
      throw new AppError(
        503,
        '源码快照历史暂时无法保存，本次结果未返回',
        'PROJECT_GRADE_SOURCE_SCAN_HISTORY_UNAVAILABLE',
        this.sanitizeProjectionError(persistenceError)
      );
    }

    await this.finishAudit(audit, 'succeeded', undefined, {
      historyPersisted: true,
      scanVersion: persistedResult.scanVersion,
      snapshotHash: persistedResult.snapshotHash,
      filesScanned: persistedResult.summary.filesScanned,
    });
    return persistedResult;
  }

  async listProjectSourceScanRuns(
    projectId: string,
    userId: string,
    limit = 20
  ): Promise<IProjectGradeSourceScanRun[]> {
    const project = await this.getProjectForUser(projectId, userId, 'viewer');
    return ProjectGradeSourceScanRun.find(this.buildProjectTenantFilter(project))
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50));
  }

  async getProjectSourceEvidenceDraftPreview(
    projectId: string,
    userId: string,
    sourceScanId: string
  ): Promise<ProjectGradeSourceEvidenceDraftPreview> {
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(sourceScanId)) {
      throw new AppError(400, 'sourceScanId is invalid', 'PROJECT_GRADE_INVALID_SOURCE_SCAN_ID');
    }

    const project = await this.getProjectForUser(projectId, userId, 'admin');
    const tenantFilter = this.buildProjectTenantFilter(project);
    const sourceScan = await ProjectGradeSourceScanRun.findOne({
      ...tenantFilter,
      scanId: sourceScanId,
      status: 'succeeded',
    });
    if (!sourceScan || !sourceScan.result || !sourceScan.scanVersion || !sourceScan.snapshotHash) {
      throw new AppError(
        404,
        'Successful ProjectGrade source scan not found',
        'PROJECT_GRADE_SOURCE_SCAN_NOT_FOUND'
      );
    }

    const target = await ProjectGradeScanTarget.findOne({
      ...tenantFilter,
      status: 'active',
      kind: 'internal_repository',
    });
    if (!target) {
      throw new AppError(
        409,
        'No active authorized source target exists',
        'PROJECT_GRADE_SOURCE_TARGET_MISSING'
      );
    }
    if (
      target.scopeKey !== 'aibak_server_repository' ||
      target.repositoryProvider !== 'internal' ||
      sourceScan.rootKey !== target.scopeKey
    ) {
      throw new AppError(
        409,
        'Source scan cannot be projected into an evidence draft preview',
        'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED'
      );
    }

    let projection: ProjectGradeSourceEvidenceProjection;
    try {
      projection = projectSourceScanEvidenceDrafts({
        scanId: sourceScan.scanId,
        projectId: sourceScan.projectId,
        ownerId: sourceScan.ownerId,
        ...(sourceScan.teamId ? { teamId: sourceScan.teamId } : {}),
        status: sourceScan.status,
        rootKey: sourceScan.rootKey,
        scanVersion: sourceScan.scanVersion,
        snapshotHash: sourceScan.snapshotHash,
        result: sourceScan.result,
        evidenceScope: sourceScan.evidenceScope,
        productionAcceptance: sourceScan.productionAcceptance,
        createdAt: sourceScan.createdAt,
      });
    } catch (error) {
      if (error instanceof ProjectGradeSourceEvidenceProjectionError) {
        throw new AppError(
          409,
          'Source scan cannot be projected into an evidence draft preview',
          'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED',
          error.code
        );
      }
      throw error;
    }

    return {
      projectionVersion: projection.projectionVersion,
      sourceScanId: projection.sourceScanId,
      projectId: projection.projectId,
      sourceScanVersion: projection.sourceScanVersion,
      snapshotHash: projection.snapshotHash,
      draftSetHash: projection.draftSetHash,
      collectedAt: projection.collectedAt,
      evidenceScope: projection.evidenceScope,
      scoringDisposition: projection.scoringDisposition,
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
      drafts: projection.drafts.map((draft) => ({
        evidenceId: draft.evidenceId,
        projectId: draft.projectId,
        rulePackKey: draft.rulePackKey,
        rulePackVersion: draft.rulePackVersion,
        ruleKey: draft.ruleKey,
        dimensionKey: draft.dimensionKey,
        level: draft.level,
        factor: draft.factor,
        sourceType: draft.sourceType,
        source: draft.source,
        collectedAt: draft.collectedAt,
        title: draft.title,
        description: draft.description,
        kind: draft.kind,
        metadata: draft.metadata,
        projectionVersion: draft.projectionVersion,
        scoringDisposition: draft.scoringDisposition,
      })),
    };
  }

  async listProjectSourceEvidenceAdoptions(
    projectId: string,
    userId: string,
    limit = 20
  ): Promise<ProjectGradeSourceEvidenceAdoptionSummary[]> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    const adoptions = await ProjectGradeEvidenceAdoption.find(
      this.buildProjectTenantFilter(project)
    )
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50));

    return adoptions.map((adoption) => ({
      adoptionId: adoption.adoptionId,
      targetId: adoption.targetId,
      sourceScanId: adoption.sourceScanId,
      sourceScanVersion: adoption.sourceScanVersion,
      snapshotHash: adoption.snapshotHash,
      draftSetHash: adoption.draftSetHash,
      projectionVersion: adoption.projectionVersion,
      adoptionVersion: adoption.adoptionVersion,
      draftCount: adoption.draftCount,
      createdBy: adoption.createdBy,
      createdAt: adoption.createdAt,
      evidenceScope: adoption.evidenceScope,
      scoringDisposition: adoption.scoringDisposition,
      productionAcceptance: false,
      externalScanningEnabled: false,
    }));
  }
  async adoptProjectSourceScanEvidence(
    projectId: string,
    userId: string,
    input: AdoptProjectGradeSourceEvidenceInput
  ): Promise<IProjectGradeEvidenceAdoption> {
    if (input.adoptionVersion !== PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION) {
      throw new AppError(
        400,
        'Source evidence adoption version is not supported',
        'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION_UNSUPPORTED'
      );
    }
    if (!/^[A-Za-z0-9_-]{8,100}$/.test(input.sourceScanId)) {
      throw new AppError(400, 'sourceScanId is invalid', 'PROJECT_GRADE_INVALID_SOURCE_SCAN_ID');
    }
    if (!/^sha256:[a-f0-9]{64}$/.test(input.expectedDraftSetHash)) {
      throw new AppError(
        400,
        'expectedDraftSetHash is invalid',
        'PROJECT_GRADE_INVALID_DRAFT_SET_HASH'
      );
    }

    const project = await this.getProjectForUser(projectId, userId, 'admin');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot adopt source evidence',
        'PROJECT_GRADE_PROJECT_ARCHIVED'
      );
    }

    const tenantFilter = this.buildProjectTenantFilter(project);
    const sourceScan = await ProjectGradeSourceScanRun.findOne({
      ...tenantFilter,
      scanId: input.sourceScanId,
      status: 'succeeded',
    });
    if (!sourceScan || !sourceScan.result || !sourceScan.scanVersion || !sourceScan.snapshotHash) {
      throw new AppError(
        404,
        'Successful ProjectGrade source scan not found',
        'PROJECT_GRADE_SOURCE_SCAN_NOT_FOUND'
      );
    }

    const target = await ProjectGradeScanTarget.findOne({
      ...tenantFilter,
      status: 'active',
      kind: 'internal_repository',
    });
    if (!target) {
      throw new AppError(
        409,
        'No active authorized source target exists',
        'PROJECT_GRADE_SOURCE_TARGET_MISSING'
      );
    }
    if (
      target.scopeKey !== 'aibak_server_repository' ||
      target.repositoryProvider !== 'internal' ||
      sourceScan.rootKey !== target.scopeKey
    ) {
      throw new AppError(
        403,
        'Source target is not authorized for evidence adoption',
        'PROJECT_GRADE_SOURCE_TARGET_FORBIDDEN'
      );
    }

    let projection: ProjectGradeSourceEvidenceProjection;
    try {
      projection = projectSourceScanEvidenceDrafts({
        scanId: sourceScan.scanId,
        projectId: sourceScan.projectId,
        ownerId: sourceScan.ownerId,
        ...(sourceScan.teamId ? { teamId: sourceScan.teamId } : {}),
        status: sourceScan.status,
        rootKey: sourceScan.rootKey,
        scanVersion: sourceScan.scanVersion,
        snapshotHash: sourceScan.snapshotHash,
        result: sourceScan.result,
        evidenceScope: sourceScan.evidenceScope,
        productionAcceptance: sourceScan.productionAcceptance,
        createdAt: sourceScan.createdAt,
      });
    } catch (error) {
      if (error instanceof ProjectGradeSourceEvidenceProjectionError) {
        throw new AppError(
          409,
          'Source scan cannot be projected into an evidence adoption manifest',
          'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED',
          error.code
        );
      }
      throw error;
    }

    if (projection.draftSetHash !== input.expectedDraftSetHash) {
      throw new AppError(
        409,
        'Source evidence draft set changed; refresh before adopting',
        'PROJECT_GRADE_SOURCE_EVIDENCE_DRAFT_SET_CHANGED'
      );
    }

    const adoptionIdentity = [
      project.projectId,
      target.targetId,
      sourceScan.scanId,
      projection.draftSetHash,
      String(PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION),
    ].join('\0');
    const adoptionId = `source-adoption:v1:${createHash('sha256')
      .update(adoptionIdentity)
      .digest('hex')}`;
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'source_evidence_adopt',
      targetType: 'evidence_adoption',
      targetId: adoptionId,
      toStatus: 'adopted_pending_evaluation',
      metadata: {
        sourceScanId: sourceScan.scanId,
        draftSetHash: projection.draftSetHash,
        adoptionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION,
        productionAcceptance: false,
      },
    });

    const adoptionFilter = { ...tenantFilter, adoptionId };
    const existing = await ProjectGradeEvidenceAdoption.findOne(adoptionFilter);
    if (existing) {
      await this.finishAudit(audit, 'succeeded', undefined, { idempotentReplay: true });
      return existing;
    }

    const adoptionPayload = {
      adoptionId,
      projectId: project.projectId,
      targetId: target.targetId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      sourceScanId: sourceScan.scanId,
      sourceScanVersion: projection.sourceScanVersion,
      snapshotHash: projection.snapshotHash,
      draftSetHash: projection.draftSetHash,
      projectionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_VERSION,
      adoptionVersion: PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION,
      draftCount: projection.drafts.length,
      evidenceIds: projection.drafts.map((draft) => draft.evidenceId),
      createdBy: userId,
      evidenceScope: 'authorized_local_source_snapshot' as const,
      scoringDisposition: 'adopted_pending_evaluation' as const,
      productionAcceptance: false as const,
      externalScanningEnabled: false as const,
    };

    try {
      const adoption = await ProjectGradeEvidenceAdoption.create(adoptionPayload);
      await this.finishAudit(audit, 'succeeded', undefined, {
        idempotentReplay: false,
        draftCount: projection.drafts.length,
      });
      return adoption;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const racedAdoption = await ProjectGradeEvidenceAdoption.findOne(adoptionFilter);
        if (racedAdoption) {
          await this.finishAudit(audit, 'succeeded', undefined, { idempotentReplay: true });
          return racedAdoption;
        }
      }
      await this.finishAudit(audit, 'failed', error, { manifestPersisted: false });
      throw new AppError(
        503,
        'Source evidence adoption manifest could not be saved',
        'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_UNAVAILABLE',
        'ProjectGrade source evidence adoption manifest persistence failed'
      );
    }
  }

  async runProjectEvaluationFromSourceEvidence(
    projectId: string,
    userId: string,
    input: RunProjectGradeSourceEvidenceEvaluationInput
  ): Promise<IEvaluationRun> {
    if (!/^source-adoption:v1:[a-f0-9]{64}$/.test(input.adoptionId)) {
      throw new AppError(
        400,
        'adoptionId is invalid',
        'PROJECT_GRADE_INVALID_SOURCE_EVIDENCE_ADOPTION_ID'
      );
    }

    const project = await this.getProjectForUser(projectId, userId, 'admin');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot be evaluated',
        'PROJECT_GRADE_PROJECT_ARCHIVED'
      );
    }

    const tenantFilter = this.buildProjectTenantFilter(project);
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'source_evidence_evaluate',
      targetType: 'evaluation_run',
      targetId: input.adoptionId,
      toStatus: 'ready',
      metadata: {
        adoptionId: input.adoptionId,
        productionAcceptance: false,
        externalScanningEnabled: false,
      },
    });

    try {
      const adoption = await ProjectGradeEvidenceAdoption.findOne({
        ...tenantFilter,
        adoptionId: input.adoptionId,
      });
      if (!adoption) {
        throw new AppError(
          404,
          'Source evidence adoption manifest not found',
          'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_NOT_FOUND'
        );
      }

      const sourceScan = await ProjectGradeSourceScanRun.findOne({
        ...tenantFilter,
        scanId: adoption.sourceScanId,
        status: 'succeeded',
      });
      if (
        !sourceScan ||
        !sourceScan.result ||
        !sourceScan.scanVersion ||
        !sourceScan.snapshotHash
      ) {
        throw new AppError(
          409,
          'Adopted source scan is no longer available for deterministic evaluation',
          'PROJECT_GRADE_SOURCE_EVIDENCE_SCAN_UNAVAILABLE'
        );
      }

      const target = await ProjectGradeScanTarget.findOne({
        ...tenantFilter,
        targetId: adoption.targetId,
        status: 'active',
        kind: 'internal_repository',
      });
      if (
        !target ||
        target.scopeKey !== 'aibak_server_repository' ||
        target.repositoryProvider !== 'internal' ||
        sourceScan.rootKey !== target.scopeKey
      ) {
        throw new AppError(
          409,
          'Adopted source target is no longer authorized',
          'PROJECT_GRADE_SOURCE_EVIDENCE_TARGET_UNAVAILABLE'
        );
      }

      let projection: ProjectGradeSourceEvidenceProjection;
      try {
        projection = projectSourceScanEvidenceDrafts({
          scanId: sourceScan.scanId,
          projectId: sourceScan.projectId,
          ownerId: sourceScan.ownerId,
          ...(sourceScan.teamId ? { teamId: sourceScan.teamId } : {}),
          status: sourceScan.status,
          rootKey: sourceScan.rootKey,
          scanVersion: sourceScan.scanVersion,
          snapshotHash: sourceScan.snapshotHash,
          result: sourceScan.result,
          evidenceScope: sourceScan.evidenceScope,
          productionAcceptance: sourceScan.productionAcceptance,
          createdAt: sourceScan.createdAt,
        });
      } catch (error) {
        if (error instanceof ProjectGradeSourceEvidenceProjectionError) {
          throw new AppError(
            409,
            'Adopted source evidence can no longer be reconstructed',
            'PROJECT_GRADE_SOURCE_EVIDENCE_PROJECTION_REJECTED',
            error.code
          );
        }
        throw error;
      }

      let adoptedEvaluation;
      try {
        adoptedEvaluation = evaluateAdoptedSourceEvidence({ adoption, projection });
      } catch (error) {
        if (error instanceof ProjectGradeSourceEvidenceEvaluationError) {
          throw new AppError(
            409,
            'Source evidence adoption manifest no longer matches its immutable input',
            'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_REJECTED',
            error.code
          );
        }
        throw error;
      }

      const result = evaluateProjectGrade({
        projectName: project.name,
        projectType: project.projectType,
        projectUrl: project.projectUrl,
        ruleInputs: adoptedEvaluation.ruleInputs,
        findings: adoptedEvaluation.findings,
      });
      if (result.productionVerified || adoptedEvaluation.productionVerified) {
        throw new AppError(
          409,
          'Source evidence evaluation cannot assert production verification',
          'PROJECT_GRADE_SOURCE_EVIDENCE_PRODUCTION_BOUNDARY_VIOLATION'
        );
      }

      const runFilter = {
        ...tenantFilter,
        evaluationInputKind: 'source_evidence_adoption' as const,
        adoptionId: adoption.adoptionId,
      };
      let run = await EvaluationRun.findOne(runFilter);
      let idempotentReplay = Boolean(run);

      if (!run) {
        const payload = {
          ...result,
          projectId: project.projectId,
          targetId: target.targetId,
          ownerId: project.ownerId,
          teamId: project.teamId,
          createdBy: userId,
          persistenceVersion: 1,
          evaluationInputKind: 'source_evidence_adoption' as const,
          adoptionId: adoption.adoptionId,
          sourceScanId: adoption.sourceScanId,
          sourceScanVersion: adoption.sourceScanVersion,
          snapshotHash: adoption.snapshotHash,
          draftSetHash: adoption.draftSetHash,
          sourceEvidenceProjectionVersion: adoption.projectionVersion,
          sourceEvidenceAdoptionVersion: adoption.adoptionVersion,
          sourceEvidenceScoringPolicyVersion: PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
          productionVerified: false,
          projectionStatus: 'pending' as const,
        };
        try {
          run = await EvaluationRun.create(payload);
        } catch (error) {
          if (this.isDuplicateKeyError(error)) {
            run = await EvaluationRun.findOne(runFilter);
            idempotentReplay = true;
          }
          if (!run) {
            throw new AppError(
              503,
              'Source evidence evaluation run could not be saved',
              'PROJECT_GRADE_SOURCE_EVIDENCE_EVALUATION_UNAVAILABLE',
              'ProjectGrade source evidence evaluation persistence failed'
            );
          }
        }
      }

      this.assertSourceEvidenceRunMatchesAdoption(run, adoption, target);

      if (run.projectionStatus !== 'ready') {
        await this.projectEvaluationRun(run);
      }

      project.latestRunId = run.runId;
      project.latestScore = run.normalizedScore;
      project.latestGrade = run.grade;
      project.latestAssessedAt = run.assessedAt;
      project.updatedBy = userId;
      await project.save();

      await this.finishAudit(audit, 'succeeded', undefined, {
        runId: run.runId,
        idempotentReplay,
        sourceEvidenceScoringPolicyVersion: PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
        productionVerified: false,
      });
      return run;
    } catch (error) {
      await this.finishAudit(audit, 'failed', error, {
        evaluationReady: false,
        productionVerified: false,
      });
      throw error;
    }
  }

  async runProjectEvaluation(projectId: string, userId: string): Promise<IEvaluationRun> {
    const project = await this.getProjectForUser(projectId, userId, 'member');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot be evaluated',
        'PROJECT_GRADE_PROJECT_ARCHIVED'
      );
    }

    const target = await ProjectGradeScanTarget.findOne({
      projectId: project.projectId,
      status: 'active',
      kind: 'internal_repository',
    });
    if (!target) {
      throw new AppError(
        409,
        'No active Batch 0 scan target exists',
        'PROJECT_GRADE_TARGET_MISSING'
      );
    }

    const result = await this.createBaselineEvaluationRun(
      project.name,
      project.projectType,
      project.projectUrl
    );
    const run = await EvaluationRun.create({
      ...result,
      projectId: project.projectId,
      targetId: target.targetId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      createdBy: userId,
      persistenceVersion: 1,
      evaluationInputKind: 'baseline',
      projectionStatus: 'pending',
    });

    await this.projectEvaluationRun(run);

    project.latestRunId = run.runId;
    project.latestScore = run.normalizedScore;
    project.latestGrade = run.grade;
    project.latestAssessedAt = run.assessedAt;
    project.updatedBy = userId;
    await project.save();

    return run;
  }

  async listProjectEvaluationRuns(
    projectId: string,
    userId: string,
    limit = 20
  ): Promise<IEvaluationRun[]> {
    const project = await this.getProjectForUser(projectId, userId, 'viewer');
    return EvaluationRun.find({
      ...this.buildProjectTenantFilter(project),
      projectionStatus: 'ready',
    })
      .sort({ assessedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 50));
  }

  async getEvaluationRunForUser(runId: string, userId: string): Promise<IEvaluationRun> {
    const candidate = await EvaluationRun.findOne({ runId, projectionStatus: 'ready' });
    if (!candidate || !candidate.projectId) {
      throw new AppError(
        404,
        'ProjectGrade evaluation run not found',
        'PROJECT_GRADE_RUN_NOT_FOUND'
      );
    }
    const project = await this.getProjectForUser(candidate.projectId, userId, 'viewer');
    const run = await EvaluationRun.findOne({
      ...this.buildProjectTenantFilter(project),
      runId,
      projectionStatus: 'ready',
    });
    if (!run) {
      throw new AppError(
        404,
        'ProjectGrade evaluation run not found',
        'PROJECT_GRADE_RUN_NOT_FOUND'
      );
    }
    return run;
  }
  async listProjectReports(
    projectId: string,
    userId: string,
    limit = 50
  ): Promise<ProjectGradeReportListItem[]> {
    const project = await this.getProjectForUser(projectId, userId, 'viewer');
    const reports = await ProjectGradeReport.find(this.buildProjectReportFilter(project))
      .sort({ publishedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
    return reports.map((report) => this.toReportListItem(report));
  }

  async publishProjectReport(
    projectId: string,
    runId: string,
    userId: string,
    input: PublishProjectGradeReportInput = {}
  ): Promise<ProjectGradeReportListItem> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    if (project.status !== 'active') {
      throw new AppError(
        409,
        'Archived projects cannot publish reports',
        'PROJECT_GRADE_REPORT_PROJECT_ARCHIVED'
      );
    }

    const { plan } = await resolveUserPlan(userId);
    const reportEntitlement = PLANS[plan].projectGrade;
    if (!reportEntitlement.reportPublishEnabled || reportEntitlement.reportValidityDays <= 0) {
      throw new AppError(
        402,
        '当前套餐不包含智评通正式报告发布权益，请升级套餐',
        'PROJECT_GRADE_REPORT_PUBLISH_PLAN_REQUIRED'
      );
    }

    const reportFilter = this.buildProjectReportFilter(project);
    const existing = await ProjectGradeReport.findOne({ ...reportFilter, runId });
    const now = new Date();
    if (existing?.isPublic && existing.expiresAt.getTime() > now.getTime()) {
      throw new AppError(
        409,
        'This evaluation run already has an active public report',
        'PROJECT_GRADE_REPORT_ALREADY_PUBLISHED'
      );
    }

    const run = await EvaluationRun.findOne({
      ...this.buildProjectTenantFilter(project),
      runId,
      projectionStatus: 'ready',
    });
    if (!run) {
      throw new AppError(
        404,
        'ProjectGrade evaluation run not found or projection is not ready',
        'PROJECT_GRADE_REPORT_RUN_NOT_READY'
      );
    }
    if (!['website', 'saas', 'ai_application'].includes(run.projectType)) {
      throw new AppError(
        409,
        'This project type is not supported by the public report contract',
        'PROJECT_GRADE_REPORT_PROJECT_TYPE_UNSUPPORTED'
      );
    }

    const [snapshots, findings] = await Promise.all([
      ProjectGradeScoreSnapshot.find({
        ...this.buildProjectTenantFilter(project),
        runId,
      }).sort({ dimensionKey: 1 }),
      ProjectGradeFindingModel.find({
        ...this.buildProjectTenantFilter(project),
        runId,
      }),
    ]);
    if (snapshots.length === 0) {
      throw new AppError(
        409,
        'Evaluation score projection is not available for report publication',
        'PROJECT_GRADE_REPORT_SCORE_PROJECTION_MISSING'
      );
    }

    const dimensionSnapshot: PublicReportDimensionRow[] = snapshots
      .map((snapshot) => ({
        dimensionKey: snapshot.dimensionKey,
        label: snapshot.label,
        weight: snapshot.weight,
        rawScore: snapshot.rawScore,
        normalizedScore: snapshot.normalizedScore,
      }))
      .sort((left, right) => left.dimensionKey.localeCompare(right.dimensionKey));
    const findingHighlights: PublicReportFindingHighlight[] = findings
      .map((finding) => ({
        severity: finding.severity,
        dimensionKey: finding.dimensionKey,
        title: finding.title,
      }))
      .sort((left, right) => {
        const severityDifference =
          PROJECT_GRADE_REPORT_SEVERITY_RANK[left.severity] -
          PROJECT_GRADE_REPORT_SEVERITY_RANK[right.severity];
        if (severityDifference !== 0) return severityDifference;
        const dimensionDifference = left.dimensionKey.localeCompare(right.dimensionKey);
        return dimensionDifference !== 0
          ? dimensionDifference
          : left.title.localeCompare(right.title);
      })
      .slice(0, PROJECT_GRADE_REPORT_FINDING_LIMIT);

    const title =
      existing?.title || input.title?.trim() || `${project.name} · AIbak 智评通正式评估报告`;
    const projectKind = run.projectType as 'website' | 'saas' | 'ai_application';
    const gateBlocked =
      run.releaseGate.highestSeverity === 'NONE' ? null : run.releaseGate.highestSeverity;
    const reportContent = {
      publicationVersion: PROJECT_GRADE_REPORT_PUBLICATION_VERSION,
      runId: run.runId,
      projectId: project.projectId,
      projectName: project.name,
      projectKind,
      title,
      verdict: run.grade,
      externalScore: run.normalizedScore,
      internalScore: run.finalTotalScore,
      gateBlocked,
      dimensionSnapshot,
      findingHighlights,
    };
    const contentFingerprint = this.computeProjectGradeReportFingerprint(reportContent);
    if (existing) {
      const existingFingerprint =
        existing.contentFingerprint ||
        this.computeProjectGradeReportFingerprint({
          publicationVersion: existing.publicationVersion,
          runId: existing.runId,
          projectId: existing.projectId,
          projectName: existing.projectName,
          projectKind: existing.projectKind,
          title: existing.title,
          verdict: existing.verdict,
          externalScore: existing.externalScore,
          internalScore: existing.internalScore,
          gateBlocked: existing.gateBlocked,
          dimensionSnapshot: existing.dimensionSnapshot,
          findingHighlights: existing.findingHighlights,
        });
      if (existingFingerprint !== contentFingerprint) {
        throw new AppError(
          409,
          'The stored immutable report no longer matches this evaluation projection; create a new evaluation run',
          'PROJECT_GRADE_REPORT_CONTENT_MISMATCH'
        );
      }
    }

    const publishedAt = new Date();
    const expiresAt = new Date(
      publishedAt.getTime() + reportEntitlement.reportValidityDays * 24 * 60 * 60 * 1000
    );
    const publicId = existing?.publicId || this.generateProjectGradePublicReportId();
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'report_publish',
      targetType: 'report',
      targetId: publicId,
      fromStatus: existing ? (existing.revokedAt ? 'revoked' : 'expired') : 'unpublished',
      toStatus: 'public',
      metadata: {
        runId,
        plan,
        reportValidityDays: reportEntitlement.reportValidityDays,
        contentFingerprint,
      },
    });

    try {
      let report: IPublicReportDocument;
      if (existing) {
        existing.isPublic = true;
        existing.publishedAt = publishedAt;
        existing.publishedBy = userId;
        existing.expiresAt = expiresAt;
        existing.revokedAt = undefined;
        existing.revokedBy = undefined;
        existing.revocationReason = undefined;
        report = await existing.save();
      } else {
        report = await ProjectGradeReport.create({
          reportId: randomUUID(),
          publicId,
          runId: run.runId,
          projectId: project.projectId,
          tenantId: project.teamId || project.ownerId,
          ownerUserId: project.ownerId,
          publicationVersion: PROJECT_GRADE_REPORT_PUBLICATION_VERSION,
          contentFingerprint,
          title,
          projectName: project.name,
          projectKind,
          verdict: run.grade,
          externalScore: run.normalizedScore,
          internalScore: run.finalTotalScore,
          gateBlocked,
          dimensionSnapshot,
          findingHighlights,
          assessmentScope: {
            mode: run.evaluationInputKind,
            target: project.projectUrl ? 'registered_project_target' : undefined,
            note: PROJECT_GRADE_REPORT_SCOPE_NOTE,
          },
          baselineNote:
            run.evaluationInputKind === 'baseline'
              ? '该报告基于服务端授权的内部仓库基线证据，不构成生产环境验收。'
              : undefined,
          isPublic: true,
          publishedAt,
          publishedBy: userId,
          expiresAt,
          sharedCount: 0,
          immutable: true,
        });
      }
      await this.finishAudit(audit, 'succeeded', undefined, {
        reportId: report.reportId,
        publicId: report.publicId,
        expiresAt: report.expiresAt.toISOString(),
      });
      return this.toReportListItem(report);
    } catch (error) {
      const conflict = this.isDuplicateKeyError(error)
        ? new AppError(
            409,
            'This evaluation run already has a report',
            'PROJECT_GRADE_REPORT_ALREADY_EXISTS'
          )
        : error;
      await this.finishAudit(audit, 'failed', conflict);
      throw conflict;
    }
  }

  async listProjectReportDeliveries(
    projectId: string,
    publicId: string,
    userId: string,
    limit = 50
  ): Promise<ProjectGradeReportDeliveryListItem[]> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    const report = await ProjectGradeReport.findOne({
      ...this.buildProjectReportFilter(project),
      publicId,
    });
    if (!report) {
      throw new AppError(404, 'ProjectGrade report not found', 'PROJECT_GRADE_REPORT_NOT_FOUND');
    }
    const deliveries = await ProjectGradeReportDelivery.find({
      projectId: project.projectId,
      tenantId: project.teamId || project.ownerId,
      ownerUserId: project.ownerId,
      reportId: report.reportId,
    })
      .sort({ deliveredAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
    return deliveries.map((delivery) => this.toReportDeliveryListItem(delivery));
  }

  async deliverProjectReportPdf(
    projectId: string,
    publicId: string,
    userId: string
  ): Promise<ProjectGradeReportPdfDeliveryResult> {
    const project = await this.getProjectForUser(projectId, userId, 'viewer');
    const { plan } = await resolveUserPlan(userId);
    const entitlement = PLANS[plan].projectGrade;
    if (!entitlement.reportDownloadEnabled) {
      throw new AppError(
        402,
        '当前套餐不包含智评通正式报告 PDF 下载权益，请升级套餐',
        'PROJECT_GRADE_REPORT_DOWNLOAD_PLAN_REQUIRED'
      );
    }

    const report = await ProjectGradeReport.findOne({
      ...this.buildProjectReportFilter(project),
      publicId,
    });
    if (!report) {
      throw new AppError(404, 'ProjectGrade report not found', 'PROJECT_GRADE_REPORT_NOT_FOUND');
    }
    const now = new Date();
    if (!report.isPublic || report.revokedAt) {
      throw new AppError(
        409,
        '该正式报告已撤销，请重新发布后再下载',
        'PROJECT_GRADE_REPORT_DOWNLOAD_REVOKED'
      );
    }
    if (report.expiresAt.getTime() <= now.getTime()) {
      throw new AppError(
        410,
        '该正式报告已过期，请重新发布后再下载',
        'PROJECT_GRADE_REPORT_DOWNLOAD_EXPIRED'
      );
    }
    if (!report.contentFingerprint) {
      throw new AppError(
        409,
        '该报告缺少不可变内容指纹，无法作为正式 PDF 交付',
        'PROJECT_GRADE_REPORT_FINGERPRINT_MISSING'
      );
    }

    const deliveryId = randomUUID();
    const branding = entitlement.removeAibakBranding ? 'white_label' : 'aibak';
    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'report_download',
      targetType: 'report',
      targetId: publicId,
      fromStatus: 'public',
      toStatus: 'delivered',
      metadata: {
        deliveryId,
        reportId: report.reportId,
        plan,
        format: 'pdf',
        branding,
        contentFingerprint: report.contentFingerprint,
      },
    });

    try {
      const artifact = await this.reportPdfRenderer(report, { branding, generatedAt: now });
      const delivery = await ProjectGradeReportDelivery.create({
        deliveryId,
        reportId: report.reportId,
        publicId: report.publicId,
        runId: report.runId,
        projectId: project.projectId,
        tenantId: project.teamId || project.ownerId,
        ownerUserId: project.ownerId,
        requestedBy: userId,
        format: 'pdf',
        planId: plan,
        branding,
        contentFingerprint: report.contentFingerprint,
        documentFingerprint: artifact.documentFingerprint,
        fileName: artifact.fileName,
        byteLength: artifact.byteLength,
        reportPublishedAt: report.publishedAt,
        reportExpiresAt: report.expiresAt,
        deliveredAt: artifact.generatedAt,
      });
      await this.finishAudit(audit, 'succeeded', undefined, {
        documentFingerprint: artifact.documentFingerprint,
        byteLength: artifact.byteLength,
        fileName: artifact.fileName,
      });
      return { artifact, delivery: this.toReportDeliveryListItem(delivery) };
    } catch (error) {
      const safeError =
        error instanceof AppError
          ? error
          : new AppError(
              503,
              '正式报告 PDF 暂时无法生成，请稍后重试',
              'PROJECT_GRADE_REPORT_PDF_UNAVAILABLE'
            );
      await this.finishAudit(audit, 'failed', safeError);
      throw safeError;
    }
  }

  async revokeProjectReport(
    projectId: string,
    publicId: string,
    userId: string,
    reason: string
  ): Promise<ProjectGradeReportListItem> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    const report = await ProjectGradeReport.findOne({
      ...this.buildProjectReportFilter(project),
      publicId,
    });
    if (!report) {
      throw new AppError(404, 'ProjectGrade report not found', 'PROJECT_GRADE_REPORT_NOT_FOUND');
    }
    if (!report.isPublic) {
      throw new AppError(
        409,
        'ProjectGrade report is already revoked',
        'PROJECT_GRADE_REPORT_ALREADY_REVOKED'
      );
    }

    const audit = await this.beginAudit({
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'report_revoke',
      targetType: 'report',
      targetId: report.publicId,
      fromStatus: 'public',
      toStatus: 'revoked',
      reason,
      metadata: { runId: report.runId, contentFingerprint: report.contentFingerprint },
    });

    try {
      report.isPublic = false;
      report.revokedAt = new Date();
      report.revokedBy = userId;
      report.revocationReason = reason;
      const saved = await report.save();
      await this.finishAudit(audit, 'succeeded', undefined, { reportId: saved.reportId });
      return this.toReportListItem(saved);
    } catch (error) {
      await this.finishAudit(audit, 'failed', error);
      throw error;
    }
  }

  async listProjectEvidence(
    projectId: string,
    userId: string,
    limit = 50
  ): Promise<IProjectGradeEvidence[]> {
    await this.getProjectForUser(projectId, userId, 'viewer');
    return ProjectGradeEvidenceModel.find({ projectId })
      .sort({ collectedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async listProjectFindings(
    projectId: string,
    userId: string,
    limit = 50
  ): Promise<IProjectGradeFinding[]> {
    await this.getProjectForUser(projectId, userId, 'viewer');
    return ProjectGradeFindingModel.find({ projectId })
      .sort({ detectedAt: -1, severity: 1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async listProjectRemediations(
    projectId: string,
    userId: string,
    limit = 50
  ): Promise<IProjectGradeRemediationTask[]> {
    await this.getProjectForUser(projectId, userId, 'viewer');
    return ProjectGradeRemediationTask.find({ projectId })
      .sort({ updatedAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async listProjectAudit(
    projectId: string,
    userId: string,
    limit = 50
  ): Promise<IProjectGradeAuditLog[]> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    return ProjectGradeAuditLog.find(this.buildProjectTenantFilter(project))
      .sort({ createdAt: -1 })
      .limit(Math.min(Math.max(limit, 1), 100));
  }

  async createRemediationTask(
    projectId: string,
    findingId: string,
    userId: string,
    input: CreateProjectGradeRemediationInput = {}
  ): Promise<IProjectGradeRemediationTask> {
    const project = await this.getProjectForUser(projectId, userId, 'member');
    const finding = await ProjectGradeFindingModel.findOne({ projectId, findingId });
    if (!finding) {
      throw new AppError(404, 'ProjectGrade finding not found', 'PROJECT_GRADE_FINDING_NOT_FOUND');
    }
    if (['verified', 'accepted_risk', 'false_positive'].includes(finding.currentStatus)) {
      throw new AppError(
        409,
        'Resolved or excepted findings cannot create remediation tasks',
        'PROJECT_GRADE_FINDING_NOT_REMEDIABLE'
      );
    }

    const sourceRun = await EvaluationRun.findOne({ runId: finding.runId, projectId });
    if (!sourceRun || sourceRun.projectionStatus !== 'ready') {
      throw new AppError(
        409,
        'Finding source projection is not ready',
        'PROJECT_GRADE_PROJECTION_NOT_READY'
      );
    }

    const existing = await ProjectGradeRemediationTask.findOne({ projectId, findingId });
    if (existing) return existing;

    if (input.assigneeId) await this.assertValidAssignee(project, input.assigneeId);
    const slaHours = input.slaHours ?? REMEDIATION_SLA_HOURS[finding.severity];
    const dueAt = input.dueAt ?? new Date(Date.now() + slaHours * 60 * 60 * 1000);
    const audit = await this.beginAudit({
      projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'remediation_create',
      targetType: 'finding',
      targetId: findingId,
      toStatus: 'open',
      metadata: { assigneeId: input.assigneeId, dueAt, slaHours },
    });
    try {
      const task = await ProjectGradeRemediationTask.create({
        projectId,
        sourceRunId: finding.runId,
        findingId: finding.findingId,
        findingFingerprint: finding.fingerprint,
        ownerId: project.ownerId,
        teamId: project.teamId,
        assigneeId: input.assigneeId,
        severity: finding.severity,
        title: finding.title,
        description: finding.description,
        recommendation: finding.recommendation,
        status: 'open',
        dueAt,
        slaHours,
        createdBy: userId,
        updatedBy: userId,
      });
      await this.finishAudit(audit, 'succeeded', undefined, { taskId: task.taskId });
      return task;
    } catch (error) {
      if (this.isDuplicateKeyError(error)) {
        const concurrentTask = await ProjectGradeRemediationTask.findOne({ projectId, findingId });
        if (concurrentTask) {
          await this.finishAudit(audit, 'succeeded', undefined, {
            taskId: concurrentTask.taskId,
            concurrentDuplicateRecovered: true,
          });
          return concurrentTask;
        }
      }
      await this.finishAudit(audit, 'failed', error);
      throw error;
    }
  }

  async updateRemediationTask(
    projectId: string,
    taskId: string,
    userId: string,
    input: UpdateProjectGradeRemediationInput
  ): Promise<IProjectGradeRemediationTask> {
    const project = await this.getProjectForUser(projectId, userId, 'member');
    const task = await ProjectGradeRemediationTask.findOne({ projectId, taskId });
    if (!task) {
      throw new AppError(
        404,
        'ProjectGrade remediation task not found',
        'PROJECT_GRADE_REMEDIATION_NOT_FOUND'
      );
    }

    const audit = await this.beginAudit({
      projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'remediation_update',
      targetType: 'remediation',
      targetId: taskId,
      fromStatus: task.status,
      toStatus: input.status || task.status,
      reason: input.completionNote,
      metadata: {
        assigneeId: input.assigneeId,
        dueAt: input.dueAt,
        slaHours: input.slaHours,
        retestRunId: input.retestRunId,
      },
    });
    try {
      if (input.assigneeId !== undefined) {
        if (input.assigneeId) await this.assertValidAssignee(project, input.assigneeId);
        task.assigneeId = input.assigneeId || undefined;
      }
      if (input.dueAt !== undefined) task.dueAt = input.dueAt || undefined;
      if (input.slaHours !== undefined) task.slaHours = input.slaHours || undefined;
      if (input.completionNote !== undefined) task.completionNote = input.completionNote;
      if (input.retestRunId !== undefined) task.retestRunId = input.retestRunId || undefined;

      if (input.status && input.status !== task.status) {
        if (!REMEDIATION_TRANSITIONS[task.status].includes(input.status)) {
          throw new AppError(
            409,
            `Invalid remediation transition ${task.status} -> ${input.status}`,
            'PROJECT_GRADE_INVALID_REMEDIATION_TRANSITION'
          );
        }
        if (input.status === 'verified') await this.assertRemediationVerified(projectId, task);
        task.status = input.status;
        task.verifiedAt = input.status === 'verified' ? new Date() : undefined;
        await this.updateFindingFromRemediation(task, userId);
      }

      task.updatedBy = userId;
      await task.save();
      await this.finishAudit(audit, 'succeeded');
      return task;
    } catch (error) {
      await this.finishAudit(audit, 'failed', error);
      throw error;
    }
  }

  async updateFindingWorkflow(
    projectId: string,
    findingId: string,
    userId: string,
    input: UpdateProjectGradeFindingWorkflowInput
  ): Promise<IProjectGradeFinding> {
    const project = await this.getProjectForUser(projectId, userId, 'admin');
    const finding = await ProjectGradeFindingModel.findOne({ projectId, findingId });
    if (!finding) {
      throw new AppError(404, 'ProjectGrade finding not found', 'PROJECT_GRADE_FINDING_NOT_FOUND');
    }
    const note = input.note.trim();
    if (!note) {
      throw new AppError(
        400,
        'Finding workflow note is required',
        'PROJECT_GRADE_FINDING_NOTE_REQUIRED'
      );
    }

    const audit = await this.beginAudit({
      projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'finding_workflow_update',
      targetType: 'finding',
      targetId: findingId,
      fromStatus: finding.currentStatus,
      toStatus: input.status,
      reason: note,
    });
    try {
      finding.currentStatus = input.status;
      finding.resolutionNote = note;
      finding.workflowUpdatedBy = userId;
      finding.workflowUpdatedAt = new Date();
      await finding.save();
      await this.finishAudit(audit, 'succeeded');
      return finding;
    } catch (error) {
      await this.finishAudit(audit, 'failed', error);
      throw error;
    }
  }

  async recoverExpiredEvaluationProjections(
    options: RecoverExpiredProjectGradeProjectionsOptions = {}
  ): Promise<RecoverExpiredProjectGradeProjectionsReport> {
    const now = options.now ? new Date(options.now) : new Date();
    const requestedLimit = Number.isInteger(options.limit) ? Number(options.limit) : 20;
    const limit = Math.min(100, Math.max(1, requestedLimit));
    const actorId = options.actorId?.trim() || 'system:project-grade-projection-recovery';
    const expiredRuns = await EvaluationRun.find({
      projectionStatus: 'projecting',
      projectionLeaseExpiresAt: { $lte: now },
      projectId: { $exists: true },
      targetId: { $exists: true },
      ownerId: { $exists: true },
    })
      .sort({ projectionLeaseExpiresAt: 1, assessedAt: 1 })
      .limit(limit);

    const report: RecoverExpiredProjectGradeProjectionsReport = {
      scanned: expiredRuns.length,
      recovered: 0,
      skipped: 0,
      failed: 0,
      failures: [],
    };

    for (const run of expiredRuns) {
      if (!run.projectId || !run.targetId || !run.ownerId) {
        report.failed += 1;
        report.failures.push({
          runId: run.runId,
          code: 'PROJECT_GRADE_PROJECTION_CONTEXT_MISSING',
        });
        continue;
      }

      let audit: ProjectGradeAuditContext;
      try {
        audit = await this.beginAudit({
          projectId: run.projectId,
          ownerId: run.ownerId,
          teamId: run.teamId,
          actorId,
          action: 'projection_recovery',
          targetType: 'evaluation_run',
          targetId: run.runId,
          fromStatus: 'projecting',
          toStatus: 'ready',
          metadata: {
            previousProjectionAttemptId: run.projectionAttemptId,
            previousProjectionLeaseExpiresAt: run.projectionLeaseExpiresAt?.toISOString(),
          },
        });
      } catch (error) {
        report.failed += 1;
        report.failures.push({
          runId: run.runId,
          code: error instanceof AppError ? error.code : 'PROJECT_GRADE_AUDIT_UNAVAILABLE',
        });
        continue;
      }

      try {
        const recovered = await this.projectEvaluationRun(run);
        if (recovered) {
          report.recovered += 1;
        } else {
          report.skipped += 1;
        }
        await this.finishAudit(audit, 'succeeded', undefined, {
          recovered,
          projectionAttemptId: run.projectionAttemptId,
          skipReason: recovered ? undefined : 'already_ready',
        });
      } catch (error) {
        if (error instanceof AppError && error.code === 'PROJECT_GRADE_PROJECTION_IN_PROGRESS') {
          report.skipped += 1;
          await this.finishAudit(audit, 'succeeded', undefined, {
            recovered: false,
            skipReason: 'lease_reacquired_elsewhere',
          });
          continue;
        }
        report.failed += 1;
        report.failures.push({
          runId: run.runId,
          code: error instanceof AppError ? error.code : 'PROJECT_GRADE_PROJECTION_RECOVERY_FAILED',
        });
        await this.finishAudit(audit, 'failed', error, { recovered: false });
      }
    }

    return report;
  }

  async rebuildEvaluationProjection(runId: string, userId: string): Promise<IEvaluationRun> {
    const run = await EvaluationRun.findOne({ runId });
    if (!run || !run.projectId) {
      throw new AppError(
        404,
        'ProjectGrade evaluation run not found',
        'PROJECT_GRADE_RUN_NOT_FOUND'
      );
    }
    const project = await this.getProjectForUser(run.projectId, userId, 'admin');
    const audit = await this.beginAudit({
      projectId: run.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId,
      actorId: userId,
      action: 'projection_rebuild',
      targetType: 'evaluation_run',
      targetId: runId,
      fromStatus: run.projectionStatus,
      toStatus: 'ready',
    });
    try {
      await this.projectEvaluationRun(run, { allowReadyRebuild: true });
      await this.finishAudit(audit, 'succeeded');
      return run;
    } catch (error) {
      await this.finishAudit(audit, 'failed', error);
      throw error;
    }
  }

  private async projectEvaluationRun(
    run: IEvaluationRun,
    options: { allowReadyRebuild?: boolean } = {}
  ): Promise<boolean> {
    const projectId = run.projectId;
    const targetId = run.targetId;
    const ownerId = run.ownerId;
    if (!projectId || !targetId || !ownerId) {
      throw new AppError(
        500,
        'Persisted ProjectGrade run is missing projection ownership',
        'PROJECT_GRADE_PROJECTION_CONTEXT_MISSING'
      );
    }

    const common = {
      runId: run.runId,
      projectId,
      targetId,
      ownerId,
      teamId: run.teamId,
      rulePackKey: run.rulePackKey,
      rulePackVersion: run.rulePackVersion,
      projectionVersion: PROJECT_GRADE_PROJECTION_VERSION,
    };

    const projectionAttemptId = await this.acquireProjectionLease(
      run,
      options.allowReadyRebuild === true
    );
    if (!projectionAttemptId) return false;

    try {
      await this.renewProjectionLease(run.runId, projectionAttemptId);
      await this.clearEvaluationProjection(run.runId);

      if (run.evidence.length) {
        await this.renewProjectionLease(run.runId, projectionAttemptId);
        await ProjectGradeEvidenceModel.bulkWrite(
          run.evidence.map((evidence) => ({
            updateOne: {
              filter: { runId: run.runId, evidenceId: evidence.id },
              update: {
                $set: {
                  ...common,
                  evidenceId: evidence.id,
                  ruleKey: evidence.ruleKey,
                  dimensionKey: evidence.dimensionKey,
                  level: evidence.level,
                  factor: evidence.factor,
                  sourceType: evidence.sourceType,
                  source: evidence.source,
                  collectedAt: new Date(evidence.collectedAt),
                  verifiedAt: evidence.verifiedAt ? new Date(evidence.verifiedAt) : undefined,
                  title: evidence.title,
                  description: evidence.description,
                  metadata: evidence.metadata,
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      if (run.findings.length) {
        await this.renewProjectionLease(run.runId, projectionAttemptId);
        await ProjectGradeFindingModel.bulkWrite(
          run.findings.map((finding) => ({
            updateOne: {
              filter: { runId: run.runId, fingerprint: finding.fingerprint },
              update: {
                $set: {
                  ...common,
                  findingId: finding.id,
                  fingerprint: finding.fingerprint,
                  fingerprintVersion: finding.fingerprintVersion,
                  ruleKey: finding.ruleKey,
                  dimensionKey: finding.dimensionKey,
                  severity: finding.severity,
                  snapshotStatus: finding.status,
                  title: finding.title,
                  description: finding.description,
                  recommendation: finding.recommendation,
                  evidenceIds: finding.evidenceIds,
                  detectedAt: new Date(finding.createdAt),
                },
                $setOnInsert: {
                  currentStatus: this.workflowStatusFromSnapshot(finding.status),
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      if (run.snapshots.length) {
        await this.renewProjectionLease(run.runId, projectionAttemptId);
        await ProjectGradeScoreSnapshot.bulkWrite(
          run.snapshots.map((snapshot) => ({
            updateOne: {
              filter: { runId: run.runId, dimensionKey: snapshot.dimensionKey },
              update: {
                $set: {
                  ...common,
                  snapshotId: `${run.runId}:${snapshot.dimensionKey}`,
                  dimensionKey: snapshot.dimensionKey,
                  label: snapshot.label,
                  weight: snapshot.weight,
                  rawScore: snapshot.rawScore,
                  normalizedScore: snapshot.normalizedScore,
                  rules: snapshot.rules,
                  assessedAt: new Date(run.assessedAt),
                },
              },
              upsert: true,
            },
          })),
          { ordered: false }
        );
      }

      const projectedAt = new Date();
      const readyResult = await EvaluationRun.updateOne(
        {
          runId: run.runId,
          projectionStatus: 'projecting',
          projectionAttemptId,
        },
        {
          $set: { projectionStatus: 'ready', projectedAt },
          $unset: { projectionError: 1, projectionLeaseExpiresAt: 1 },
        }
      );
      if (!this.updateMatched(readyResult)) {
        throw new ProjectGradeProjectionLeaseLostError();
      }
      run.projectionStatus = 'ready';
      run.projectedAt = projectedAt;
      run.projectionError = undefined;
      run.projectionLeaseExpiresAt = undefined;
      return true;
    } catch (error) {
      if (error instanceof ProjectGradeProjectionLeaseLostError) {
        throw this.projectionInProgressError();
      }

      const projectionError = this.sanitizeProjectionError(error);
      try {
        await this.renewProjectionLease(run.runId, projectionAttemptId);
      } catch (leaseError) {
        if (leaseError instanceof ProjectGradeProjectionLeaseLostError) {
          throw this.projectionInProgressError();
        }
        throw leaseError;
      }

      await this.clearEvaluationProjection(run.runId).catch((cleanupError) => {
        logger.error('project-grade', '无法清理 ProjectGrade 失败投影', {
          runId: run.runId,
          message: this.sanitizeProjectionError(cleanupError),
        });
      });

      let failedResult: unknown;
      try {
        failedResult = await EvaluationRun.updateOne(
          {
            runId: run.runId,
            projectionStatus: 'projecting',
            projectionAttemptId,
          },
          {
            $set: { projectionStatus: 'failed', projectionError },
            $unset: { projectedAt: 1, projectionLeaseExpiresAt: 1 },
          }
        );
      } catch (updateError) {
        logger.error('project-grade', '无法记录 ProjectGrade 投影失败状态', {
          runId: run.runId,
          message: this.sanitizeProjectionError(updateError),
        });
      }
      if (failedResult !== undefined && !this.updateMatched(failedResult)) {
        throw this.projectionInProgressError();
      }

      run.projectionStatus = 'failed';
      run.projectedAt = undefined;
      run.projectionError = projectionError;
      run.projectionLeaseExpiresAt = undefined;
      throw new AppError(
        503,
        'ProjectGrade evaluation was saved but its query projection failed',
        'PROJECT_GRADE_PROJECTION_FAILED'
      );
    }
  }

  private async acquireProjectionLease(
    run: IEvaluationRun,
    allowReadyRebuild: boolean
  ): Promise<string | undefined> {
    const projectionStartedAt = new Date();
    const projectionLeaseExpiresAt = new Date(
      projectionStartedAt.getTime() + PROJECT_GRADE_PROJECTION_LEASE_MS
    );
    const projectionAttemptId = `projection-attempt:v1:${randomBytes(32).toString('hex')}`;
    const eligibleStatuses: Record<string, unknown>[] = [
      { projectionStatus: 'pending' },
      { projectionStatus: 'failed' },
      {
        projectionStatus: 'projecting',
        projectionLeaseExpiresAt: { $lte: projectionStartedAt },
      },
    ];
    if (allowReadyRebuild) eligibleStatuses.push({ projectionStatus: 'ready' });

    const result = await EvaluationRun.updateOne(
      { runId: run.runId, $or: eligibleStatuses },
      {
        $set: {
          projectionStatus: 'projecting',
          projectionAttemptId,
          projectionStartedAt,
          projectionLeaseExpiresAt,
        },
        $unset: { projectedAt: 1, projectionError: 1 },
      }
    );

    if (this.updateMatched(result)) {
      run.projectionStatus = 'projecting';
      run.projectionAttemptId = projectionAttemptId;
      run.projectionStartedAt = projectionStartedAt;
      run.projectionLeaseExpiresAt = projectionLeaseExpiresAt;
      run.projectedAt = undefined;
      run.projectionError = undefined;
      return projectionAttemptId;
    }

    const current = await EvaluationRun.findOne({ runId: run.runId });
    if (current?.projectionStatus === 'ready' && !allowReadyRebuild) {
      run.projectionStatus = 'ready';
      run.projectedAt = current.projectedAt;
      run.projectionError = undefined;
      run.projectionAttemptId = current.projectionAttemptId;
      run.projectionStartedAt = current.projectionStartedAt;
      run.projectionLeaseExpiresAt = undefined;
      return undefined;
    }
    throw this.projectionInProgressError();
  }

  private async renewProjectionLease(runId: string, projectionAttemptId: string): Promise<void> {
    const projectionLeaseExpiresAt = new Date(Date.now() + PROJECT_GRADE_PROJECTION_LEASE_MS);
    const result = await EvaluationRun.updateOne(
      { runId, projectionStatus: 'projecting', projectionAttemptId },
      { $set: { projectionLeaseExpiresAt } }
    );
    if (!this.updateMatched(result)) {
      throw new ProjectGradeProjectionLeaseLostError();
    }
  }

  private updateMatched(result: unknown): boolean {
    if (!result || typeof result !== 'object') return false;
    const updateResult = result as { matchedCount?: number; modifiedCount?: number };
    return (
      updateResult.matchedCount === 1 ||
      (updateResult.matchedCount === undefined && updateResult.modifiedCount === 1)
    );
  }

  private projectionInProgressError(): AppError {
    return new AppError(
      409,
      'ProjectGrade evaluation projection is already in progress',
      'PROJECT_GRADE_PROJECTION_IN_PROGRESS'
    );
  }

  private async clearEvaluationProjection(runId: string): Promise<void> {
    await Promise.all([
      ProjectGradeEvidenceModel.deleteMany({ runId }),
      ProjectGradeFindingModel.deleteMany({ runId }),
      ProjectGradeScoreSnapshot.deleteMany({ runId }),
    ]);
  }

  private async assertRemediationVerified(
    projectId: string,
    task: IProjectGradeRemediationTask
  ): Promise<void> {
    if (!task.retestRunId || task.retestRunId === task.sourceRunId) {
      throw new AppError(
        409,
        'A distinct retest run is required before verification',
        'PROJECT_GRADE_RETEST_REQUIRED'
      );
    }
    const [sourceRun, retestRun] = await Promise.all([
      EvaluationRun.findOne({ runId: task.sourceRunId, projectId }),
      EvaluationRun.findOne({ runId: task.retestRunId, projectId }),
    ]);
    if (!sourceRun || !retestRun || retestRun.projectionStatus !== 'ready') {
      throw new AppError(409, 'Retest projection is not ready', 'PROJECT_GRADE_RETEST_NOT_READY');
    }
    if (new Date(retestRun.assessedAt).getTime() <= new Date(sourceRun.assessedAt).getTime()) {
      throw new AppError(
        409,
        'Retest must be newer than the source run',
        'PROJECT_GRADE_RETEST_NOT_NEWER'
      );
    }
    const recurringFinding = await ProjectGradeFindingModel.findOne({
      projectId,
      runId: task.retestRunId,
      fingerprint: task.findingFingerprint,
    });
    if (recurringFinding) {
      throw new AppError(
        409,
        'The same finding fingerprint is still present in the retest run',
        'PROJECT_GRADE_FINDING_STILL_PRESENT'
      );
    }
  }

  private async updateFindingFromRemediation(
    task: IProjectGradeRemediationTask,
    userId: string
  ): Promise<void> {
    const finding = await ProjectGradeFindingModel.findOne({
      projectId: task.projectId,
      findingId: task.findingId,
    });
    if (!finding) return;

    const workflowStatus: ProjectGradeFindingWorkflowStatus =
      task.status === 'verified'
        ? 'verified'
        : task.status === 'ready_for_retest'
          ? 'ready_for_retest'
          : task.status === 'cancelled'
            ? 'open'
            : task.status === 'open'
              ? 'open'
              : 'in_progress';
    finding.currentStatus = workflowStatus;
    finding.workflowUpdatedBy = userId;
    finding.workflowUpdatedAt = new Date();
    finding.resolutionNote = task.completionNote;
    await finding.save();
  }

  private workflowStatusFromSnapshot(
    status: ProjectGradeFinding['status']
  ): ProjectGradeFindingWorkflowStatus {
    if (status === 'accepted') return 'accepted_risk';
    if (status === 'resolved') return 'verified';
    if (status === 'false_positive') return 'false_positive';
    return 'open';
  }

  private async assertValidAssignee(
    project: IProjectGradeProject,
    assigneeId: string
  ): Promise<void> {
    if (!project.teamId) {
      if (project.ownerId !== assigneeId) {
        throw new AppError(
          403,
          'Personal project assignee must be its owner',
          'PROJECT_GRADE_ASSIGNEE_FORBIDDEN'
        );
      }
      return;
    }
    await this.assertTeamRole(project.teamId, assigneeId, 'viewer');
  }

  private assertSourceEvidenceRunMatchesAdoption(
    run: IEvaluationRun,
    adoption: IProjectGradeEvidenceAdoption,
    target: IProjectGradeScanTarget
  ): void {
    const actual = run as unknown as Record<string, unknown>;
    const expected: Record<string, unknown> = {
      evaluationInputKind: 'source_evidence_adoption',
      projectId: adoption.projectId,
      targetId: target.targetId,
      ownerId: adoption.ownerId,
      teamId: adoption.teamId,
      adoptionId: adoption.adoptionId,
      sourceScanId: adoption.sourceScanId,
      sourceScanVersion: adoption.sourceScanVersion,
      snapshotHash: adoption.snapshotHash,
      draftSetHash: adoption.draftSetHash,
      sourceEvidenceProjectionVersion: adoption.projectionVersion,
      sourceEvidenceAdoptionVersion: adoption.adoptionVersion,
      sourceEvidenceScoringPolicyVersion: PROJECT_GRADE_SOURCE_EVIDENCE_SCORING_POLICY_VERSION,
      productionVerified: false,
    };
    const matches = Object.entries(expected).every(([field, expectedValue]) => {
      const actualValue = field === 'teamId' ? (actual[field] ?? undefined) : actual[field];
      const normalizedExpected = field === 'teamId' ? (expectedValue ?? undefined) : expectedValue;
      return actualValue === normalizedExpected;
    });

    if (!matches) {
      throw new AppError(
        409,
        'Existing source evidence evaluation no longer matches its adoption',
        'PROJECT_GRADE_SOURCE_EVIDENCE_RUN_PROVENANCE_MISMATCH'
      );
    }
  }

  private buildProjectReportFilter(
    project: Pick<IProjectGradeProject, 'projectId' | 'ownerId' | 'teamId'>
  ): Record<string, unknown> {
    return {
      projectId: project.projectId,
      ownerUserId: project.ownerId,
      tenantId: project.teamId || project.ownerId,
    };
  }

  private toReportListItem(report: IPublicReportDocument): ProjectGradeReportListItem {
    return {
      reportId: report.reportId,
      publicId: report.publicId,
      runId: report.runId,
      projectId: report.projectId,
      title: report.title,
      projectName: report.projectName,
      projectKind: report.projectKind,
      verdict: report.verdict,
      externalScore: report.externalScore,
      internalScore: report.internalScore,
      gateBlocked: report.gateBlocked,
      isPublic: report.isPublic,
      publishedAt: report.publishedAt,
      publishedBy: report.publishedBy,
      expiresAt: report.expiresAt,
      revokedAt: report.revokedAt,
      revokedBy: report.revokedBy,
      revocationReason: report.revocationReason,
      sharedCount: report.sharedCount,
      contentFingerprint: report.contentFingerprint,
    };
  }

  private toReportDeliveryListItem(
    delivery: IProjectGradeReportDelivery
  ): ProjectGradeReportDeliveryListItem {
    return {
      deliveryId: delivery.deliveryId,
      reportId: delivery.reportId,
      publicId: delivery.publicId,
      projectId: delivery.projectId,
      requestedBy: delivery.requestedBy,
      format: delivery.format,
      planId: delivery.planId as any,
      branding: delivery.branding,
      contentFingerprint: delivery.contentFingerprint,
      documentFingerprint: delivery.documentFingerprint,
      fileName: delivery.fileName,
      byteLength: delivery.byteLength,
      reportPublishedAt: delivery.reportPublishedAt,
      reportExpiresAt: delivery.reportExpiresAt,
      deliveredAt: delivery.deliveredAt,
    };
  }

  private generateProjectGradePublicReportId(): string {
    return `rpt_${randomBytes(16).toString('hex')}`;
  }

  private computeProjectGradeReportFingerprint(input: ProjectGradeReportFingerprintInput): string {
    const canonical = JSON.stringify({
      publicationVersion: input.publicationVersion,
      runId: input.runId,
      projectId: input.projectId,
      projectName: input.projectName,
      projectKind: input.projectKind,
      title: input.title,
      verdict: input.verdict,
      externalScore: input.externalScore,
      internalScore: input.internalScore,
      gateBlocked: input.gateBlocked,
      dimensionSnapshot: [...input.dimensionSnapshot]
        .map((row) => ({
          dimensionKey: row.dimensionKey,
          label: row.label,
          weight: row.weight,
          rawScore: row.rawScore,
          normalizedScore: row.normalizedScore,
        }))
        .sort((left, right) => left.dimensionKey.localeCompare(right.dimensionKey)),
      findingHighlights: [...input.findingHighlights]
        .map((finding) => ({
          severity: finding.severity,
          dimensionKey: finding.dimensionKey,
          title: finding.title,
        }))
        .sort((left, right) => {
          const severityDifference =
            PROJECT_GRADE_REPORT_SEVERITY_RANK[left.severity] -
            PROJECT_GRADE_REPORT_SEVERITY_RANK[right.severity];
          if (severityDifference !== 0) return severityDifference;
          const dimensionDifference = left.dimensionKey.localeCompare(right.dimensionKey);
          return dimensionDifference !== 0
            ? dimensionDifference
            : left.title.localeCompare(right.title);
        }),
    });
    return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
  }

  private buildProjectTenantFilter(
    project: Pick<IProjectGradeProject, 'projectId' | 'ownerId' | 'teamId'>
  ): Record<string, unknown> {
    return {
      projectId: project.projectId,
      ownerId: project.ownerId,
      teamId: project.teamId ?? { $exists: false },
    };
  }

  private async beginAudit(
    input: Omit<ProjectGradeAuditContext, 'operationId'>
  ): Promise<ProjectGradeAuditContext> {
    const context: ProjectGradeAuditContext = { operationId: randomUUID(), ...input };
    try {
      await ProjectGradeAuditLog.create({
        auditId: randomUUID(),
        ...context,
        outcome: 'attempted',
      });
      return context;
    } catch (error) {
      logger.error('project-grade', '无法写入 ProjectGrade 审计起始事件', {
        projectId: input.projectId,
        action: input.action,
        targetId: input.targetId,
        message: this.sanitizeProjectionError(error),
      });
      throw new AppError(
        503,
        'ProjectGrade audit log is unavailable; sensitive operation was not executed',
        'PROJECT_GRADE_AUDIT_UNAVAILABLE'
      );
    }
  }

  private async finishAudit(
    context: ProjectGradeAuditContext,
    outcome: 'succeeded' | 'failed',
    error?: unknown,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      await ProjectGradeAuditLog.create({
        auditId: randomUUID(),
        ...context,
        outcome,
        errorCode: error instanceof AppError ? error.code : undefined,
        errorSummary: error ? this.sanitizeAuditError(error) : undefined,
        metadata: { ...context.metadata, ...metadata },
      });
    } catch (auditError) {
      logger.error('project-grade', '无法写入 ProjectGrade 审计终态事件', {
        operationId: context.operationId,
        projectId: context.projectId,
        action: context.action,
        outcome,
        message: this.sanitizeProjectionError(auditError),
      });
    }
  }

  private isDuplicateKeyError(error: unknown): boolean {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error as { code?: unknown }).code === 11000
    );
  }

  private sanitizeProjectionError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);
    return message
      .replace(/(?:mongodb(?:\+srv)?:\/\/)[^\s]+/gi, '[redacted-mongodb-uri]')
      .replace(
        /\bauthorization\b\s*[:=]\s*(?:bearer\s+)?[^\s,;]+/gi,
        'authorization=[redacted-sensitive-value]'
      )
      .replace(
        /\b(password|passwd|pwd|secret|token|api[_-]?key)\b\s*[:=]\s*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;]+)/gi,
        '$1=[redacted-sensitive-value]'
      )
      .replace(/[a-z]:\\[^\s"'<>|]*/gi, '[redacted-local-path]')
      .replace(
        /\/(?:home|Users|tmp|var|opt|srv|app|workspace)(?:\/[^\s"'<>|]+)*/g,
        '[redacted-local-path]'
      )
      .slice(0, 1000);
  }

  private sanitizeAuditError(error: unknown): string {
    if (error instanceof AppError) return error.safeMessage.slice(0, 1000);
    return 'ProjectGrade operation failed; internal error details were not persisted';
  }

  private sanitizeUrlForHistory(value: string): string {
    try {
      const url = new URL(value);
      url.username = '';
      url.password = '';
      url.search = '';
      url.hash = '';
      return url.toString().slice(0, 2048);
    } catch {
      return '[invalid-registered-url]';
    }
  }

  private sanitizeUrlScanError(error: unknown): string {
    if (error instanceof AppError) return error.safeMessage.slice(0, 1000);
    return '网址体检失败，内部错误详情已隐藏';
  }

  private sanitizeSourceScanError(error: unknown): string {
    if (error instanceof AppError) return error.safeMessage.slice(0, 1000);
    return '源码快照扫描失败，内部错误详情已隐藏';
  }

  private sanitizeSourceRelativePath(value: unknown): string {
    const safePath = normalizeProjectGradeSourceRelativePath(value);
    if (!safePath) {
      throw new AppError(
        502,
        '源码扫描器返回了不安全的证据边界',
        'PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT'
      );
    }
    return safePath;
  }

  private sanitizeSourceScanResult(
    result: ProjectGradeSourceScanResult,
    expectedRootKey: string
  ): ProjectGradeSourceScanResult {
    if (
      result.rootKey !== expectedRootKey ||
      result.evidenceScope !== 'authorized_local_source_snapshot' ||
      result.productionAcceptance !== false ||
      result.externalScanningEnabled !== false ||
      result.sourceContentPersisted !== false ||
      result.executedSourceCode !== false ||
      result.installedDependencies !== false ||
      result.networkAccessed !== false
    ) {
      throw new AppError(
        502,
        '源码扫描器返回了不安全的证据边界',
        'PROJECT_GRADE_SOURCE_SCAN_UNSAFE_RESULT'
      );
    }

    return {
      scanVersion: String(result.scanVersion).slice(0, 100),
      rootKey: expectedRootKey,
      snapshotHash: String(result.snapshotHash).slice(0, 100),
      files: result.files.map((file) => ({
        path: this.sanitizeSourceRelativePath(file.path),
        sizeBytes: file.sizeBytes,
        sha256: String(file.sha256).slice(0, 64),
      })),
      findings: result.findings.map((finding) => ({
        ruleKey: String(finding.ruleKey).slice(0, 200),
        severity: finding.severity,
        filePath: this.sanitizeSourceRelativePath(finding.filePath),
        line: finding.line,
        message: String(finding.message).slice(0, 1000),
        fingerprint: String(finding.fingerprint).slice(0, 64),
      })),
      routes: result.routes.map((route) => ({
        framework: 'express',
        method: String(route.method).slice(0, 20),
        routePath: String(route.routePath).slice(0, 300),
        filePath: this.sanitizeSourceRelativePath(route.filePath),
        line: route.line,
      })),
      projectSignals: { ...result.projectSignals },
      summary: { ...result.summary },
      skipped: { ...result.skipped },
      limits: { ...result.limits },
      evidenceScope: 'authorized_local_source_snapshot',
      productionAcceptance: false,
      externalScanningEnabled: false,
      sourceContentPersisted: false,
      executedSourceCode: false,
      installedDependencies: false,
      networkAccessed: false,
    };
  }

  async createBaselineEvaluationRun(
    projectName = 'AIbak 智评通 ProjectGrade 内部基线',
    projectType: ProjectGradeProjectType | string = 'ai_application',
    projectUrl = 'https://aibak.site'
  ): Promise<ProjectGradeEvaluationResult> {
    const normalizedProjectType = this.normalizeProjectType(projectType);
    const ruleInputs = this.collectBaselineRuleInputs();
    const findings = this.collectBaselineFindings(ruleInputs);
    const result = evaluateProjectGrade({
      projectName,
      projectType: normalizedProjectType,
      projectUrl,
      rules: this.getRules(),
      ruleInputs,
      findings,
    });

    return result;
  }

  normalizeProjectType(projectType: ProjectGradeProjectType | string): ProjectGradeProjectType {
    const normalized = String(projectType || '').trim();
    const aliases: Record<string, ProjectGradeProjectType> = {
      website: 'website',
      网站: 'website',
      saas: 'saas',
      'saas 应用': 'saas',
      ai_application: 'ai_application',
      'ai application': 'ai_application',
      'ai 应用': 'ai_application',
    };
    const resolved = aliases[normalized] || aliases[normalized.toLowerCase()];
    if (!resolved) {
      throw new Error(
        'Unsupported ProjectGrade project type. Batch 0 supports website, saas and ai_application.'
      );
    }
    return resolved;
  }

  private async assertTeamRole(
    teamId: string,
    userId: string,
    minimumRole: TeamRole
  ): Promise<TeamRole> {
    const team = await Team.findById(teamId).select('ownerId members').lean();
    if (!team) {
      throw new AppError(404, 'Team not found', 'PROJECT_GRADE_TEAM_NOT_FOUND');
    }

    const role: TeamRole | undefined =
      team.ownerId === userId
        ? 'owner'
        : team.members.find((member) => member.userId === userId)?.role;
    if (!role || TEAM_ROLE_RANK[role] < TEAM_ROLE_RANK[minimumRole]) {
      throw new AppError(
        403,
        'Insufficient team role for ProjectGrade resource',
        'PROJECT_GRADE_TEAM_FORBIDDEN'
      );
    }
    return role;
  }
  private collectBaselineRuleInputs(): RuleEvaluationInput[] {
    const byDimension = new Map<ProjectGradeDimensionKey, RuleEvaluationInput>();
    const add = (
      dimensionKey: ProjectGradeDimensionKey,
      completion: CompletionRatio,
      evidence: ProjectGradeEvidence[],
      notes: string
    ) => {
      const rule = this.ruleForDimension(dimensionKey);
      byDimension.set(dimensionKey, { ruleKey: rule.key, completion, evidence, notes });
    };

    add(
      'product_strategy',
      this.existsAny(['docs/PROJECTGRADE-HANDOFF.md', 'docs/AIBAK-FULL-PROJECT-HANDOFF.md'])
        ? 0.75
        : 0.25,
      this.documentEvidence(
        'product_strategy',
        '产品与交接文档',
        ['docs/PROJECTGRADE-HANDOFF.md', 'docs/AIBAK-FULL-PROJECT-HANDOFF.md'],
        '已发现产品定位、评分体系、批次计划和验收原则文档。'
      ),
      '本轮仅验证文档存在，尚未将产品战略与真实客户访谈或转化数据交叉验证。'
    );

    add(
      'requirements_completeness',
      this.existsAll(['client/src/router.tsx', 'server/src/index.ts']) ? 0.5 : 0.25,
      this.sourceEvidence(
        'requirements_completeness',
        '前后端入口与需求实现线索',
        ['client/src/router.tsx', 'server/src/index.ts'],
        '发现前后端路由入口，但尚未形成完整的需求—路由—API—测试追踪矩阵。'
      ),
      '源码线索不能证明所有按钮、异常路径和售后路径在生产可用。'
    );

    add(
      'architecture_engineering',
      this.existsAll(['server/src/index.ts', 'client/src/router.tsx', 'docker-compose.yml'])
        ? 0.75
        : 0.5,
      this.sourceEvidence(
        'architecture_engineering',
        '分层架构与容器化线索',
        [
          'server/src/index.ts',
          'server/src/services',
          'client/src/router.tsx',
          'docker-compose.yml',
        ],
        '发现 React、Express、服务层和 Docker Compose 结构。'
      ),
      '需要继续补充 ProjectGrade 自身的架构决策、队列边界和故障隔离证据。'
    );

    const strictDisabled = this.fileContains('server/tsconfig.json', '"strict": false');
    add(
      'code_maintainability',
      strictDisabled ? 0.5 : 0.75,
      this.sourceEvidence(
        'code_maintainability',
        '类型检查与自动化测试基础',
        [
          'server/tsconfig.json',
          'server/jest.config.cjs',
          'server/src/test/setup.ts',
          'client/eslint.config.js',
        ],
        strictDisabled
          ? '测试基础存在，但服务端 strict 仍关闭。'
          : '发现类型检查、测试和 Lint 配置。'
      ),
      strictDisabled
        ? '服务端 strict=false，且当前尚无 ProjectGrade 专项覆盖率基线。'
        : '需要继续以实际命令结果验证。'
    );

    add(
      'functional_reality',
      this.existsAll([
        'server/src/routes/auth.ts',
        'server/src/routes/ai.ts',
        'server/src/routes/billing.ts',
      ])
        ? 0.5
        : 0.25,
      this.sourceEvidence(
        'functional_reality',
        '核心功能源码入口',
        [
          'server/src/routes/auth.ts',
          'server/src/routes/ai.ts',
          'server/src/routes/billing.ts',
          'client/src/router.tsx',
        ],
        '发现认证、AI、计费和前端路由源码入口。'
      ),
      '本地源码存在不等于生产链路真实可用，本轮未附带浏览器生产自动证据。'
    );

    add(
      'ai_quality',
      this.existsAny([
        'server/src/gateway',
        'server/src/routes/ai-gateway.ts',
        'server/src/services/rag.ts',
      ])
        ? 0.5
        : 0.25,
      this.sourceEvidence(
        'ai_quality',
        'AI 网关、RAG 与模型调用源码',
        [
          'server/src/gateway',
          'server/src/routes/ai-gateway.ts',
          'server/src/services/rag.ts',
          'server/src/routes/model-config.ts',
        ],
        '发现统一网关、RAG 和模型配置相关源码。'
      ),
      '尚未发现与本次运行绑定的版本化 AI 测试集、幻觉/注入评测和生产调用证据。'
    );

    add(
      'ux_accessibility',
      this.existsAll(['client/src/router.tsx', 'client/src/App.tsx']) ? 0.5 : 0.25,
      this.sourceEvidence(
        'ux_accessibility',
        '前端页面与路由实现',
        ['client/src/router.tsx', 'client/src/App.tsx', 'client/src/pages'],
        '发现 React 页面、路由和 Ant Design UI 实现。'
      ),
      '尚未附带移动端、键盘、axe/Lighthouse 或真实用户体验证据。'
    );

    add(
      'security_compliance',
      this.existsAll(['server/src/middleware/auth.ts', 'server/src/services/payment.service.ts'])
        ? 0.5
        : 0.25,
      this.sourceEvidence(
        'security_compliance',
        '认证、支付和安全控制源码',
        [
          'server/src/middleware/auth.ts',
          'server/src/middleware/security-headers.ts',
          'server/src/services/payment.service.ts',
          'server/src/services/sandbox.service.ts',
        ],
        '发现认证、支付、响应头和沙箱安全控制源码。'
      ),
      '没有本次运行绑定的渗透、安全扫描和生产越权验证，因此不得宣称安全完成。'
    );

    add(
      'commercial_delivery',
      this.existsAll([
        'server/src/routes/billing.ts',
        'server/src/models/Order.ts',
        'server/src/models/Refund.ts',
      ])
        ? 0.5
        : 0.25,
      this.sourceEvidence(
        'commercial_delivery',
        '订单、支付、退款与额度源码',
        [
          'server/src/routes/billing.ts',
          'server/src/models/Order.ts',
          'server/src/models/Refund.ts',
          'server/src/models/CreditLot.ts',
          'server/src/routes/account.ts',
        ],
        '发现订单、支付、退款、额度和账户交付相关源码。'
      ),
      '尚未附带微信支付、回调验签、权益到账、退款、License/下载和客服的生产闭环证据。'
    );

    add(
      'devops_reliability',
      this.existsAny(['Dockerfile', 'docker-compose.yml', '.cnb.yml', '.cnb']) ? 0.5 : 0.25,
      this.sourceEvidence(
        'devops_reliability',
        '容器与发布配置',
        ['Dockerfile', 'docker-compose.yml', 'docker-compose.prod.yml', '.cnb.yml', '.cnb'],
        '发现容器和发布链路配置线索。'
      ),
      '本轮未核验 CNB main、deploy/production、GitHub 镜像和服务器 revision 四端一致性。'
    );

    add(
      'performance_cost',
      this.existsAny([
        'server/src/middleware/rate-limit.ts',
        'server/src/middleware/apm.ts',
        'server/src/lib/prometheus.ts',
      ])
        ? 0.25
        : 0,
      this.sourceEvidence(
        'performance_cost',
        '限流、监控与性能线索',
        [
          'server/src/middleware/rate-limit.ts',
          'server/src/middleware/apm.ts',
          'server/src/lib/prometheus.ts',
        ],
        '发现部分限流或监控源码线索，但未发现本次容量与成本测试结果。'
      ),
      '缺少并发、延迟、队列容量、AI 成本和预算告警的可复验证据。'
    );

    add(
      'operations_improvement',
      this.existsAny(['server/src/routes/customer-service.ts', 'docs']) ? 0.5 : 0.25,
      [
        ...this.sourceEvidence(
          'operations_improvement',
          '客服与运营源码',
          ['server/src/routes/customer-service.ts', 'server/src/routes/ops.ts'],
          '发现客服与运营看板相关源码。'
        ),
        ...this.documentEvidence(
          'operations_improvement',
          '交接与持续开发记录',
          ['MEMORY.md', 'docs/AIBAK-FULL-PROJECT-HANDOFF.md'],
          '发现历史开发记录和跨窗口交接文档。'
        ),
      ],
      '尚未附带 SLA、事故复盘、规则版本趋势和整改复测闭环的运营证据。'
    );

    return DEFAULT_PROJECT_GRADE_RULES.map((rule) => {
      return (
        byDimension.get(rule.dimensionKey) || {
          ruleKey: rule.key,
          completion: 0,
          evidence: [],
          notes: '未采集到证据。',
        }
      );
    });
  }

  private collectBaselineFindings(ruleInputs: RuleEvaluationInput[]): ProjectGradeFinding[] {
    const evidenceIds = (dimensionKey: ProjectGradeDimensionKey) => {
      const rule = this.ruleForDimension(dimensionKey);
      return (
        ruleInputs.find((input) => input.ruleKey === rule.key)?.evidence.map((item) => item.id) ||
        []
      );
    };
    const finding = (
      dimensionKey: ProjectGradeDimensionKey,
      severity: 'P1' | 'P2' | 'P3',
      title: string,
      description: string,
      recommendation: string
    ) => {
      const rule = this.ruleForDimension(dimensionKey);
      return createFinding({
        rulePackKey: rule.rulePackKey,
        targetScopeKey: 'aibak_server_repository',
        findingKey: `${dimensionKey}.baseline_gap`,
        ruleKey: rule.key,
        dimensionKey,
        severity,
        title,
        description,
        recommendation,
        evidenceIds: evidenceIds(dimensionKey),
      });
    };

    return [
      finding(
        'functional_reality',
        'P1',
        '核心用户旅程缺少本次生产自动验证',
        '当前只有源码线索，无法证明登录、AI、保存、分享、下载和异常恢复在生产真实可用。',
        '建立 Playwright 生产只读探针，保存请求、响应、截图、控制台和失败证据。'
      ),
      finding(
        'ai_quality',
        'P1',
        'AI 核心能力缺少版本化测试集和生产证据',
        '尚未用固定测试集验证真实模型回复、引用、幻觉、Prompt 注入、延迟和成本。',
        '建立基准测试集、多模型运行记录和生产调用追踪，禁止 Mock 结果计入生产证据。'
      ),
      finding(
        'commercial_delivery',
        'P1',
        '支付、权益与交付闭环未在本次运行中验证',
        '源码存在不能证明支付验签、幂等发权、退款、下载或 License 在真实环境工作。',
        '完成微信支付沙箱/生产验签、订单幂等、权益到账、退款和交付的端到端验证。'
      ),
      finding(
        'devops_reliability',
        'P1',
        '正式发布四端版本一致性未验证',
        '本轮没有 CNB main、deploy/production、GitHub 镜像和服务器镜像 revision 的一致性证据。',
        '在 CNB 正式链路成功后核验四端 revision、健康探针和回滚路径。'
      ),
      finding(
        'code_maintainability',
        'P2',
        '服务端严格类型检查尚未开启',
        'server/tsconfig.json 当前 strict=false，降低重构和规则引擎演进的类型安全。',
        '分模块收敛 any 和隐式类型，再逐步开启 strict 或严格子配置。'
      ),
      finding(
        'ux_accessibility',
        'P2',
        '移动端和无障碍证据缺失',
        '未发现本次运行绑定的手机、键盘、对比度和 axe/Lighthouse 结果。',
        '为 ProjectGrade 和核心购买路径增加响应式、键盘和无障碍自动检查。'
      ),
      finding(
        'performance_cost',
        'P3',
        '性能、容量和 AI 成本基线缺失',
        '当前没有目标并发、P95 延迟、队列容量和单次评估成本证据。',
        '定义 SLO，执行负载测试并记录容量与成本预算。'
      ),
      finding(
        'operations_improvement',
        'P3',
        '规则版本、整改 SLA 和复测趋势尚未形成闭环',
        '已有文档和客服源码，但缺少 ProjectGrade 规则治理、负责人、截止时间和提分趋势。',
        '建立规则版本、整改任务、SLA、复测和趋势报告。'
      ),
    ];
  }

  private ruleForDimension(dimensionKey: ProjectGradeDimensionKey): ProjectGradeRuleDefinition {
    const rule = DEFAULT_PROJECT_GRADE_RULES.find((item) => item.dimensionKey === dimensionKey);
    if (!rule) throw new Error(`Missing ProjectGrade rule for dimension ${dimensionKey}`);
    return rule;
  }

  private sourceEvidence(
    dimensionKey: ProjectGradeDimensionKey,
    title: string,
    candidates: string[],
    description: string
  ): ProjectGradeEvidence[] {
    const existing = candidates.filter((candidate) => this.fileExists(candidate));
    if (!existing.length) return [];
    const rule = this.ruleForDimension(dimensionKey);
    return [
      createEvidence({
        ruleKey: rule.key,
        dimensionKey,
        level: 'source_static',
        title,
        description,
        sourceType: 'source_file',
        source: existing.join(', '),
        metadata: { existingPaths: existing },
      }),
    ];
  }

  private documentEvidence(
    dimensionKey: ProjectGradeDimensionKey,
    title: string,
    candidates: string[],
    description: string
  ): ProjectGradeEvidence[] {
    const existing = candidates.filter((candidate) => this.fileExists(candidate));
    if (!existing.length) return [];
    const rule = this.ruleForDimension(dimensionKey);
    return [
      createEvidence({
        ruleKey: rule.key,
        dimensionKey,
        level: 'documentation',
        title,
        description,
        sourceType: 'document',
        source: existing.join(', '),
        metadata: { existingPaths: existing },
      }),
    ];
  }

  private fileExists(relativePath: string): boolean {
    try {
      return fs.existsSync(path.join(this.repoRoot, relativePath));
    } catch {
      return false;
    }
  }

  private existsAny(relativePaths: string[]): boolean {
    return relativePaths.some((relativePath) => this.fileExists(relativePath));
  }

  private existsAll(relativePaths: string[]): boolean {
    return relativePaths.every((relativePath) => this.fileExists(relativePath));
  }

  private fileContains(relativePath: string, content: string): boolean {
    try {
      return fs.readFileSync(path.join(this.repoRoot, relativePath), 'utf8').includes(content);
    } catch {
      return false;
    }
  }
}

export const projectGradeService = new ProjectGradeService();
