/**
 * TOTP (Time-based One-Time Password) 工具
 * 纯实现，无外部依赖。RFC 6238 / RFC 4226 兼容。
 */
import * as crypto from "crypto";

export function generateSecret(length = 32): string {
  return crypto.randomBytes(length).toString("base64").replace(/[+=]/g, "").slice(0, length);
}

function sha1Hmac(key: Buffer, data: Buffer): Buffer {
  return crypto.createHmac("sha1", key).update(data).digest();
}

function getCounter(step = 30): Buffer {
  const time = Math.floor(Date.now() / 1000 / step);
  const buf = Buffer.alloc(8);
  buf.writeBigInt64BE(BigInt(time));
  return buf;
}

function truncate(hash: Buffer): number {
  const offset = hash[hash.length - 1] & 0x0f;
  return ((hash[offset] & 0x7f) << 24) |
         ((hash[offset + 1] & 0xff) << 16) |
         ((hash[offset + 2] & 0xff) << 8) |
         (hash[offset + 3] & 0xff);
}

export function generateTotp(secret: string, digits = 6, step = 30): string {
  const key = Buffer.from(secret, "utf8");
  const counter = getCounter(step);
  const hash = sha1Hmac(key, counter);
  const code = truncate(hash) % Math.pow(10, digits);
  return code.toString().padStart(digits, "0");
}

export function verifyTotp(secret: string, token: string, digits = 6, step = 30): boolean {
  return generateTotp(secret, digits, step) === token;
}

export function generateOtpAuthUrl(label: string, secret: string, issuer = "AIbak"): string {
  return "otpauth://totp/" + encodeURIComponent(issuer) + ":" + encodeURIComponent(label) +
    "?secret=" + encodeURIComponent(secret) + "&issuer=" + encodeURIComponent(issuer);
}
