/**
 * 通知服务 —— 成本预警与配额告警的统一出口。
 *
 * 生产环境不允许把控制台日志或未实现的短信分支冒充真实通知：
 * - disabled：明确关闭通知能力；
 * - wechat：真实微信模板消息；
 * - console：仅开发/测试；
 * - sms：在真实 SDK 接入前始终返回未发送。
 *
 * 通知仍是业务旁路，但调用方可以通过 NotifyResult 判断是否真实送达。
 */
import axios from 'axios';
import { logger } from '../lib/logger';

export type NotifyChannel = 'disabled' | 'console' | 'wechat' | 'sms';

export interface NotifyMessage {
  /** 接收方：wechat 为 openid；sms 为手机号。 */
  to: string;
  title: string;
  content: string;
}

export interface NotifyResult {
  sent: boolean;
  channel: NotifyChannel;
  providerMessageId?: string;
  error?: string;
}

export function resolveChannel(env: NodeJS.ProcessEnv = process.env): NotifyChannel {
  const configured = env.NOTIFY_CHANNEL?.trim().toLowerCase();
  if (!configured) return env.NODE_ENV === 'production' ? 'disabled' : 'console';
  if (configured === 'disabled' || configured === 'console' || configured === 'wechat' || configured === 'sms') {
    return configured;
  }
  return 'disabled';
}

function sendConsole(msg: NotifyMessage): NotifyResult {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('生产环境禁止使用 console 通知渠道');
  }
  logger.info('notify', `[${msg.title}] -> ${msg.to || 'console'}: ${msg.content}`);
  return { sent: true, channel: 'console' };
}

async function sendWeChat(msg: NotifyMessage): Promise<NotifyResult> {
  const appId = process.env.WECHAT_OPEN_APPID || process.env.WECHAT_APP_ID;
  const templateId = process.env.WECHAT_NOTIFY_TEMPLATE_ID;
  const secret = process.env.WECHAT_OPEN_SECRET;
  if (!appId || !templateId || !secret || !msg.to) {
    throw new Error('微信通知配置不完整或接收人为空');
  }

  const tokenResp = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
    params: { grant_type: 'client_credential', appid: appId, secret },
    timeout: 10_000,
  });
  const accessToken = tokenResp.data?.access_token;
  if (!accessToken) {
    throw new Error(`微信 access_token 获取失败：${tokenResp.data?.errmsg || '响应缺少 access_token'}`);
  }

  const sendResp = await axios.post(
    `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${encodeURIComponent(accessToken)}`,
    {
      touser: msg.to,
      template_id: templateId,
      data: {
        first: { value: msg.title },
        remark: { value: msg.content },
      },
    },
    { timeout: 10_000 }
  );
  if (sendResp.data?.errcode !== undefined && sendResp.data.errcode !== 0) {
    throw new Error(`微信通知发送失败：${sendResp.data.errmsg || sendResp.data.errcode}`);
  }

  return {
    sent: true,
    channel: 'wechat',
    providerMessageId: sendResp.data?.msgid ? String(sendResp.data.msgid) : undefined,
  };
}

async function sendSms(): Promise<NotifyResult> {
  throw new Error('短信通知尚未接入真实供应商 SDK，生产环境不可用');
}

/** 统一发送入口：失败不阻断普通业务，但必须返回真实失败状态并记录日志。 */
export async function notify(msg: NotifyMessage): Promise<NotifyResult> {
  const channel = resolveChannel();
  try {
    if (channel === 'disabled') {
      return { sent: false, channel, error: '通知渠道已明确关闭' };
    }
    if (channel === 'wechat') return await sendWeChat(msg);
    if (channel === 'sms') return await sendSms();
    return sendConsole(msg);
  } catch (error: any) {
    const message = error?.message || '通知发送失败';
    logger.error('notify', `${channel} 通知未送达：${message}`);
    return { sent: false, channel, error: message };
  }
}

/** 便捷：成本预警（给平台管理员或用户本人）。 */
export async function notifyCostAlert(
  to: string,
  plan: string,
  usedFen: number,
  budgetFen: number
): Promise<NotifyResult> {
  const usedYuan = (usedFen / 100).toFixed(2);
  const budgetYuan = budgetFen < 0 ? '∞' : (budgetFen / 100).toFixed(2);
  return notify({
    to,
    title: 'AI 成本预警',
    content: `当前套餐「${plan}」今日 AI 成本约 ¥${usedYuan} / 预算 ¥${budgetYuan}，已逼近阈值，请注意限流或升级 BYOK。`,
  });
}