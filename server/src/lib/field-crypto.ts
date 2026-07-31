/**
 * 字段级加密工具（敏感个人信息）
 * ----------------------------------------------------------------
 * 用途：对 User.phone / Withdrawal.account 等敏感个人字段进行
 *       字段级 AES-256-GCM 加密落库，即使数据库被拖库也拿不到明文。
 *
 * 设计要点：
 *   - 复用 lib/crypto.ts 的 encryptSecret / decryptSecret 核心引擎。
 *   - 手机号额外产出 phoneHash（HMAC-SHA256），用于唯一索引和 Redis 缓存键。
 *     保护隐私同时保证业务可查询/可登录。
 *   - phoneHash 对同一手机号、同一密钥始终产出相同值（确定性），保证 sparse unique 索引可用。
 *   - 需要反向查号的场景（如 SMS 登录）使用 phoneHash 而非明文 phone 做数据库查询。
 */

import crypto from 'crypto';
import { encryptSecret, decryptSecret } from './crypto';

// ─── 手机号 hash（HMAC-SHA256，确定性，用于索引/查找） ───
function getPepper(): string {
  const key = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET || '';
  // 使用 ENCRYPTION_KEY 的 SHA-256 作为 HMAC 密钥，保持派生唯一性
  return crypto.createHash('sha256').update(`phone-pepper:${key}`).digest('hex');
}

/** 将手机号规范化为 E.164 格式（仅保留数字，去空格/横线），方便统一 hash。 */
export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** 对手机号做确定性 HMAC-SHA256，产出 64 字符 hex。同一手机号 + 同一密钥 → 始终相同。 */
export function phoneHash(phone: string): string {
  const normalized = normalizePhone(phone);
  return crypto
    .createHmac('sha256', getPepper())
    .update(normalized)
    .digest('hex');
}

/** 对手机号做掩码展示：138****0000（仅展现前 3 后 4，其余用 * 替代）。 */
export function maskPhone(phone: string): string {
  const n = normalizePhone(phone);
  if (n.length < 7) return '****';
  return `${n.slice(0, 3)}****${n.slice(-4)}`;
}

// ─── 通用加/解密（委托 lib/crypto） ───

/** 加密敏感字段值。空值原样返回。 */
export function encryptField(plaintext: string): string {
  return encryptSecret(plaintext);
}

/** 解密敏感字段值。如果已经是明文（老数据），原样返回。 */
export function decryptField(payload: string): string {
  return decryptSecret(payload);
}

/** 判断是否为加密后的密文。 */
export function isEncryptedField(payload: string): boolean {
  return payload && payload.startsWith('enc::');
}
