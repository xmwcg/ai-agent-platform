/**
 * 简易文件加密工具（替代 GPG）
 *
 * 使用 AES-256-GCM 加密备份文件。
 * 密钥来自 BACKUP_ENCRYPTION_KEY 环境变量。
 * 若未配置密钥则跳过加密（仅开发环境允许）。
 */
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { readFile, writeFile } from "fs/promises";
import { logger } from "./logger";

const ALGO = "aes-256-gcm";
const KEY = process.env.BACKUP_ENCRYPTION_KEY;

function getKey(): Buffer | null {
  if (!KEY) return null;
  if (KEY.length !== 64) {
    logger.warn("gpg", "BACKUP_ENCRYPTION_KEY 不是有效的 64 位 hex 字符串，跳过加密");
    return null;
  }
  return Buffer.from(KEY, "hex");
}

export class GpgEncryptor {
  constructor(private key?: Buffer | null) {
    this.key = getKey();
  }

  async encryptFile(inputPath: string, outputPath: string): Promise<boolean> {
    const key = this.key ?? getKey();
    if (!key) {
      logger.warn("gpg", "未配置 BACKUP_ENCRYPTION_KEY，备份文件以明文存储");
      return false;
    }
    try {
      const data = await readFile(inputPath);
      const iv = randomBytes(12);
      const cipher = createCipheriv(ALGO, key, iv);
      const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
      const tag = cipher.getAuthTag();
      // 格式: iv(12) + tag(16) + ciphertext
      const output = Buffer.concat([iv, tag, encrypted]);
      await writeFile(outputPath, output);
      return true;
    } catch (err) {
      logger.error("gpg", "加密失败: " + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }

  async decryptFile(inputPath: string, outputPath: string): Promise<boolean> {
    const key = this.key ?? getKey();
    if (!key) {
      logger.error("gpg", "未配置 BACKUP_ENCRYPTION_KEY，无法解密");
      return false;
    }
    try {
      const data = await readFile(inputPath);
      const iv = data.subarray(0, 12);
      const tag = data.subarray(12, 28);
      const encrypted = data.subarray(28);
      const decipher = createDecipheriv(ALGO, key, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
      await writeFile(outputPath, decrypted);
      return true;
    } catch (err) {
      logger.error("gpg", "解密失败: " + (err instanceof Error ? err.message : String(err)));
      return false;
    }
  }
}