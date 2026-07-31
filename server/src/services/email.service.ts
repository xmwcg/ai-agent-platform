/**
 * 邮件通知服务 —— 基于 nodemailer 的事务性邮件发送
 *
 * 支持 SMTP 和 SendGrid API 两种传输方式。
 * 通过 EMAIL_TRANSPORT 环境变量切换：smtp | sendgrid | mock
 *
 * 典型邮件场景：
 * - 支付成功确认
 * - 报告生成完成通知
 * - 退款处理进度
 * - 订阅即将到期提醒
 * - 账号安全通知
 */
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from '../lib/logger';

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer | string;
    contentType?: string;
  }>;
}

export interface EmailResult {
  sent: boolean;
  messageId?: string;
  error?: string;
}

let _transporter: Transporter | null = null;

function resolveTransport(): Transporter {
  if (_transporter) return _transporter;

  const transport = (process.env.EMAIL_TRANSPORT || 'mock').toLowerCase();

  if (transport === 'mock' || process.env.NODE_ENV !== 'production') {
    // 开发/Mock 模式：使用 nodemailer 的 stream transport（不真实发邮件）
    _transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
    logger.info('email', '邮件服务已启动（mock 模式，不真实发送）');
    return _transporter;
  }

  if (transport === 'sendgrid') {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      logger.error('email', 'SENDGRID_API_KEY 未配置，回退到 mock 模式');
      _transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
      return _transporter;
    }
    _transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: { user: 'apikey', pass: apiKey },
    });
    logger.info('email', '邮件服务已启动（SendGrid SMTP）');
    return _transporter;
  }

  // 默认 SMTP
  const smtpHost = process.env.SMTP_HOST || 'smtp.example.com';
  const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const smtpUser = process.env.SMTP_USER || '';
  const smtpPass = process.env.SMTP_PASS || '';
  const smtpSecure = process.env.SMTP_SECURE === 'true';

  if (!smtpUser || !smtpPass) {
    logger.error('email', 'SMTP 凭证未配置，回退到 mock 模式');
    _transporter = nodemailer.createTransport({ streamTransport: true, buffer: true });
    return _transporter;
  }

  _transporter = nodemailer.createTransport({
    host: smtpHost,
    port: smtpPort,
    secure: smtpSecure,
    auth: { user: smtpUser, pass: smtpPass },
  });
  logger.info('email', `邮件服务已启动（SMTP: ${smtpHost}:${smtpPort}）`);
  return _transporter;
}

export async function sendTransactionalEmail(msg: EmailMessage): Promise<EmailResult> {
  const from = msg.from || process.env.EMAIL_FROM || 'noreply@aibak.site';

  try {
    const transporter = resolveTransport();
    const info = await transporter.sendMail({
      from,
      to: msg.to,
      subject: msg.subject,
      html: msg.html,
      replyTo: msg.replyTo || from,
      attachments: msg.attachments,
    });

    const messageId = info.messageId || undefined;
    logger.info('email', `邮件已发送 → ${msg.to} [${msg.subject}] ${messageId || ''}`);

    return { sent: true, messageId };
  } catch (error: any) {
    const errMsg = error?.message || '邮件发送失败';
    logger.error('email', `邮件发送失败 → ${msg.to}: ${errMsg}`);
    return { sent: false, error: errMsg };
  }
}

/** 验证 SMTP 连接是否可用（用于健康检查） */
export async function verifyEmailConnection(): Promise<boolean> {
  try {
    const transporter = resolveTransport();
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}

// ─── 业务邮件模板 ────────────────────────────────

export interface PaymentSuccessEmailVars {
  userName: string;
  planName: string;
  amountYuan: string;
  orderNo: string;
  expiresAt: string;
}

export function buildPaymentSuccessEmail(vars: PaymentSuccessEmailVars): EmailMessage {
  const html = `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:24px">
  <div style="text-align:center;padding:30px 0;background:linear-gradient(135deg,#667eea,#764ba2);border-radius:12px 12px 0 0">
    <h1 style="color:#fff;margin:0;font-size:24px">🎉 支付成功</h1>
    <p style="color:rgba(255,255,255,0.85);margin:8px 0 0">感谢订阅 AIbak 智评通</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px">
    <p>Hi <strong>${vars.userName}</strong>，</p>
    <p>你的 <strong>${vars.planName}</strong> 套餐已开通：</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#666">订单号</td><td style="text-align:right;font-weight:600">${vars.orderNo}</td></tr>
      <tr><td style="padding:8px 0;color:#666">支付金额</td><td style="text-align:right;font-weight:600;color:#667eea">¥${vars.amountYuan}</td></tr>
      <tr><td style="padding:8px 0;color:#666">到期时间</td><td style="text-align:right">${vars.expiresAt}</td></tr>
    </table>
    <div style="text-align:center;margin-top:24px">
      <a href="https://aibak.site/project-grade/projects" style="display:inline-block;padding:12px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">开始使用智评通</a>
    </div>
    <p style="color:#999;font-size:12px;margin-top:24px;text-align:center">如有疑问，请访问 <a href="https://aibak.site/customer-service" style="color:#667eea">客服中心</a></p>
  </div>
</div>`.trim();
  return { to: '', subject: `支付成功 - ${vars.planName}`, html };
}

export interface ReportReadyEmailVars {
  userName: string;
  projectName: string;
  verdict: string;
  score: string;
  reportUrl: string;
}

export function buildReportReadyEmail(vars: ReportReadyEmailVars): EmailMessage {
  const verdictColors: Record<string, string> = { S: '#0a7f3f', A: '#3b82f6', B: '#06b6d4', C: '#f59e0b', D: '#f97316', F: '#dc2626' };
  const verdictColor = verdictColors[vars.verdict] || '#666';

  const html = `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:24px">
  <div style="text-align:center;padding:30px 0;background:#f0f5ff;border-radius:12px 12px 0 0;border:1px solid #d6e4ff">
    <h1 style="color:#1a1a2e;margin:0;font-size:22px">📊 评估报告已生成</h1>
    <p style="color:#666;margin:8px 0 0">${vars.projectName}</p>
  </div>
  <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-top:none;border-radius:0 0 12px 12px">
    <div style="text-align:center;margin:16px 0">
      <span style="display:inline-block;padding:12px 28px;background:${verdictColor};color:#fff;font-size:28px;font-weight:800;border-radius:12px">${vars.verdict}</span>
      <p style="font-size:36px;font-weight:700;margin:12px 0 0">${vars.score} <span style="font-size:16px;color:#666">/ 100</span></p>
    </div>
    <div style="text-align:center;margin-top:24px">
      <a href="${vars.reportUrl}" style="display:inline-block;padding:12px 32px;background:#667eea;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">查看完整报告</a>
    </div>
  </div>
</div>`.trim();
  return { to: '', subject: `报告已生成 - ${vars.projectName} 获得 ${vars.verdict} 级评分`, html };
}

export interface RefundUpdateEmailVars {
  userName: string;
  orderNo: string;
  amountYuan: string;
  status: string;
  refundNo: string;
}

export function buildRefundUpdateEmail(vars: RefundUpdateEmailVars): EmailMessage {
  const statusMap: Record<string, { label: string; color: string }> = {
    approved: { label: '已批准', color: '#3b82f6' },
    rejected: { label: '已拒绝', color: '#dc2626' },
    processing: { label: '退款处理中', color: '#f59e0b' },
    success: { label: '已退款', color: '#0a7f3f' },
    failed: { label: '退款失败', color: '#dc2626' },
  };
  const s = statusMap[vars.status] || { label: vars.status, color: '#666' };

  const html = `
<div style="max-width:600px;margin:0 auto;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1a1a2e;padding:24px">
  <div style="background:#fff;padding:24px;border:1px solid #e8e8e8;border-radius:12px">
    <h2 style="margin:0 0 16px">退款进度更新</h2>
    <p>Hi <strong>${vars.userName}</strong>，你的退款申请状态已更新：</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">
      <tr><td style="padding:8px 0;color:#666">退款单号</td><td style="text-align:right;font-weight:600">${vars.refundNo}</td></tr>
      <tr><td style="padding:8px 0;color:#666">原订单号</td><td style="text-align:right">${vars.orderNo}</td></tr>
      <tr><td style="padding:8px 0;color:#666">退款金额</td><td style="text-align:right;font-weight:600">¥${vars.amountYuan}</td></tr>
      <tr><td style="padding:8px 0;color:#666">当前状态</td><td style="text-align:right;font-weight:600;color:${s.color}">${s.label}</td></tr>
    </table>
    <p style="color:#999;font-size:12px;margin-top:24px;text-align:center">如有疑问，请访问 <a href="https://aibak.site/customer-service" style="color:#667eea">客服中心</a></p>
  </div>
</div>`.trim();
  return { to: '', subject: `退款进度更新 - ${s.label}`, html };
}
