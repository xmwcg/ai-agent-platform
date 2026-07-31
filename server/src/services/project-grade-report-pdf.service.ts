import { createHash } from 'crypto';
import puppeteer from 'puppeteer';
import type { IPublicReportDocument } from '../models/ProjectGradeReport';

export type ProjectGradeReportBranding = 'aibak' | 'white_label';

export interface ProjectGradeReportPdfOptions {
  branding: ProjectGradeReportBranding;
  generatedAt?: Date;
}

export interface ProjectGradeReportPdfArtifact {
  buffer: Buffer;
  documentFingerprint: string;
  byteLength: number;
  fileName: string;
  generatedAt: Date;
  branding: ProjectGradeReportBranding;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeFileSegment(value: string): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
  return normalized || 'project-grade-report';
}

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(value);
}

function severityClass(severity: 'P0' | 'P1' | 'P2' | 'P3'): string {
  return severity.toLowerCase();
}

export function buildProjectGradeReportHtml(
  report: IPublicReportDocument,
  options: ProjectGradeReportPdfOptions
): string {
  const generatedAt = options.generatedAt || new Date();
  const issuer = options.branding === 'white_label' ? '正式评估交付' : 'AIbak 智评通';
  const reportHeading =
    options.branding === 'white_label' ? '项目正式评估报告' : 'AIbak 智评通正式评估报告';
  const gateText = report.gateBlocked ? `发布门禁：${report.gateBlocked}` : '发布门禁：未阻断';
  const dimensionRows = report.dimensionSnapshot
    .map(
      (row) => `<tr>
        <td><strong>${escapeHtml(row.label)}</strong><div class="muted">${escapeHtml(row.dimensionKey)}</div></td>
        <td>${row.weight}</td>
        <td>${row.rawScore.toFixed(1)}</td>
        <td><strong>${row.normalizedScore.toFixed(1)}</strong></td>
      </tr>`
    )
    .join('');
  const findings = report.findingHighlights.length
    ? report.findingHighlights
        .map(
          (finding) => `<li class="finding">
            <span class="severity ${severityClass(finding.severity)}">${finding.severity}</span>
            <div><strong>${escapeHtml(finding.title)}</strong><div class="muted">维度：${escapeHtml(finding.dimensionKey)}</div></div>
          </li>`
        )
        .join('')
    : '<li class="empty">本次正式报告没有需要公开展示的重点问题。</li>';
  const brandBlock =
    options.branding === 'white_label'
      ? ''
      : '<div class="brand-note">由 AIbak 智评通生成 · aibak.site</div>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(report.title)}</title>
<style>
  @page { size: A4; margin: 17mm 15mm 18mm; }
  * { box-sizing: border-box; }
  body { margin: 0; color: #172033; font-family: "Noto Sans CJK SC", "Microsoft YaHei", "PingFang SC", Arial, sans-serif; font-size: 12px; line-height: 1.65; }
  .cover { min-height: 245mm; display: flex; flex-direction: column; justify-content: space-between; padding: 18mm 12mm 10mm; background: linear-gradient(145deg, #07182e 0%, #0b3158 58%, #0c6b73 100%); color: #fff; border-radius: 12px; }
  .eyebrow { letter-spacing: 3px; font-size: 12px; color: #7ee7de; font-weight: 700; }
  h1 { margin: 20px 0 12px; font-size: 32px; line-height: 1.25; }
  .project { font-size: 21px; font-weight: 700; margin-top: 8px; }
  .score-card { display: flex; align-items: center; gap: 22px; margin-top: 34px; padding: 24px; border: 1px solid rgba(255,255,255,.2); background: rgba(255,255,255,.08); border-radius: 14px; }
  .grade { width: 94px; height: 94px; border-radius: 50%; background: #19c7b5; color: #06243a; display: flex; align-items: center; justify-content: center; font-size: 48px; font-weight: 900; }
  .score { font-size: 38px; font-weight: 800; }
  .score small { font-size: 14px; font-weight: 400; color: #bdd8e8; }
  .meta { color: #c4d9e7; }
  .fingerprint { word-break: break-all; font-family: Consolas, monospace; font-size: 9px; color: #a9c8d8; }
  .brand-note { margin-top: 14px; color: #8ee7df; font-weight: 700; }
  .page-break { break-before: page; page-break-before: always; }
  h2 { margin: 0 0 14px; font-size: 21px; color: #0b3158; border-left: 5px solid #19a99a; padding-left: 10px; }
  h3 { color: #0b3158; margin: 18px 0 8px; }
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 18px; }
  .summary-item { border: 1px solid #dce6ee; background: #f7fafc; border-radius: 8px; padding: 11px; }
  .summary-item span { display: block; color: #64748b; font-size: 10px; }
  .summary-item strong { font-size: 13px; color: #172033; }
  table { width: 100%; border-collapse: collapse; margin-top: 10px; }
  th { background: #0b3158; color: #fff; text-align: left; padding: 9px; }
  td { border: 1px solid #dbe5ec; padding: 8px; vertical-align: top; }
  tr:nth-child(even) td { background: #f8fafc; }
  .muted { color: #718096; font-size: 10px; }
  .findings { list-style: none; padding: 0; margin: 0; }
  .finding { display: flex; gap: 10px; padding: 11px 0; border-bottom: 1px solid #e2e8f0; break-inside: avoid; }
  .severity { min-width: 38px; height: 24px; border-radius: 12px; color: #fff; text-align: center; line-height: 24px; font-weight: 800; }
  .p0 { background: #b91c1c; } .p1 { background: #ea580c; } .p2 { background: #d97706; } .p3 { background: #2563eb; }
  .notice { margin-top: 18px; padding: 12px; border-radius: 8px; background: #fff7ed; border: 1px solid #fed7aa; color: #9a3412; }
  .verification { margin-top: 20px; padding: 13px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; }
  .verification code { word-break: break-all; font-size: 9px; }
  .empty { color: #64748b; padding: 12px; background: #f8fafc; }
</style>
</head>
<body>
<section class="cover">
  <div>
    <div class="eyebrow">${escapeHtml(issuer)} · FORMAL DELIVERY</div>
    <h1>${escapeHtml(reportHeading)}</h1>
    <div class="project">${escapeHtml(report.projectName)}</div>
    <div class="meta">${escapeHtml(report.title)}</div>
    <div class="score-card">
      <div class="grade">${escapeHtml(report.verdict)}</div>
      <div><div class="score">${report.externalScore.toFixed(1)} <small>/ 100</small></div><div>${escapeHtml(gateText)}</div><div class="meta">内部原始分：${report.internalScore.toFixed(1)} / 1000</div></div>
    </div>
  </div>
  <div>
    <div>报告编号：${escapeHtml(report.publicId)}</div>
    <div>正式发布时间：${escapeHtml(formatDate(report.publishedAt))}</div>
    <div>报告有效期至：${escapeHtml(formatDate(report.expiresAt))}</div>
    <div>本次交付生成：${escapeHtml(formatDate(generatedAt))}</div>
    <div class="fingerprint">内容指纹：${escapeHtml(report.contentFingerprint || '未记录')}</div>
    ${brandBlock}
  </div>
</section>

<section class="page-break">
  <h2>评估摘要</h2>
  <div class="summary-grid">
    <div class="summary-item"><span>项目类型</span><strong>${escapeHtml(report.projectKind)}</strong></div>
    <div class="summary-item"><span>评估运行</span><strong>${escapeHtml(report.runId)}</strong></div>
    <div class="summary-item"><span>评估等级</span><strong>${escapeHtml(report.verdict)}</strong></div>
    <div class="summary-item"><span>发布门禁</span><strong>${escapeHtml(report.gateBlocked || '未阻断')}</strong></div>
  </div>
  <h3>评估范围</h3>
  <p>${escapeHtml(report.assessmentScope?.note || '本报告为服务端持久化评估结果的正式交付摘要。')}</p>
  ${report.baselineNote ? `<div class="notice">${escapeHtml(report.baselineNote)}</div>` : ''}

  <h2 style="margin-top:24px">维度评分</h2>
  <table>
    <thead><tr><th>维度</th><th>权重</th><th>原始分</th><th>标准分</th></tr></thead>
    <tbody>${dimensionRows}</tbody>
  </table>
</section>

<section class="page-break">
  <h2>重点问题</h2>
  <ul class="findings">${findings}</ul>
  <div class="notice">本报告仅展示正式评估的脱敏摘要，不包含源码、内部绝对路径、环境变量值、密钥或完整证据原文。报告不等同于渗透测试、财务审计、法律意见或生产环境验收。</div>
  <div class="verification">
    <strong>完整性校验</strong>
    <p>正式报告内容以服务端不可变快照为准。可使用以下内容指纹核对网页报告和本次 PDF 的来源：</p>
    <code>${escapeHtml(report.contentFingerprint || '未记录')}</code>
    <p class="muted">公开报告编号：${escapeHtml(report.publicId)} · 发布版本：${report.publicationVersion}</p>
  </div>
</section>
</body>
</html>`;
}

export async function renderProjectGradeReportPdf(
  report: IPublicReportDocument,
  options: ProjectGradeReportPdfOptions
): Promise<ProjectGradeReportPdfArtifact> {
  const generatedAt = options.generatedAt || new Date();
  const html = buildProjectGradeReportHtml(report, { ...options, generatedAt });
  const executablePath = process.env.PROJECT_GRADE_PDF_BROWSER_PATH?.trim() || undefined;
  const browser = await puppeteer.launch({
    headless: true,
    executablePath,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 30_000 });
    await page.emulateMediaType('print');
    const bytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: false,
      tagged: true,
      outline: true,
    });
    const buffer = Buffer.from(bytes);
    const documentFingerprint = `sha256:${createHash('sha256').update(buffer).digest('hex')}`;
    return {
      buffer,
      documentFingerprint,
      byteLength: buffer.byteLength,
      fileName: `${safeFileSegment(report.projectName)}-${safeFileSegment(report.publicId)}.pdf`,
      generatedAt,
      branding: options.branding,
    };
  } finally {
    await browser.close();
  }
}
