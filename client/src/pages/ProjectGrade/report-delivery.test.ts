import { describe, expect, it, vi } from 'vitest';
import {
  buildProjectReportPdfFileName,
  formatReportDeliveryBytes,
  parseAttachmentFileName,
  saveBlobAsDownload,
  type BrowserDownloadAnchor,
} from './report-delivery';

describe('ProjectGrade report delivery browser helpers', () => {
  it('prefers and decodes the UTF-8 attachment filename', () => {
    expect(
      parseAttachmentFileName(
        `attachment; filename="project-grade-report.pdf"; filename*=UTF-8''AIbak-%E6%99%BA%E8%AF%84%E9%80%9A.pdf`
      )
    ).toBe('AIbak-智评通.pdf');
  });

  it('builds an operating-system-safe PDF filename', () => {
    expect(buildProjectReportPdfFileName('客户 / 正式:报告', 'rpt_12345678')).toBe(
      '客户-正式-报告-rpt_12345678.pdf'
    );
  });

  it('formats delivery byte counts for the operator drawer', () => {
    expect(formatReportDeliveryBytes(999)).toBe('999 B');
    expect(formatReportDeliveryBytes(2048)).toBe('2.0 KB');
    expect(formatReportDeliveryBytes(2 * 1024 * 1024)).toBe('2.00 MB');
  });

  it('clicks a temporary Blob URL and always releases it', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const anchor: BrowserDownloadAnchor = { href: '', download: '', rel: '', click, remove };
    const createObjectUrl = vi.fn(() => 'blob:aibak-report');
    const revokeObjectUrl = vi.fn();
    const appendAnchor = vi.fn();
    const blob = new Blob(['%PDF-1.7'], { type: 'application/pdf' });

    saveBlobAsDownload(blob, '正式报告.pdf', {
      createObjectUrl,
      revokeObjectUrl,
      createAnchor: () => anchor,
      appendAnchor,
    });

    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(anchor).toMatchObject({
      href: 'blob:aibak-report',
      download: '正式报告.pdf',
      rel: 'noopener',
    });
    expect(appendAnchor).toHaveBeenCalledWith(anchor);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:aibak-report');
  });
});
