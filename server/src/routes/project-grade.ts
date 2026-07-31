import { Router, type Request, type Response } from 'express';
import { AppError, sendError } from '../lib/http-error';
import { optionalAuth, requireAdmin, requireAuth, type AuthRequest } from '../middleware/auth';
import {
  enforceProjectGradeDailyQuota,
  enforceProjectGradeProjectCapacity,
  getProjectGradeEntitlementSnapshot,
} from '../middleware/project-grade-subscription';
import { projectGradeService } from '../services/project-grade.service';
import { logActivity } from '../services/activity-logger';
import { AttributionSession } from '../models/AttributionSession';
import { randomUUID } from 'crypto';

const router = Router();

const assessmentScope = {
  mode: 'aibak_repository_baseline',
  target: 'server-configured AIbak repository',
  productionAcceptance: false,
  note: '该结果基于当前服务端可访问的仓库证据，不代表生产验收或外部项目扫描。',
} as const;

const persistenceScope = {
  authenticatedOnly: true,
  immutableRunSnapshot: true,
  externalScanningEnabled: false,
  note: 'Batch 0 持久化仅保存 AIbak 服务端仓库内部基线；尚未开放外部 URL、仓库或生产链路扫描。',
} as const;

const urlQuickScanScope = {
  batch: 1,
  authenticatedOnly: true,
  registeredProjectUrlOnly: true,
  externalScanningEnabled: true,
  evidenceScope: 'single_server_http_observation',
  productionAcceptance: false,
  note: '该结果只覆盖本次受限服务端 HTTP/HTML 观察，不执行 JavaScript、Lighthouse、真实浏览器或生产链路验收。',
} as const;

const urlScanHistoryScope = {
  evidenceScope: 'single_server_http_observation',
  productionAcceptance: false,
  note: '历史记录只保存净化后的单次服务端 HTTP/HTML 观察，不进入最终 ProjectGrade 评分，也不构成生产验收。',
} as const;

const sourceScanScope = {
  batch: 2,
  authenticatedOnly: true,
  serverRegisteredRootOnly: true,
  acceptedPathInput: false,
  evidenceScope: 'authorized_local_source_snapshot',
  productionAcceptance: false,
  externalScanningEnabled: false,
  sourceContentPersisted: false,
  executedSourceCode: false,
  networkAccessed: false,
  note: '该结果只覆盖服务端授权的本地源码快照，不接受客户端路径，不执行源码、不访问网络，也不进入最终评分。',
} as const;

const sourceScanHistoryScope = {
  evidenceScope: 'authorized_local_source_snapshot',
  productionAcceptance: false,
  externalScanningEnabled: false,
  sourceContentPersisted: false,
  note: '历史记录仅保存脱敏文件摘要、静态信号、限制与快照哈希，不保存完整源码，也不构成生产验收。',
} as const;

const sourceEvidenceDraftPreviewScope = {
  scoringDisposition: 'draft_only_not_adopted',
  productionAcceptance: false,
  externalScanningEnabled: false,
  sourceContentPersisted: false,
  note: '草稿仅供有权限的管理员预览，尚未采纳、未创建评估运行且不计分。',
} as const;
const sourceEvidenceAdoptionScope = {
  persisted: true,
  scoringDisposition: 'adopted_pending_evaluation',
  evaluationRunCreated: false,
  productionAcceptance: false,
  externalScanningEnabled: false,
  note: '采纳清单仅固定可重建证据草稿，尚未进入评分；不会创建或修改 EvaluationRun。',
} as const;

const sourceEvidenceEvaluationScope = {
  persisted: true,
  evaluationInputKind: 'source_evidence_adoption',
  immutableAdoptionInput: true,
  productionVerified: false,
  productionAcceptance: false,
  externalScanningEnabled: false,
  note: '该运行只消费一个版本化 Source Evidence Adoption Manifest；源码静态证据不构成生产验证。',
} as const;

const reportPublicationScope = {
  persisted: true,
  immutableContentSnapshot: true,
  lifecycleMutable: [
    'isPublic',
    'publishedAt',
    'publishedBy',
    'expiresAt',
    'revokedAt',
    'revokedBy',
  ],
  sourceOfTruth: ['EvaluationRun', 'ProjectGradeScoreSnapshot', 'ProjectGradeFinding'],
  productionAcceptance: false,
  note: '公开报告只包含服务端生成的脱敏不可变摘要；发布、撤销和有效期变化不构成生产环境验收。',
} as const;

const reportDeliveryScope = {
  authenticatedOnly: true,
  format: 'pdf',
  immutableContentFingerprint: true,
  immutableDocumentFingerprint: true,
  deliveryRecordPersisted: true,
  downloadAuditPersisted: true,
  productionAcceptance: false,
  note: 'PDF 只交付当前有效的正式报告；套餐控制品牌、下载权限和每日额度。',
} as const;

function readProjectName(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new AppError(400, 'projectName is required', 'PROJECT_GRADE_INVALID_PROJECT_NAME');
  }
  const projectName = value.trim();
  if (projectName.length > 120) {
    throw new AppError(
      400,
      'projectName must not exceed 120 characters',
      'PROJECT_GRADE_INVALID_PROJECT_NAME'
    );
  }
  return projectName;
}

function readOptionalText(value: unknown, field: string, maxLength: number): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || !value.trim() || value.trim().length > maxLength) {
    throw new AppError(400, `${field} is invalid`, `PROJECT_GRADE_INVALID_${field.toUpperCase()}`);
  }
  return value.trim();
}

function readProjectUrl(value: unknown): string | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string' || value.trim().length > 2048) {
    throw new AppError(
      400,
      'projectUrl must be a valid HTTP(S) URL',
      'PROJECT_GRADE_INVALID_PROJECT_URL'
    );
  }
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'http:' && url.protocol !== 'https:')
      throw new Error('unsupported protocol');
    if (url.username || url.password) throw new Error('credentials are not allowed');
    url.hash = '';
    return url.toString();
  } catch {
    throw new AppError(
      400,
      'projectUrl must be a valid HTTP(S) URL',
      'PROJECT_GRADE_INVALID_PROJECT_URL'
    );
  }
}

function readIdentifier(
  value: unknown,
  field: 'projectId' | 'runId' | 'findingId' | 'taskId' | 'sourceScanId'
): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) {
    throw new AppError(400, `${field} is invalid`, `PROJECT_GRADE_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function readPublicReportId(value: unknown): string {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,64}$/.test(value)) {
    throw new AppError(400, 'publicId is invalid', 'PROJECT_GRADE_INVALID_PUBLIC_REPORT_ID');
  }
  return value;
}

function readReportPublishInput(value: unknown): { title?: string } {
  if (value === undefined || value === null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(
      400,
      'request body must be an object',
      'PROJECT_GRADE_INVALID_REPORT_PUBLISH_REQUEST'
    );
  }
  const body = value as Record<string, unknown>;
  const unknownFields = Object.keys(body).filter((field) => field !== 'title');
  if (unknownFields.length > 0) {
    throw new AppError(
      400,
      `unknown report publish fields: ${unknownFields.join(', ')}`,
      'PROJECT_GRADE_UNKNOWN_REPORT_PUBLISH_FIELD'
    );
  }
  return { title: readOptionalText(body.title, 'report_title', 160) };
}

function readReportRevocationInput(value: unknown): { reason: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(
      400,
      'request body must be an object',
      'PROJECT_GRADE_INVALID_REPORT_REVOKE_REQUEST'
    );
  }
  const body = value as Record<string, unknown>;
  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'reason') {
    throw new AppError(
      400,
      'only reason is accepted',
      'PROJECT_GRADE_INVALID_REPORT_REVOKE_REQUEST'
    );
  }
  const reason = readOptionalText(body.reason, 'revocation_reason', 1000);
  if (!reason) {
    throw new AppError(
      400,
      'reason is required',
      'PROJECT_GRADE_REPORT_REVOCATION_REASON_REQUIRED'
    );
  }
  return { reason };
}

function readLimit(value: unknown): number {
  if (value === undefined) return 20;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 50) {
    throw new AppError(
      400,
      'limit must be an integer between 1 and 50',
      'PROJECT_GRADE_INVALID_LIMIT'
    );
  }
  return parsed;
}

function readSourceEvidenceAdoptionInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(
      400,
      'request body must be an object',
      'PROJECT_GRADE_INVALID_ADOPTION_REQUEST'
    );
  }
  const body = value as Record<string, unknown>;
  const allowedFields = new Set(['sourceScanId', 'expectedDraftSetHash', 'adoptionVersion']);
  const unknownFields = Object.keys(body).filter((field) => !allowedFields.has(field));
  if (unknownFields.length > 0) {
    throw new AppError(
      400,
      `unknown adoption request fields: ${unknownFields.join(', ')}`,
      'PROJECT_GRADE_UNKNOWN_ADOPTION_FIELD'
    );
  }
  if (Object.keys(body).length !== allowedFields.size) {
    throw new AppError(
      400,
      'sourceScanId, expectedDraftSetHash and adoptionVersion are required',
      'PROJECT_GRADE_INVALID_ADOPTION_REQUEST'
    );
  }
  const sourceScanId = readIdentifier(body.sourceScanId, 'sourceScanId');
  if (
    typeof body.expectedDraftSetHash !== 'string' ||
    !/^sha256:[a-f0-9]{64}$/.test(body.expectedDraftSetHash)
  ) {
    throw new AppError(
      400,
      'expectedDraftSetHash is invalid',
      'PROJECT_GRADE_INVALID_DRAFT_SET_HASH'
    );
  }
  if (body.adoptionVersion !== 1) {
    throw new AppError(
      400,
      'adoptionVersion is not supported',
      'PROJECT_GRADE_SOURCE_EVIDENCE_ADOPTION_VERSION_UNSUPPORTED'
    );
  }
  return {
    sourceScanId,
    expectedDraftSetHash: body.expectedDraftSetHash,
    adoptionVersion: body.adoptionVersion,
  };
}

function readSourceEvidenceEvaluationInput(value: unknown) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AppError(
      400,
      'request body must be an object',
      'PROJECT_GRADE_INVALID_SOURCE_EVIDENCE_EVALUATION_REQUEST'
    );
  }
  const body = value as Record<string, unknown>;
  const fields = Object.keys(body);
  if (fields.length !== 1 || fields[0] !== 'adoptionId') {
    throw new AppError(
      400,
      'only adoptionId is accepted',
      'PROJECT_GRADE_INVALID_SOURCE_EVIDENCE_EVALUATION_REQUEST'
    );
  }
  if (
    typeof body.adoptionId !== 'string' ||
    !/^source-adoption:v1:[a-f0-9]{64}$/.test(body.adoptionId)
  ) {
    throw new AppError(
      400,
      'adoptionId is invalid',
      'PROJECT_GRADE_INVALID_SOURCE_EVIDENCE_ADOPTION_ID'
    );
  }
  return { adoptionId: body.adoptionId };
}

function readOptionalIdentifier(
  value: unknown,
  field: 'assigneeId' | 'retestRunId'
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{8,100}$/.test(value)) {
    throw new AppError(400, `${field} is invalid`, `PROJECT_GRADE_INVALID_${field.toUpperCase()}`);
  }
  return value;
}

function readOptionalDate(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  if (typeof value !== 'string') {
    throw new AppError(400, 'dueAt must be an ISO date', 'PROJECT_GRADE_INVALID_DUE_AT');
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError(400, 'dueAt must be an ISO date', 'PROJECT_GRADE_INVALID_DUE_AT');
  }
  return date;
}

function readOptionalSlaHours(value: unknown): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 8760) {
    throw new AppError(
      400,
      'slaHours must be an integer between 1 and 8760',
      'PROJECT_GRADE_INVALID_SLA_HOURS'
    );
  }
  return parsed;
}

function readRemediationStatus(value: unknown) {
  if (value === undefined) return undefined;
  const allowed = [
    'open',
    'in_progress',
    'blocked',
    'ready_for_retest',
    'verified',
    'cancelled',
  ] as const;
  if (typeof value !== 'string' || !allowed.includes(value as (typeof allowed)[number])) {
    throw new AppError(
      400,
      'remediation status is invalid',
      'PROJECT_GRADE_INVALID_REMEDIATION_STATUS'
    );
  }
  return value as (typeof allowed)[number];
}

function readFindingWorkflowStatus(value: unknown) {
  const allowed = ['open', 'accepted_risk', 'false_positive'] as const;
  if (typeof value !== 'string' || !allowed.includes(value as (typeof allowed)[number])) {
    throw new AppError(
      400,
      'finding workflow status is invalid',
      'PROJECT_GRADE_INVALID_FINDING_STATUS'
    );
  }
  return value as (typeof allowed)[number];
}

function normalizeProjectType(value: unknown) {
  try {
    return projectGradeService.normalizeProjectType(
      typeof value === 'string' && value.trim() ? value : 'ai_application'
    );
  } catch (error) {
    throw new AppError(
      400,
      'Batch 0 supports only website, saas and ai_application',
      'PROJECT_GRADE_UNSUPPORTED_PROJECT_TYPE',
      error instanceof Error ? error.message : String(error)
    );
  }
}

router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    data: {
      name: 'AIbak 智评通 ProjectGrade',
      batch: 0,
      supportedProjectTypes: ['website', 'saas', 'ai_application'],
      assessmentScope,
      persistenceScope,
    },
  });
});

router.get('/rules', (_req: Request, res: Response) => {
  try {
    res.json({
      success: true,
      data: {
        rules: projectGradeService.getRules(),
        supportedProjectTypes: ['website', 'saas', 'ai_application'],
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/rules/sync', requireAuth, requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const result = await projectGradeService.syncDefaultRulePack();
    res.json({ success: true, data: { result, productionAcceptance: false } });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/baseline', optionalAuth, async (_req: Request, res: Response) => {
  try {
    const run = await projectGradeService.createBaselineEvaluationRun();
    res.json({ success: true, data: { run, assessmentScope } });
  } catch (error) {
    sendError(res, error);
  }
});

router.post('/evaluate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const projectName = readProjectName(req.body?.projectName);
    const projectUrl = readProjectUrl(req.body?.projectUrl);
    const projectType = normalizeProjectType(req.body?.projectType);

    // Batch 0 匿名/临时评估永不写库；持久化必须通过经鉴权的 /projects/:id/evaluations。
    const run = await projectGradeService.createBaselineEvaluationRun(
      projectName,
      projectType,
      projectUrl
    );

    // 归因桥梁：为匿名体检生成临时 sessionId，注册时回传关联
    const sessionId = randomUUID();
    const attributionSource = String(req.query.source || req.body?.source || 'direct');
    const userAgent = String(req.headers?.['user-agent'] || '');
    const ip = String(req.ip || req.socket?.remoteAddress || '');
    AttributionSession.create({
      sessionId,
      source: attributionSource,
      projectKind: projectType,
      userAgent,
      ip,
    }).catch(() => {
      // 归因记录写入失败不阻塞评估响应
    });

    // 行为日志：体检事件
    logActivity({
      event: "evaluate",
      category: "acquisition",
      sessionId,
      metadata: { projectType, source: attributionSource },
      ip,
      userAgent,
    });

    res.json({
      success: true,
      data: {
        run,
        assessmentScope,
        persisted: false,
        attributionSessionId: sessionId,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/entitlements', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const entitlements = await getProjectGradeEntitlementSnapshot(req.user!.id);
    res.json({ success: true, data: { entitlements } });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/projects', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projects = await projectGradeService.listProjects(req.user!.id);
    res.json({ success: true, data: { projects, persistenceScope } });
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  '/projects',
  requireAuth,
  enforceProjectGradeProjectCapacity,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectName = readProjectName(req.body?.projectName);
      const projectType = normalizeProjectType(req.body?.projectType);
      const projectUrl = readProjectUrl(req.body?.projectUrl);
      const description = readOptionalText(req.body?.description, 'description', 1000);
      const teamId = readOptionalText(req.body?.teamId, 'team_id', 100);
      const created = await projectGradeService.createProject({
        ownerId: req.user!.id,
        teamId,
        name: projectName,
        description,
        projectType,
        projectUrl,
      });
      res.status(201).json({ success: true, data: { ...created, persistenceScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get('/projects/:projectId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = readIdentifier(req.params.projectId, 'projectId');
    const project = await projectGradeService.getProjectForUser(projectId, req.user!.id);
    res.json({ success: true, data: { project, persistenceScope } });
  } catch (error) {
    sendError(res, error);
  }
});

router.post(
  '/projects/:projectId/url-scan',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_url_scan'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const scan = await projectGradeService.runProjectUrlQuickScan(projectId, req.user!.id);
      res.json({ success: true, data: { scan, scope: urlQuickScanScope, persisted: true } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/url-scans',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const scans = await projectGradeService.listProjectUrlScanRuns(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { scans, scope: urlScanHistoryScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/source-scan',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_source_scan'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const scan = await projectGradeService.runProjectSourceScan(projectId, req.user!.id);
      res.json({ success: true, data: { scan, scope: sourceScanScope, persisted: true } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/source-scans',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const scans = await projectGradeService.listProjectSourceScanRuns(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { scans, scope: sourceScanHistoryScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/source-scans/:sourceScanId/evidence-draft',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const sourceScanId = readIdentifier(req.params.sourceScanId, 'sourceScanId');
      const preview = await projectGradeService.getProjectSourceEvidenceDraftPreview(
        projectId,
        req.user!.id,
        sourceScanId
      );
      res.json({ success: true, data: { preview, scope: sourceEvidenceDraftPreviewScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/source-evidence-adoptions',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const adoptions = await projectGradeService.listProjectSourceEvidenceAdoptions(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { adoptions, scope: sourceEvidenceAdoptionScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);
router.post(
  '/projects/:projectId/source-evidence-adoptions',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const input = readSourceEvidenceAdoptionInput(req.body);
      const adoption = await projectGradeService.adoptProjectSourceScanEvidence(
        projectId,
        req.user!.id,
        input
      );
      res.status(201).json({
        success: true,
        data: { adoption, scope: sourceEvidenceAdoptionScope },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/evaluations/source-evidence',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_evaluation'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const input = readSourceEvidenceEvaluationInput(req.body);
      const run = await projectGradeService.runProjectEvaluationFromSourceEvidence(
        projectId,
        req.user!.id,
        input
      );
      res.status(201).json({
        success: true,
        data: { run, scope: sourceEvidenceEvaluationScope },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/evaluations',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_evaluation'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const runs = await projectGradeService.listProjectEvaluationRuns(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { runs, persistenceScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get('/projects/:projectId/reports', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = readIdentifier(req.params.projectId, 'projectId');
    const reports = await projectGradeService.listProjectReports(
      projectId,
      req.user!.id,
      readLimit(req.query.limit)
    );
    res.json({
      success: true,
      data: { reports, scope: reportPublicationScope, productionAcceptance: false },
    });
  } catch (error) {
    sendError(res, error);
  }
});

router.get(
  '/projects/:projectId/reports/:publicId/deliveries',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const publicId = readPublicReportId(req.params.publicId);
      const deliveries = await projectGradeService.listProjectReportDeliveries(
        projectId,
        publicId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({
        success: true,
        data: { deliveries, scope: reportDeliveryScope, productionAcceptance: false },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/reports/:publicId/download.pdf',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_report_download'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const publicId = readPublicReportId(req.params.publicId);
      const result = await projectGradeService.deliverProjectReportPdf(
        projectId,
        publicId,
        req.user!.id
      );
      res.set({
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="project-grade-report.pdf"; filename*=UTF-8''${encodeURIComponent(result.artifact.fileName)}`,
        'Content-Length': String(result.artifact.byteLength),
        'Cache-Control': 'private, no-store',
        'X-AIBak-Delivery-Id': result.delivery.deliveryId,
        'X-AIBak-Report-Fingerprint': result.delivery.contentFingerprint,
        'X-AIBak-Document-Fingerprint': result.delivery.documentFingerprint,
        'X-AIBak-Report-Branding': result.delivery.branding,
        'X-AIBak-Production-Acceptance': 'false',
      });
      res.send(result.artifact.buffer);
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/evaluations/:runId/report',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_report_publish'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const runId = readIdentifier(req.params.runId, 'runId');
      const input = readReportPublishInput(req.body);
      const report = await projectGradeService.publishProjectReport(
        projectId,
        runId,
        req.user!.id,
        input
      );
      res.status(201).json({
        success: true,
        data: { report, scope: reportPublicationScope, productionAcceptance: false },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/reports/:publicId/revoke',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const publicId = readPublicReportId(req.params.publicId);
      const { reason } = readReportRevocationInput(req.body);
      const report = await projectGradeService.revokeProjectReport(
        projectId,
        publicId,
        req.user!.id,
        reason
      );
      res.json({
        success: true,
        data: { report, scope: reportPublicationScope, productionAcceptance: false },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/evidence',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const evidence = await projectGradeService.listProjectEvidence(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { evidence, persistenceScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/findings',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const findings = await projectGradeService.listProjectFindings(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { findings, persistenceScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get('/projects/:projectId/audit', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const projectId = readIdentifier(req.params.projectId, 'projectId');
    const audit = await projectGradeService.listProjectAudit(
      projectId,
      req.user!.id,
      readLimit(req.query.limit)
    );
    res.json({ success: true, data: { audit, persistenceScope, productionAcceptance: false } });
  } catch (error) {
    sendError(res, error);
  }
});

router.patch(
  '/projects/:projectId/findings/:findingId/workflow',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const findingId = readIdentifier(req.params.findingId, 'findingId');
      const note = readOptionalText(req.body?.note, 'note', 2000);
      if (!note) {
        throw new AppError(400, 'note is required', 'PROJECT_GRADE_FINDING_NOTE_REQUIRED');
      }
      const finding = await projectGradeService.updateFindingWorkflow(
        projectId,
        findingId,
        req.user!.id,
        {
          status: readFindingWorkflowStatus(req.body?.status),
          note,
        }
      );
      res.json({ success: true, data: { finding, productionAcceptance: false } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get(
  '/projects/:projectId/remediations',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const remediations = await projectGradeService.listProjectRemediations(
        projectId,
        req.user!.id,
        readLimit(req.query.limit)
      );
      res.json({ success: true, data: { remediations, persistenceScope } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/findings/:findingId/remediations',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const findingId = readIdentifier(req.params.findingId, 'findingId');
      const assigneeId = readOptionalIdentifier(req.body?.assigneeId, 'assigneeId');
      const task = await projectGradeService.createRemediationTask(
        projectId,
        findingId,
        req.user!.id,
        {
          assigneeId: assigneeId || undefined,
          dueAt: readOptionalDate(req.body?.dueAt) || undefined,
          slaHours: readOptionalSlaHours(req.body?.slaHours) || undefined,
        }
      );
      res.status(201).json({ success: true, data: { task, productionAcceptance: false } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.patch(
  '/projects/:projectId/remediations/:taskId',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const taskId = readIdentifier(req.params.taskId, 'taskId');
      const task = await projectGradeService.updateRemediationTask(
        projectId,
        taskId,
        req.user!.id,
        {
          status: readRemediationStatus(req.body?.status),
          assigneeId: readOptionalIdentifier(req.body?.assigneeId, 'assigneeId'),
          dueAt: readOptionalDate(req.body?.dueAt),
          slaHours: readOptionalSlaHours(req.body?.slaHours),
          completionNote: readOptionalText(req.body?.completionNote, 'completion_note', 2000),
          retestRunId: readOptionalIdentifier(req.body?.retestRunId, 'retestRunId'),
        }
      );
      res.json({ success: true, data: { task, productionAcceptance: false } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/projects/:projectId/evaluations',
  requireAuth,
  enforceProjectGradeDailyQuota('project_grade_evaluation'),
  async (req: AuthRequest, res: Response) => {
    try {
      const projectId = readIdentifier(req.params.projectId, 'projectId');
      const run = await projectGradeService.runProjectEvaluation(projectId, req.user!.id);
      res.status(201).json({
        success: true,
        data: { run, assessmentScope, persistenceScope, persisted: true },
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.post(
  '/evaluations/:runId/projection/rebuild',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const runId = readIdentifier(req.params.runId, 'runId');
      const run = await projectGradeService.rebuildEvaluationProjection(runId, req.user!.id);
      res.json({ success: true, data: { run, persistenceScope, productionAcceptance: false } });
    } catch (error) {
      sendError(res, error);
    }
  }
);

router.get('/evaluations/:runId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const runId = readIdentifier(req.params.runId, 'runId');
    const run = await projectGradeService.getEvaluationRunForUser(runId, req.user!.id);
    res.json({ success: true, data: { run, persistenceScope } });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
