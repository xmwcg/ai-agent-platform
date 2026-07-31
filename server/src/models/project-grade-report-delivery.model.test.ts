import { ProjectGradeReportDelivery } from './ProjectGradeReportDelivery';

const validDelivery = {
  deliveryId: 'delivery-123456',
  reportId: 'report-123456',
  publicId: 'rpt_project_123456',
  runId: 'run-123456',
  projectId: 'project-1234',
  tenantId: 'owner-1234',
  ownerUserId: 'owner-1234',
  requestedBy: 'member-1234',
  format: 'pdf' as const,
  planId: 'pro' as const,
  branding: 'aibak' as const,
  contentFingerprint: `sha256:${'a'.repeat(64)}`,
  documentFingerprint: `sha256:${'b'.repeat(64)}`,
  fileName: 'customer-report.pdf',
  byteLength: 2048,
  reportPublishedAt: new Date('2026-07-22T00:00:00.000Z'),
  reportExpiresAt: new Date('2026-08-22T00:00:00.000Z'),
  deliveredAt: new Date('2026-07-23T02:00:00.000Z'),
};

describe('ProjectGradeReportDelivery model contract', () => {
  it('accepts a valid immutable PDF delivery record', () => {
    const document = new ProjectGradeReportDelivery(validDelivery);
    expect(document.validateSync()).toBeUndefined();
  });

  it.each(['contentFingerprint', 'documentFingerprint'] as const)(
    'rejects an invalid %s',
    (field) => {
      const document = new ProjectGradeReportDelivery({ ...validDelivery, [field]: 'sha256:bad' });
      expect(document.validateSync()?.errors[field]).toBeDefined();
    }
  );

  it('rejects unknown fields under the strict delivery contract', () => {
    expect(
      () => new ProjectGradeReportDelivery({ ...validDelivery, productionAcceptance: true })
    ).toThrow();
  });

  it('keeps delivery identity, tenant, fingerprints and file metadata immutable', () => {
    const immutablePaths = [
      'deliveryId',
      'reportId',
      'publicId',
      'runId',
      'projectId',
      'tenantId',
      'ownerUserId',
      'requestedBy',
      'format',
      'planId',
      'branding',
      'contentFingerprint',
      'documentFingerprint',
      'fileName',
      'byteLength',
      'reportPublishedAt',
      'reportExpiresAt',
      'deliveredAt',
    ];
    for (const path of immutablePaths) {
      expect(ProjectGradeReportDelivery.schema.path(path)?.options.immutable).toBe(true);
    }
  });

  it('indexes delivery identity and report/project/tenant histories', () => {
    const indexes = ProjectGradeReportDelivery.schema.indexes();
    expect(indexes).toEqual(
      expect.arrayContaining([
        [{ deliveryId: 1 }, expect.objectContaining({ unique: true })],
        [{ projectId: 1, deliveredAt: -1 }, expect.any(Object)],
        [{ reportId: 1, deliveredAt: -1 }, expect.any(Object)],
        [{ tenantId: 1, deliveredAt: -1 }, expect.any(Object)],
        [{ requestedBy: 1, deliveredAt: -1 }, expect.any(Object)],
      ])
    );
  });
});
