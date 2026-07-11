/**
 * 通知服务 —— 成本预警阀门 / 配额告警的统一出口
 *
 * 渠道按环境变量选择，便于「开发可测、生产可接」：
 *   - console ：默认，开发/演示直接打印（不依赖任何外部服务，零成本可跑）
 *   - wechat  ：微信模板消息（需 WECHAT_APP_ID / WECHAT_OPEN_APPID / 模板 ID 等）
 *   - sms     ：短信（需 SMS_PROVIDER + 对应密钥，如阿里云/腾讯云）
 *
 * 设计原则：通知是「旁路」，任何渠道失败都不影响主业务（fire-and-forget + try/catch）。
 */
import axios from 'axios';
import { logger } from '../lib/logger';

export type NotifyChannel = 'console' | 'wechat' | 'sms';

export interface NotifyMessage {
  /** 接收方：console 下忽略；wechat 为 openid；sms 为手机号 */
  to: string;
  title: string;
  content: string;
}

export function resolveChannel(): NotifyChannel {
  const c = (process.env.NOTIFY_CHANNEL || 'console').toLowerCase();
  if (c === 'wechat' || c === 'sms') return c;
  return 'console';
}

/** 控制台渠道：开发/演示用，直接打印 */
function sendConsole(msg: NotifyMessage): void {
  logger.info('notify', `[${msg.title}] -> ${msg.to || 'console'}: ${msg.content}`);
}

/** 微信模板消息渠道 */
async function sendWeChat(msg: NotifyMessage): Promise<void> {
  const appId = process.env.WECHAT_OPEN_APPID || process.env.WECHAT_APP_ID;
  const templateId = process.env.WECHAT_NOTIFY_TEMPLATE_ID;
  const secret = process.env.WECHAT_OPEN_SECRET;
  if (!appId || !templateId || !secret || !msg.to) {
    // 配置不全时降级到控制台，保证告警不丢失
    sendConsole(msg);
    return;
  }
  try {
    // 取 access_token（生产应缓存，这里简化每次获取；可经缓存优化）
    const tokenResp = await axios.get('https://api.weixin.qq.com/cgi-bin/token', {
      params: { grant_type: 'client_credential', appid: appId, secret },
    });
    const accessToken = tokenResp.data?.access_token;
    if (!accessToken) {
      sendConsole(msg);
      return;
    }
    await axios.post(
      `https://api.weixin.qq.com/cgi-bin/message/template/send?access_token=${accessToken}`,
      {
        touser: msg.to,
        template_id: templateId,
        data: {
          first: { value: msg.title },
          remark: { value: msg.content },
        },
      }
    );
  } catch (err: any) {
    logger.warn('notify', `微信通知失败，降级控制台: ${err?.message}`);
    sendConsole(msg);
  }
}

/** 短信渠道（阿里云短信示例，其他服务商可在此扩展） */
async function sendSms(msg: NotifyMessage): Promise<void> {
  const provider = (process.env.SMS_PROVIDER || '').toLowerCase();
  if (provider === 'aliyun') {
    // 阿里云短信需经官方 SDK 签名，这里仅做结构占位 + 降级控制台
    // 真实接入：引入 @alicloud/dysmsapi20170525，用 SMS_ACCESS_KEY/SECRET 发送
    logger.info('notify', `[sms:aliyun] -> ${msg.to}: ${msg.content}`);
    return;
  }
  if (provider === 'tencent') {
    logger.info('notify', `[sms:tencent] -> ${msg.to}: ${msg.content}`);
    return;
  }
  // 未配置服务商则降级控制台
  sendConsole(msg);
}

/** 统一发送入口（旁路，失败不影响主流程） */
export async function notify(msg: NotifyMessage): Promise<void> {
  const channel = resolveChannel();
  try {
    if (channel === 'wechat') await sendWeChat(msg);
    else if (channel === 'sms') await sendSms(msg);
    else sendConsole(msg);
  } catch (err: any) {
    logger.warn('notify', `通知发送异常(已忽略): ${err?.message}`);
  }
}

/** 便捷：成本预警（给平台管理员或用户本人） */
export async function notifyCostAlert(to: string, plan: string, usedFen: number, budgetFen: number): Promise<void> {
  const usedYuan = (usedFen / 100).toFixed(2);
  const budgetYuan = budgetFen < 0 ? '∞' : (budgetFen / 100).toFixed(2);
  await notify({
    to,
    title: 'AI 成本预警',
    content: `当前套餐「${plan}」今日 AI 成本约 ¥${usedYuan} / 预算 ¥${budgetYuan}，已逼近阈值，请注意限流或升级 BYOK。`,
  });
}
