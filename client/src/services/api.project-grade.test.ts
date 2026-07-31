import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockClient } = vi.hoisted(() => ({
  mockClient: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  },
}));

vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockClient),
    isAxiosError: vi.fn(() => false),
  },
}));

vi.mock('antd', () => ({
  message: { error: vi.fn() },
}));

vi.mock('@/components/QuotaExceededModal', () => ({
  triggerQuotaModal: vi.fn(),
}));

import { triggerQuotaModal } from '@/components/QuotaExceededModal';
import { projectGradeAPI } from './api';

const responseSuccessInterceptor = mockClient.interceptors.response.use.mock.calls[0][0];
const responseErrorInterceptor = mockClient.interceptors.response.use.mock.calls[0][1];

describe('ProjectGrade workspace API client', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps response headers for PDF delivery while preserving JSON data unwrapping', () => {
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });
    const fileResponse = { data: blob, config: { returnFullResponse: true } };
    const jsonResponse = { data: { success: true }, config: {} };

    expect(responseSuccessInterceptor(fileResponse)).toBe(fileResponse);
    expect(responseSuccessInterceptor(jsonResponse)).toEqual({ success: true });
  });

  it('decodes Blob quota errors and opens the ProjectGrade upgrade modal', async () => {
    const error = {
      response: {
        status: 402,
        data: new Blob(
          [
            JSON.stringify({
              code: 'PROJECT_GRADE_QUOTA_EXCEEDED',
              error: '今日智评通报告下载额度已用尽',
              resource: 'project_grade_report_download',
              used: 10,
              limit: 10,
              currentPlan: 'pro',
            }),
          ],
          { type: 'application/json' }
        ),
      },
    };

    await expect(responseErrorInterceptor(error)).rejects.toBe(error);
    expect(triggerQuotaModal).toHaveBeenCalledWith({
      code: 'PROJECT_GRADE_QUOTA_EXCEEDED',
      message: '今日智评通报告下载额度已用尽',
      resource: 'project_grade_report_download',
      used: 10,
      limit: 10,
      currentPlan: 'pro',
    });
    expect(error.response.data).toEqual(
      expect.objectContaining({ code: 'PROJECT_GRADE_QUOTA_EXCEEDED' })
    );
  });

  it('keeps evidence, Finding, remediation, audit, and projection actions on authenticated workspace routes', () => {
    projectGradeAPI.listProjectEvidence('project-1', 40);
    projectGradeAPI.listProjectFindings('project-1', 30);
    projectGradeAPI.listProjectRemediations('project-1');
    projectGradeAPI.updateFindingWorkflow('project-1', 'finding-1', {
      status: 'accepted_risk',
      note: 'Risk acceptance is documented by the authorized reviewer.',
    });
    projectGradeAPI.createRemediation('project-1', 'finding-1', { slaHours: 24 });
    projectGradeAPI.updateRemediation('project-1', 'task-1', {
      status: 'ready_for_retest',
      completionNote: 'Change is ready for an independent retest.',
      retestRunId: 'run-2',
    });
    projectGradeAPI.listProjectAudit('project-1', 20);
    projectGradeAPI.rebuildProjection('run-2');

    expect(mockClient.get).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/evidence',
      {
        params: { limit: 40 },
      }
    );
    expect(mockClient.get).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/findings',
      {
        params: { limit: 30 },
      }
    );
    expect(mockClient.get).toHaveBeenNthCalledWith(
      3,
      '/project-grade/projects/project-1/remediations',
      {
        params: { limit: 50 },
      }
    );
    expect(mockClient.patch).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/findings/finding-1/workflow',
      {
        status: 'accepted_risk',
        note: 'Risk acceptance is documented by the authorized reviewer.',
      }
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/findings/finding-1/remediations',
      { slaHours: 24 }
    );
    expect(mockClient.patch).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/remediations/task-1',
      {
        status: 'ready_for_retest',
        completionNote: 'Change is ready for an independent retest.',
        retestRunId: 'run-2',
      }
    );
    expect(mockClient.get).toHaveBeenNthCalledWith(4, '/project-grade/projects/project-1/audit', {
      params: { limit: 20 },
    });
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/project-grade/evaluations/run-2/projection/rebuild'
    );
  });

  it('loads ProjectGrade commercial entitlements from the authenticated endpoint', () => {
    projectGradeAPI.getEntitlements();

    expect(mockClient.get).toHaveBeenCalledWith('/project-grade/entitlements');
  });

  it('uses only the registered-project URL scan route and sends no arbitrary URL payload', () => {
    projectGradeAPI.runProjectUrlQuickScan('project-1');

    expect(mockClient.post).toHaveBeenCalledWith(
      '/project-grade/projects/project-1/url-scan',
      undefined,
      { timeout: 120000 }
    );
    expect(mockClient.post.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('loads persisted URL scan history from the authenticated project route', () => {
    projectGradeAPI.listProjectUrlScans('project-1', 20);

    expect(mockClient.get).toHaveBeenCalledWith('/project-grade/projects/project-1/url-scans', {
      params: { limit: 20 },
    });
  });

  it('runs only the server-registered source scan target and sends no client path payload', () => {
    projectGradeAPI.runProjectSourceScan('project-1');

    expect(mockClient.post).toHaveBeenCalledWith(
      '/project-grade/projects/project-1/source-scan',
      undefined,
      { timeout: 120000 }
    );
    expect(mockClient.post.mock.calls[0]?.[1]).toBeUndefined();
  });

  it('loads persisted source scan history from the authenticated project route', () => {
    projectGradeAPI.listProjectSourceScans('project-1', 20);

    expect(mockClient.get).toHaveBeenCalledWith('/project-grade/projects/project-1/source-scans', {
      params: { limit: 20 },
    });
  });

  it('keeps source evidence preview, adoption, and evaluation commands on explicit project routes', () => {
    projectGradeAPI.getProjectSourceEvidenceDraft('project-1', 'source-scan-1');
    projectGradeAPI.listProjectSourceEvidenceAdoptions('project-1', 15);
    projectGradeAPI.adoptProjectSourceEvidence('project-1', {
      sourceScanId: 'source-scan-1',
      expectedDraftSetHash: 'sha256:' + 'a'.repeat(64),
      adoptionVersion: 1,
    });
    projectGradeAPI.runProjectSourceEvidenceEvaluation('project-1', {
      adoptionId: 'source-adoption:v1:' + 'b'.repeat(64),
    });

    expect(mockClient.get).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/source-scans/source-scan-1/evidence-draft'
    );
    expect(mockClient.get).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/source-evidence-adoptions',
      { params: { limit: 15 } }
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/source-evidence-adoptions',
      {
        sourceScanId: 'source-scan-1',
        expectedDraftSetHash: 'sha256:' + 'a'.repeat(64),
        adoptionVersion: 1,
      }
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/evaluations/source-evidence',
      { adoptionId: 'source-adoption:v1:' + 'b'.repeat(64) }
    );
  });
  it('manages formal report lifecycle only through authenticated project routes', () => {
    projectGradeAPI.listProjectReports('project-1', 25);
    projectGradeAPI.publishProjectReport('project-1', 'run-1', {
      title: 'Project 1 formal assessment report',
    });
    projectGradeAPI.revokeProjectReport(
      'project-1',
      'rpt_12345678',
      'The report is superseded by a newer immutable assessment run.'
    );
    projectGradeAPI.listProjectReportDeliveries('project-1', 'rpt_12345678', 15);
    projectGradeAPI.downloadProjectReportPdf('project-1', 'rpt_12345678');

    expect(mockClient.get).toHaveBeenNthCalledWith(1, '/project-grade/projects/project-1/reports', {
      params: { limit: 25 },
    });
    expect(mockClient.get).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/reports/rpt_12345678/deliveries',
      { params: { limit: 15 } }
    );
    expect(mockClient.get).toHaveBeenNthCalledWith(
      3,
      '/project-grade/projects/project-1/reports/rpt_12345678/download.pdf',
      {
        responseType: 'blob',
        timeout: 120000,
        returnFullResponse: true,
      }
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      1,
      '/project-grade/projects/project-1/evaluations/run-1/report',
      { title: 'Project 1 formal assessment report' }
    );
    expect(mockClient.post).toHaveBeenNthCalledWith(
      2,
      '/project-grade/projects/project-1/reports/rpt_12345678/revoke',
      { reason: 'The report is superseded by a newer immutable assessment run.' }
    );
  });
});
