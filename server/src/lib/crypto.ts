import crypto from 'crypto';

/**
 * 字段级加密工具（AES-256-GCM）
 * ----------------------------------------------------------------
 * 用途：把用户配置的第三方厂商 apiKey（ModelConfig.apiKey）以密文落库，
 *       即使数据库被拖库/备份泄露，攻击者也拿不到明文 key。
 *
 * 设计要点：
 *   - 算法 AES-256-GCM：带认证标签，能检测密文被篡改。
 *   - 密钥来自环境变量 ENCRYPTION_KEY（32 字节 = 64 个十六进制字符），
 *     由服务器保管，绝不进代码/镜像/前端。
 *   - 密文格式：enc::v1:<ivHex>:<tagHex>:<cipherHex>
 *   - 向后兼容：decrypt 遇到无前缀的明文直接原样返回（迁移期老数据不报错）。
 */

const ALGO = 'aes-256-gcm';
const PREFIX = 'enc::v1:';

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      'ENCRYPTION_KEY 未配置：请在服务器 .env 设置 32 字节 hex（执行 `openssl rand -hex 32` 生成）'
    );
  }
  const buf = Buffer.from(raw, 'hex');
  if (buf.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY 长度非法：期望 32 字节（64 个十六进制字符），实际 ${buf.length} 字节`
    );
  }
  return buf;
}

/** 加密明文。空值原样返回，避免把空串写成密文。 */
export function encryptSecret(plaintext: string): string {
  if (!plaintext) return plaintext;
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('hex')}:${tag.toString('hex')}:${enc.toString('hex')}`;
}

/** 解密密文。无前缀的明文（迁移期老数据）原样返回。 */
export function decryptSecret(payload: string): string {
  if (!payload) return payload;
  if (!payload.startsWith(PREFIX)) {
    // 兼容迁移：尚未加密的历史数据按明文处理
    return payload;
  }
  const key = getKey();
  const rest = payload.slice(PREFIX.length);
  const [ivHex, tagHex, cipherHex] = rest.split(':');
  if (!ivHex || !tagHex || !cipherHex) {
    throw new Error('apiKey 密文格式非法，无法解密');
  }
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(cipherHex, 'hex')),
    decipher.final(),
  ]);
  return dec.toString('utf8');
}

/** 是否密文（用于判断是否需要解密）。 */
export function isEncrypted(payload: string): boolean {
  return !!payload && payload.startsWith(PREFIX);
}
