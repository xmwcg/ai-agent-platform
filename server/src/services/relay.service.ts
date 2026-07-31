import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto';
import axios from 'axios';
import { RelayChannel } from '../models/RelayChannel';
import { RelayToken, RelayUsage } from '../models/RelayToken';
import { RelayConfig } from '../models/RelayConfig';
import { decryptSecret } from '../lib/crypto';

/** 中转站统一错误 */
export class RelayError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

/** 令牌只存哈希，明文仅在发放时返回一次 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function generateToken(): string {
  return 'sk-relay-' + randomBytes(24).toString('base64url');
}

/** 选渠道：优先匹配模型，否则按权重随机（简单负载均衡） */
async function selectChannel(model?: string): Promise<any> {
  const channels = await RelayChannel.find({ enabled: true }).lean();
  if (!channels.length) return null;
  if (model) {
    const hit = (channels as any[]).find((c) => (c.models || []).includes(model));
    if (hit) return hit;
  }
  const total = (channels as any[]).reduce((s: number, c: any) => s + (c.weight || 1), 0);
  let r = Math.random() * total;
  for (const c of channels as any[]) {
    r -= c.weight || 1;
    if (r <= 0) return c;
  }
  return channels[0];
}

/** 核心：把金网通的 OpenAI 兼容请求转发到上游，并记账 */
export async function proxyChatCompletions(token: string, body: any): Promise<any> {
  if (!token) throw new RelayError('缺少令牌', 401);
  const rt = await RelayToken.findOne({ tokenHash: hashToken(token), status: 'active' });
  if (!rt) throw new RelayError('无效的令牌', 401);
  if (rt.expireAt && rt.expireAt.getTime() < Date.now()) {
    rt.status = 'expired';
    await rt.save();
    throw new RelayError('令牌已过期', 401);
  }
  const model = body?.model;
  if (rt.quotaTotal > 0 && rt.quotaUsed >= rt.quotaTotal) {
    throw new RelayError('额度已用完', 402);
  }
  const channel = await selectChannel(model);
  if (!channel) throw new RelayError('暂无可用上游渠道', 503);

  const base = (channel.baseURL || '').replace(/\/+$/, '');
  const url = `${base}/chat/completions`;
  const apiKey = decryptSecret(channel.apiKey || '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (channel.authMode === 'x-api-key') {
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else {
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let resp: any;
  try {
    resp = await axios.post(url, body, { headers, timeout: 180000 });
  } catch (e: any) {
    const status = e?.response?.status || 502;
    const msg = e?.response?.data?.error?.message || e?.message || '上游调用失败';
    throw new RelayError(`上游错误: ${msg}`, status);
  }

  const usage = resp.data?.usage;
  const used = Number(usage?.total_tokens) || 1;
  if (rt.quotaTotal > 0) {
    rt.quotaUsed = Math.min(rt.quotaTotal, rt.quotaUsed + used);
    await rt.save();
  }
  await RelayUsage.create({
    tokenId: String(rt._id),
    licenseId: rt.licenseId,
    modelName: model || '',
    used,
  });
  return resp.data;
}

/** OpenAI 兼容：列出所有启用渠道的模型 */
export async function listModels(token: string): Promise<string[]> {
  const rt = await RelayToken.findOne({ tokenHash: hashToken(token), status: 'active' });
  if (!rt) throw new RelayError('无效的令牌', 401);
  const channels = (await RelayChannel.find({ enabled: true }).lean()) as any[];
  const ids = new Set<string>();
  for (const c of channels) (c.models || []).forEach((m: string) => ids.add(m));
  return Array.from(ids);
}

// ───────────── 中转站独立管理员密码（存数据库，首次登录即初始化） ─────────────
const RELAY_AUTH_PEPPER = process.env.RELAY_AUTH_PEPPER || 'aibak-relay-admin-pepper-v1';

function hashAdminPassword(pwd: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(pwd, salt + RELAY_AUTH_PEPPER, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyAdminPassword(pwd: string, stored: string): boolean {
  const [salt, derived] = stored.split(':');
  if (!salt || !derived) return false;
  const check = scryptSync(pwd, salt + RELAY_AUTH_PEPPER, 64).toString('hex');
  const a = Buffer.from(derived, 'hex');
  const b = Buffer.from(check, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function getAdminPasswordHash(): Promise<string | null> {
  const doc = await RelayConfig.findOne({ key: 'adminPasswordHash' }).lean();
  return doc ? (doc as any).value : null;
}

export async function setAdminPassword(pwd: string): Promise<void> {
  const value = hashAdminPassword(pwd);
  await RelayConfig.findOneAndUpdate(
    { key: 'adminPasswordHash' },
    { key: 'adminPasswordHash', value },
    { upsert: true }
  );
}

/** 校验中转站管理员密码；若从未设置，则把本次密码作为初始密码并返回 true */
export async function verifyAdminLogin(pwd: string): Promise<boolean> {
  const stored = await getAdminPasswordHash();
  if (!stored) {
    await setAdminPassword(pwd);
    return true;
  }
  return verifyAdminPassword(pwd, stored);
}
