const mockProjectFindOne = jest.fn();
const mockFindingFindOne = jest.fn();
const mockFindingFind = jest.fn();
const mockFindingBulkWrite = jest.fn();
const mockEvidenceFind = jest.fn();
const mockEvidenceBulkWrite = jest.fn();
const mockSnapshotBulkWrite = jest.fn();
const mockRuleBulkWrite = jest.fn();
const mockTargetFindOne = jest.fn();
const mockEvaluationFindOne = jest.fn();
const mockEvaluationUpdateOne = jest.fn();
const mockRemediationFindOne = jest.fn();
const mockRemediationFind = jest.fn();
const mockRemediationCreate = jest.fn();
const mockTeamFindById = jest.fn();
const mockTeamFind = jest.fn();
const mockAuditCreate = jest.fn();
const mockAuditFind = jest.fn();

jest.mock('../models/ProjectGradeProject', () => ({
  ProjectGradeProject: { findOne: mockProjectFindOne },
}));

jest.mock('../models/ProjectGradeAuditLog', () => ({
  ProjectGradeAuditLog: { find: mockAuditFind, create: mockAuditCreate },
}));

jest.mock('../models/ProjectGradeFinding', () => ({
  ProjectGradeFinding: {
    findOne: mockFindingFindOne,
    find: mockFindingFind,
    bulkWrite: mockFindingBulkWrite,
  },
}));

jest.mock('../models/ProjectGradeEvidence', () => ({
  ProjectGradeEvidence: { find: mockEvidenceFind, bulkWrite: mockEvidenceBulkWrite },
}));

jest.mock('../models/ProjectGradeScoreSnapshot', () => ({
  ProjectGradeScoreSnapshot: { bulkWrite: mockSnapshotBulkWrite },
}));

jest.mock('../models/ProjectGradeRule', () => ({
  ProjectGradeRule: { bulkWrite: mockRuleBulkWrite },
}));

jest.mock('../models/ProjectGradeScanTarget', () => ({
  ProjectGradeScanTarget: { findOne: mockTargetFindOne },
}));

jest.mock('../models/EvaluationRun', () => ({
  EvaluationRun: { findOne: mockEvaluationFindOne, updateOne: mockEvaluationUpdateOne },
}));

jest.mock('../models/ProjectGradeRemediationTask', () => ({
  ProjectGradeRemediationTask: {
    findOne: mockRemediationFindOne,
    find: mockRemediationFind,
    create: mockRemediationCreate,
  },
}));

jest.mock('../models/Team', () => ({
  Team: { findById: mockTeamFindById, find: mockTeamFind },
}));

import { AppError } from '../lib/http-error';
import { ProjectGradeService } from './project-grade.service';

function projectDocument(overrides: Record<string, unknown> = {}) {
  return {
    projectId: 'project-1234',
    ownerId: 'owner-1234',
    teamId: undefined,
    status: 'active',
    ...overrides,
  } as any;
}

function findingDocument(overrides: Record<string, unknown> = {}) {
  return {
    findingId: 'finding-1234',
    fingerprint: 'fg_v1_1234567890abcdef1234567890abcdef',
    projectId: 'project-1234',
    runId: 'run-source-1234',
    severity: 'P1',
    title: 'Production evidence missing',
    description: 'No production probe evidence exists.',
    recommendation: 'Run a production probe and retain evidence.',
    currentStatus: 'open',
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

function evaluationRun(overrides: Record<string, unknown> = {}) {
  return {
    runId: 'run-source-1234',
    projectId: 'project-1234',
    projectionStatus: 'ready',
    assessedAt: new Date('2026-07-20T00:00:00.000Z'),
    ...overrides,
  } as any;
}

function remediationTask(overrides: Record<string, unknown> = {}) {
  return {
    taskId: 'task-123456',
    projectId: 'project-1234',
    sourceRunId: 'run-source-1234',
    findingId: 'finding-1234',
    findingFingerprint: 'fg_v1_1234567890abcdef1234567890abcdef',
    ownerId: 'owner-1234',
    severity: 'P1',
    status: 'open',
    retestRunId: undefined,
    completionNote: undefined,
    save: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('ProjectGradeService remediation and finding workflows', () => {
  let service: ProjectGradeService;
  let accessSpy: jest.SpyInstance;
  let project: ReturnType<typeof projectDocument>;

  beforeEach(() => {
    jest.resetAllMocks();
    service = new ProjectGradeService(process.cwd());
    project = projectDocument();
    accessSpy = jest.spyOn(service, 'getProjectForUser').mockResolvedValue(project);
    mockEvaluationUpdateOne.mockResolvedValue({ modifiedCount: 1 });
    mockAuditCreate.mockResolvedValue({});
  });

  afterEach(() => {
    accessSpy.mockRestore();
  });

  it('restricts append-only audit history to project administrators and tenant scope', async () => {
    project = projectDocument({ teamId: 'team-1234' });
    accessSpy.mockResolvedValue(project);
    const auditEvents = [{ auditId: 'audit-1234', operationId: 'operation-1234' }];
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(auditEvents),
    };
    mockAuditFind.mockReturnValue(query);

    await expect(service.listProjectAudit('project-1234', 'admin-1234', 999)).resolves.toBe(
      auditEvents
    );

    expect(accessSpy).toHaveBeenCalledWith('project-1234', 'admin-1234', 'admin');
    expect(mockAuditFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: 'team-1234',
    });
    expect(query.sort).toHaveBeenCalledWith({ createdAt: -1 });
    expect(query.limit).toHaveBeenCalledWith(100);
  });

  it('binds personal audit history to the owner and absence of a team tenant', async () => {
    const auditEvents = [{ auditId: 'audit-personal-1234', operationId: 'operation-1234' }];
    const query = {
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockResolvedValue(auditEvents),
    };
    mockAuditFind.mockReturnValue(query);

    await expect(service.listProjectAudit('project-1234', 'owner-1234', 20)).resolves.toBe(
      auditEvents
    );

    expect(mockAuditFind).toHaveBeenCalledWith({
      projectId: 'project-1234',
      ownerId: 'owner-1234',
      teamId: { $exists: false },
    });
  });

  it('does not query audit history when project authorization fails', async () => {
    accessSpy.mockRejectedValueOnce(
      new AppError(403, '无权访问该项目', 'PROJECT_GRADE_PROJECT_FORBIDDEN')
    );

    await expect(
      service.listProjectAudit('project-1234', 'intruder-1234', 20)
    ).rejects.toMatchObject({
      statusCode: 403,
      code: 'PROJECT_GRADE_PROJECT_FORBIDDEN',
    });
    expect(mockAuditFind).not.toHaveBeenCalled();
  });
  it('returns the existing task when the finding already has one', async () => {
    const finding = findingDocument();
    const sourceRun = evaluationRun();
    const existing = remediationTask();
    mockFindingFindOne.mockResolvedValue(finding);
    mockEvaluationFindOne.mockResolvedValue(sourceRun);
    mockRemediationFindOne.mockResolvedValue(existing);

    await expect(
      service.createRemediationTask('project-1234', 'finding-1234', 'member-1234')
    ).resolves.toBe(existing);
    expect(mockRemediationCreate).not.toHaveBeenCalled();
  });

  it('recovers from a concurrent duplicate-key task creation by returning the winning task', async () => {
    const finding = findingDocument();
    const sourceRun = evaluationRun();
    const existing = remediationTask();
    mockFindingFindOne.mockResolvedValue(finding);
    mockEvaluationFindOne.mockResolvedValue(sourceRun);
    mockRemediationFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(existing);
    mockRemediationCreate.mockRejectedValue(
      Object.assign(new Error('duplicate key'), { code: 11000 })
    );

    await expect(
      service.createRemediationTask('project-1234', 'finding-1234', 'member-1234')
    ).resolves.toBe(existing);
    expect(mockRemediationFindOne).toHaveBeenNthCalledWith(2, {
      projectId: 'project-1234',
      findingId: 'finding-1234',
    });
  });

  it('requires member access before creating a remediation task', async () => {
    accessSpy.mockRejectedValueOnce(new AppError(403, 'forbidden', 'PROJECT_GRADE_TEAM_FORBIDDEN'));

    await expect(
      service.createRemediationTask('project-1234', 'finding-1234', 'viewer-1234')
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_TEAM_FORBIDDEN' });
    expect(accessSpy).toHaveBeenCalledWith('project-1234', 'viewer-1234', 'member');
    expect(mockFindingFindOne).not.toHaveBeenCalled();
  });

  it('allows only the owner to be assigned on a personal project', async () => {
    const finding = findingDocument();
    mockFindingFindOne.mockResolvedValue(finding);
    mockEvaluationFindOne.mockResolvedValue(evaluationRun());
    mockRemediationFindOne.mockResolvedValue(null);

    await expect(
      service.createRemediationTask('project-1234', 'finding-1234', 'owner-1234', {
        assigneeId: 'member-1234',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_ASSIGNEE_FORBIDDEN' });
    expect(mockRemediationCreate).not.toHaveBeenCalled();
  });

  it('records correlated attempted and failed audit events for a rejected remediation transition', async () => {
    const task = remediationTask({ status: 'open' });
    mockRemediationFindOne.mockResolvedValue(task);

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'verified',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_INVALID_REMEDIATION_TRANSITION' });

    expect(task.save).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    const attempted = mockAuditCreate.mock.calls[0][0];
    const failed = mockAuditCreate.mock.calls[1][0];
    expect(attempted).toMatchObject({
      projectId: 'project-1234',
      actorId: 'member-1234',
      action: 'remediation_update',
      targetType: 'remediation',
      targetId: 'task-123456',
      fromStatus: 'open',
      toStatus: 'verified',
      outcome: 'attempted',
    });
    expect(failed).toMatchObject({
      operationId: attempted.operationId,
      outcome: 'failed',
      errorCode: 'PROJECT_GRADE_INVALID_REMEDIATION_TRANSITION',
    });
  });

  it('fails closed before mutating a remediation when the initial audit event cannot be written', async () => {
    const task = remediationTask({ status: 'open' });
    mockRemediationFindOne.mockResolvedValue(task);
    mockAuditCreate.mockRejectedValueOnce(new Error('MongoDB unavailable'));

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'in_progress',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_AUDIT_UNAVAILABLE' });

    expect(task.save).not.toHaveBeenCalled();
    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
  });

  it('does not persist unknown internal error details in an audit failure summary', async () => {
    const task = remediationTask({ status: 'open' });
    task.save.mockRejectedValue(
      new Error('write failed mongodb://audit-user:super-secret@db.internal:27017/projectgrade')
    );
    mockRemediationFindOne.mockResolvedValue(task);

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'in_progress',
      })
    ).rejects.toThrow('write failed');

    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    const failed = mockAuditCreate.mock.calls[1][0];
    expect(failed).toMatchObject({
      outcome: 'failed',
      errorSummary: 'ProjectGrade operation failed; internal error details were not persisted',
    });
    expect(failed.errorSummary).not.toContain('super-secret');
    expect(failed.errorSummary).not.toContain('db.internal');
  });

  it.each([
    [undefined, 'PROJECT_GRADE_RETEST_REQUIRED'],
    ['run-source-1234', 'PROJECT_GRADE_RETEST_REQUIRED'],
  ])('requires a distinct retest run before verification (%s)', async (retestRunId, code) => {
    const task = remediationTask({ status: 'ready_for_retest', retestRunId });
    mockRemediationFindOne.mockResolvedValue(task);

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'verified',
      })
    ).rejects.toMatchObject({ code });
    expect(task.save).not.toHaveBeenCalled();
  });

  it('rejects verification when the retest projection is not ready', async () => {
    const task = remediationTask({ status: 'ready_for_retest', retestRunId: 'run-retest-1234' });
    mockRemediationFindOne.mockResolvedValue(task);
    mockEvaluationFindOne.mockImplementation(async (query: any) =>
      query.runId === 'run-source-1234'
        ? evaluationRun()
        : evaluationRun({ runId: 'run-retest-1234', projectionStatus: 'failed' })
    );

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'verified',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_RETEST_NOT_READY' });
  });

  it('rejects verification when the retest is not newer than the source run', async () => {
    const task = remediationTask({ status: 'ready_for_retest', retestRunId: 'run-retest-1234' });
    mockRemediationFindOne.mockResolvedValue(task);
    mockEvaluationFindOne.mockImplementation(async (query: any) =>
      query.runId === 'run-source-1234'
        ? evaluationRun()
        : evaluationRun({
            runId: 'run-retest-1234',
            assessedAt: new Date('2026-07-19T23:59:59.000Z'),
          })
    );

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'verified',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_RETEST_NOT_NEWER' });
  });

  it('rejects verification while the same stable fingerprint remains in the retest', async () => {
    const task = remediationTask({ status: 'ready_for_retest', retestRunId: 'run-retest-1234' });
    mockRemediationFindOne.mockResolvedValue(task);
    mockEvaluationFindOne.mockImplementation(async (query: any) =>
      query.runId === 'run-source-1234'
        ? evaluationRun()
        : evaluationRun({
            runId: 'run-retest-1234',
            assessedAt: new Date('2026-07-20T01:00:00.000Z'),
          })
    );
    mockFindingFindOne.mockResolvedValue(findingDocument({ runId: 'run-retest-1234' }));

    await expect(
      service.updateRemediationTask('project-1234', 'task-123456', 'member-1234', {
        status: 'verified',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_FINDING_STILL_PRESENT' });
  });

  it('verifies only after a newer ready retest no longer contains the fingerprint and synchronizes the finding', async () => {
    const task = remediationTask({
      status: 'ready_for_retest',
      retestRunId: 'run-retest-1234',
      completionNote: 'production probe confirms the control',
    });
    const finding = findingDocument({ currentStatus: 'ready_for_retest' });
    mockRemediationFindOne.mockResolvedValue(task);
    mockEvaluationFindOne.mockImplementation(async (query: any) =>
      query.runId === 'run-source-1234'
        ? evaluationRun()
        : evaluationRun({
            runId: 'run-retest-1234',
            assessedAt: new Date('2026-07-20T01:00:00.000Z'),
          })
    );
    mockFindingFindOne.mockImplementation(async (query: any) => (query.runId ? null : finding));

    const result = await service.updateRemediationTask(
      'project-1234',
      'task-123456',
      'member-1234',
      { status: 'verified' }
    );

    expect(result.status).toBe('verified');
    expect(result.verifiedAt).toBeInstanceOf(Date);
    expect(task.save).toHaveBeenCalledTimes(1);
    expect(finding).toMatchObject({
      currentStatus: 'verified',
      resolutionNote: 'production probe confirms the control',
      workflowUpdatedBy: 'member-1234',
    });
    expect(finding.workflowUpdatedAt).toBeInstanceOf(Date);
    expect(finding.save).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    const attempted = mockAuditCreate.mock.calls[0][0];
    const succeeded = mockAuditCreate.mock.calls[1][0];
    expect(attempted).toMatchObject({
      action: 'remediation_update',
      targetType: 'remediation',
      targetId: 'task-123456',
      fromStatus: 'ready_for_retest',
      toStatus: 'verified',
      outcome: 'attempted',
    });
    expect(succeeded).toMatchObject({ operationId: attempted.operationId, outcome: 'succeeded' });
  });

  it('requires admin access and a reason for risk acceptance or false-positive workflow changes', async () => {
    accessSpy.mockRejectedValueOnce(new AppError(403, 'forbidden', 'PROJECT_GRADE_TEAM_FORBIDDEN'));
    await expect(
      service.updateFindingWorkflow('project-1234', 'finding-1234', 'member-1234', {
        status: 'accepted_risk',
        note: 'compensating control',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_TEAM_FORBIDDEN' });
    expect(accessSpy).toHaveBeenCalledWith('project-1234', 'member-1234', 'admin');

    accessSpy.mockResolvedValueOnce(project);
    mockFindingFindOne.mockResolvedValueOnce(findingDocument());
    await expect(
      service.updateFindingWorkflow('project-1234', 'finding-1234', 'owner-1234', {
        status: 'false_positive',
        note: '   ',
      })
    ).rejects.toMatchObject({ code: 'PROJECT_GRADE_FINDING_NOTE_REQUIRED' });
  });

  it('records the latest workflow decision, operator and timestamp', async () => {
    const finding = findingDocument();
    mockFindingFindOne.mockResolvedValue(finding);

    const result = await service.updateFindingWorkflow(
      'project-1234',
      'finding-1234',
      'owner-1234',
      { status: 'accepted_risk', note: '  approved compensating control  ' }
    );

    expect(result).toBe(finding);
    expect(finding).toMatchObject({
      currentStatus: 'accepted_risk',
      resolutionNote: 'approved compensating control',
      workflowUpdatedBy: 'owner-1234',
    });
    expect(finding.workflowUpdatedAt).toBeInstanceOf(Date);
    expect(finding.save).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledTimes(2);
    const attempted = mockAuditCreate.mock.calls[0][0];
    const succeeded = mockAuditCreate.mock.calls[1][0];
    expect(attempted).toMatchObject({
      action: 'finding_workflow_update',
      targetType: 'finding',
      targetId: 'finding-1234',
      fromStatus: 'open',
      toStatus: 'accepted_risk',
      reason: 'approved compensating control',
      outcome: 'attempted',
    });
    expect(succeeded).toMatchObject({ operationId: attempted.operationId, outcome: 'succeeded' });
  });
});
