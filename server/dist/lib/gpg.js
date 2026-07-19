"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GpgEncryptor = void 0;
/**
 * 简易文件加密工具（替代 GPG）
 *
 * 使用 AES-256-GCM 加密备份文件。
 * 密钥来自 BACKUP_ENCRYPTION_KEY 环境变量。
 * 若未配置密钥则跳过加密（仅开发环境允许）。
 */
const crypto_1 = require("crypto");
const promises_1 = require("fs/promises");
const logger_1 = require("./logger");
const ALGO = "aes-256-gcm";
const KEY = process.env.BACKUP_ENCRYPTION_KEY;
function getKey() {
    if (!KEY)
        return null;
    if (KEY.length !== 64) {
        logger_1.logger.warn("gpg", "BACKUP_ENCRYPTION_KEY 不是有效的 64 位 hex 字符串，跳过加密");
        return null;
    }
    return Buffer.from(KEY, "hex");
}
class GpgEncryptor {
    constructor(key) {
        this.key = key;
        this.key = getKey();
    }
    async encryptFile(inputPath, outputPath) {
        const key = this.key ?? getKey();
        if (!key) {
            logger_1.logger.warn("gpg", "未配置 BACKUP_ENCRYPTION_KEY，备份文件以明文存储");
            return false;
        }
        try {
            const data = await (0, promises_1.readFile)(inputPath);
            const iv = (0, crypto_1.randomBytes)(12);
            const cipher = (0, crypto_1.createCipheriv)(ALGO, key, iv);
            const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
            const tag = cipher.getAuthTag();
            // 格式: iv(12) + tag(16) + ciphertext
            const output = Buffer.concat([iv, tag, encrypted]);
            await (0, promises_1.writeFile)(outputPath, output);
            return true;
        }
        catch (err) {
            logger_1.logger.error("gpg", "加密失败: " + (err instanceof Error ? err.message : String(err)));
            return false;
        }
    }
    async decryptFile(inputPath, outputPath) {
        const key = this.key ?? getKey();
        if (!key) {
            logger_1.logger.error("gpg", "未配置 BACKUP_ENCRYPTION_KEY，无法解密");
            return false;
        }
        try {
            const data = await (0, promises_1.readFile)(inputPath);
            const iv = data.subarray(0, 12);
            const tag = data.subarray(12, 28);
            const encrypted = data.subarray(28);
            const decipher = (0, crypto_1.createDecipheriv)(ALGO, key, iv);
            decipher.setAuthTag(tag);
            const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
            await (0, promises_1.writeFile)(outputPath, decrypted);
            return true;
        }
        catch (err) {
            logger_1.logger.error("gpg", "解密失败: " + (err instanceof Error ? err.message : String(err)));
            return false;
        }
    }
}
exports.GpgEncryptor = GpgEncryptor;
//# sourceMappingURL=gpg.js.map