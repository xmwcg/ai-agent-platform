import assert from 'assert';
import { createHash } from 'crypto';
import { tmpdir } from 'os';
import { join } from 'path';
import { unlink, writeFile } from 'fs/promises';
import { PDFParse } from 'pdf-parse';
import type { IPublicReportDocument } from '../models/ProjectGradeReport';
import { renderProjectGradeReportPdf } from '../services/project-grade-report-pdf.service';

async function main(): Promise<void> {
  const generatedAt = new Date('2026-07-23T00:00:00.000Z');
  const report = {
    reportId: 'report-smoke-20260723',
    publicId: 'rpt_smoke_20260723',
    runId: 'run-smoke-20260723',
    projectId: 'project-smoke-20260723',
    tenantId: 'tenant-smoke',
    ownerUserId: 'owner-smoke',
    publicationVersion: 1,
    contentFingerprint: `sha256:${'a'.repeat(64)}`,
    title: 'AIbak 智评通 PDF 真实渲染验收报告',
    projectName: '中文商业项目测试',
    projectKind: 'saas',
    verdict: 'A',
    externalScore: 88.6,
    internalScore: 886,
    gateBlocked: null,
    dimensionSnapshot: [
      {
        dimensionKey: 'security',
        label: '安全与隐私',
        weight: 20,
        rawScore: 178,
        normalizedScore: 89,
      },
      {
        dimensionKey: 'commercialization',
        label: '商业闭环',
        weight: 18,
        rawScore: 160,
        normalizedScore: 88.9,
      },
    ],
    findingHighlights: [
      {
        severity: 'P2',
        dimensionKey: 'operations',
        title: '继续完成生产环境浏览器与中文字体验收',
      },
    ],
    assessmentScope: {
      mode: 'local_real_browser_smoke',
      target: 'ProjectGrade PDF renderer',
      note: '使用本机真实 Chrome/Chromium 生成 A4 PDF，并回读中文文本与完整性指纹。',
    },
    baselineNote: '本结果仅证明本机真实浏览器渲染成功，不代表生产环境已经验收。',
    isPublic: true,
    publishedAt: new Date('2026-07-22T08:00:00.000Z'),
    publishedBy: 'smoke-runner',
    expiresAt: new Date('2026-08-22T08:00:00.000Z'),
    sharedCount: 0,
    immutable: true,
    createdAt: generatedAt,
    updatedAt: generatedAt,
  } as unknown as IPublicReportDocument;

  const artifact = await renderProjectGradeReportPdf(report, {
    branding: 'aibak',
    generatedAt,
  });
  assert.equal(artifact.buffer.subarray(0, 5).toString('ascii'), '%PDF-');
  assert.ok(artifact.byteLength > 25_000, 'PDF byte length is unexpectedly small');
  assert.equal(artifact.byteLength, artifact.buffer.byteLength);
  assert.equal(
    artifact.documentFingerprint,
    `sha256:${createHash('sha256').update(artifact.buffer).digest('hex')}`
  );

  const parser = new PDFParse({ data: artifact.buffer });
  let extractedText = '';
  let pageCount = 0;
  try {
    const result = await parser.getText();
    extractedText = result.text;
    pageCount = result.total;
  } finally {
    await parser.destroy();
  }
  assert.ok(pageCount >= 3, 'Expected the formal report to contain at least three pages');
  assert.ok(extractedText.includes('AIbak 智评通'), 'AIbak Chinese branding was not extractable');
  assert.ok(extractedText.includes('中文商业项目测试'), 'Chinese project name was not extractable');
  assert.ok(extractedText.includes('内容指纹'), 'Fingerprint label was not extractable');

  const configuredOutput = process.env.PROJECT_GRADE_PDF_SMOKE_OUTPUT?.trim();
  const outputPath =
    configuredOutput || join(tmpdir(), `aibak-project-grade-smoke-${Date.now()}.pdf`);
  await writeFile(outputPath, artifact.buffer);
  console.log(
    JSON.stringify(
      {
        ok: true,
        outputPath,
        retained: Boolean(configuredOutput),
        browserPath: process.env.PROJECT_GRADE_PDF_BROWSER_PATH || 'puppeteer-auto-discovery',
        fileName: artifact.fileName,
        byteLength: artifact.byteLength,
        pageCount,
        documentFingerprint: artifact.documentFingerprint,
        chineseTextVerified: true,
        productionAcceptance: false,
      },
      null,
      2
    )
  );
  if (!configuredOutput) await unlink(outputPath);
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
