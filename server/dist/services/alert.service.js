"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAlert = sendAlert;
exports.alertServiceDown = alertServiceDown;
exports.alertBackupFailure = alertBackupFailure;
exports.alertRecoveryResult = alertRecoveryResult;
/**
 * 告警分发服务
 *
 * 生产告警通道：
 * - wecom_webhook: 企业微信机器人 Webhook（推荐）
 * - smtp: 邮件告警
 * - wechat: 微信模板消息（复用 notify.service）
 *
 * 告警类型：critical/high/medium/low
 * 冷却机制：相同 dedupKey 在冷却期内不重复发送
 */
const axios_1 = __importDefault(require("axios"));
const nodemailer_1 = require("nodemailer");
const logger_1 = require("../lib/logger");
const notify_service_1 = require("./notify.service");
// 冷却机制
const COOLDOWN_MINUTES = {
    critical: 1, high: 5, medium: 15, low: 30,
};
const sentAlerts = new Map();
function isCoolingDown(dedupKey, severity) {
    const last = sentAlerts.get(dedupKey);
    if (!last)
        return false;
    return Date.now() - last < COOLDOWN_MINUTES[severity] * 60 * 1000;
}
function markSent(dedupKey) {
    sentAlerts.set(dedupKey, Date.now());
    if (sentAlerts.size > 1000) {
        const now = Date.now();
        for (const [k, t] of sentAlerts) {
            if (now - t > 3600000)
                sentAlerts.delete(k);
        }
    }
}
// 企业微信 Webhook
async function sendWeComWebhook(payload) {
    const webhookUrl = process.env.WECOM_ALERT_WEBHOOK_URL;
    if (!webhookUrl) {
        logger_1.logger.warn('alert', '未配置 WECOM_ALERT_WEBHOOK_URL');
        return false;
    }
    const emoji = {
        critical: '\uD83D\uDD34', high: '\uD83D\uDFE0', medium: '\uD83D\uDFE1', low: '\uD83D\uDD35',
    };
    try {
        const detailStr = payload.details
            ? Object.entries(payload.details).filter(([, v]) => v !== undefined)
                .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`).join(', ')
            : '';
        await axios_1.default.post(webhookUrl, {
            msgtype: 'markdown',
            markdown: {
                content: [
                    `# ${emoji[payload.severity]} ${payload.title}`,
                    `> ${payload.severity.toUpperCase()} | ${payload.category}`,
                    ``,
                    payload.message,
                    detailStr ? `> ${detailStr}` : '',
                    `> ${new Date().toISOString()}`,
                ].join('\n'),
            },
        }, { timeout: 10000 });
        logger_1.logger.info('alert', `WeCom: ${payload.category} [${payload.severity}]`);
        return true;
    }
    catch (err) {
        logger_1.logger.error('alert', `WeCom send failed: ${err?.message}`);
        return false;
    }
}
// SMTP 邮件
async function sendSmtpAlert(payload) {
    const host = process.env.ALERT_SMTP_HOST;
    const port = parseInt(process.env.ALERT_SMTP_PORT || '587', 10);
    const user = process.env.ALERT_SMTP_USER;
    const pass = process.env.ALERT_SMTP_PASS;
    const to = process.env.ALERT_EMAIL_TO;
    if (!host || !user || !pass || !to) {
        logger_1.logger.warn('alert', 'SMTP not configured');
        return false;
    }
    try {
        const transporter = (0, nodemailer_1.createTransport)({
            host, port, secure: port === 465,
            auth: { user, pass },
        });
        await transporter.sendMail({
            from: user, to,
            subject: `[${payload.severity.toUpperCase()}] ${payload.title}`,
            text: [
                `Level: ${payload.severity} / ${payload.category}`,
                '', payload.message, '',
                payload.details ? JSON.stringify(payload.details, null, 2) : '',
                `Time: ${new Date().toISOString()}`,
            ].join('\n'),
        });
        logger_1.logger.info('alert', `SMTP: ${payload.category} [${payload.severity}]`);
        return true;
    }
    catch (err) {
        logger_1.logger.error('alert', `SMTP send failed: ${err?.message}`);
        return false;
    }
}
// 统一告警入口
async function sendAlert(payload) {
    const dedupKey = payload.dedupKey || `${payload.category}_${payload.severity}`;
    if (isCoolingDown(dedupKey, payload.severity)) {
        return { sent: false, channels: [], errors: ['cooldown'] };
    }
    const channels = [];
    const errors = [];
    const results = await Promise.allSettled([
        sendWeComWebhook(payload).then(r => { if (r)
            channels.push('wecom_webhook'); return r; }),
        sendSmtpAlert(payload).then(r => { if (r)
            channels.push('smtp'); return r; }),
        payload.severity === 'critical'
            ? (0, notify_service_1.notify)({ to: process.env.WECHAT_ADMIN_OPENID || '', title: payload.title, content: payload.message })
                .then((r) => { if (r.sent)
                channels.push('wechat'); return r.sent; })
            : Promise.resolve(false),
    ]);
    for (const r of results) {
        if (r.status === 'rejected')
            errors.push(r.reason?.message || 'error');
    }
    const sent = channels.length > 0;
    if (sent)
        markSent(dedupKey);
    if (!sent && errors.length > 0) {
        logger_1.logger.error('alert', `All channels failed: ${payload.category}`);
    }
    return { sent, channels, errors: errors.length > 0 ? errors : undefined };
}
// 便捷方法
async function alertServiceDown(service, error) {
    await sendAlert({ severity: 'critical', category: 'service_down', title: `${service} down`, message: error, dedupKey: `down_${service}` });
}
async function alertBackupFailure(error) {
    await sendAlert({ severity: 'high', category: 'backup_failure', title: 'Backup failed', message: error, dedupKey: 'backup_failure' });
}
async function alertRecoveryResult(success, details) {
    await sendAlert({ severity: success ? 'medium' : 'high', category: 'recovery_test', title: `Recovery drill ${success ? 'PASSED' : 'FAILED'}`, message: success ? 'All checks passed' : 'Recovery failed - check backups', details, dedupKey: 'recovery_test' });
}
//# sourceMappingURL=alert.service.js.map