/**
 * 密钥轮换脚本
 *
 * 运行方式: npx ts-node scripts/rotate-keys.ts
 *
 * 功能：
 * 1. 生成新的 JWT_SECRET 和 JWT_REFRESH_SECRET
 * 2. 将当前密钥添加到 JWT_FALLBACK_SECRETS
 * 3. 更新 .env 文件
 * 4. 生成字段加密新密钥，保留旧密钥供解密
 * 5. 记录轮换审计日志
 *
 * 建议：每季度执行一次，执行后重启服务。
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as path from "path";

function generateKey(): string {
  return crypto.randomBytes(32).toString("hex");
}

function rotateKeys(): void {
  const envPath = path.resolve(__dirname, "../../.env");
  if (!fs.existsSync(envPath)) {
    console.error("❌ .env 文件不存在: " + envPath);
    process.exit(1);
  }

  let env = fs.readFileSync(envPath, "utf8");
  const lines = env.split(/\r?\n/);

  const newJwtSecret = generateKey();
  const newRefreshSecret = generateKey();
  const newFieldEncryptKey = crypto.randomBytes(32).toString("base64").slice(0, 44);
  const rotatedAt = new Date().toISOString();

  // 记录旧的 JWT_SECRET 作为回退密钥
  let oldJwtSecret = "";
  let oldFieldEncryptKey = "";

  const newLines: string[] = [];
  for (const line of lines) {
    if (line.startsWith("JWT_SECRET=") && !line.includes("#")) {
      oldJwtSecret = line.split("=", 2)[1].trim();
      newLines.push("JWT_SECRET=" + newJwtSecret);
      newLines.push("# rotated from: " + oldJwtSecret.slice(0, 8) + "... at " + rotatedAt);
    } else if (line.startsWith("JWT_REFRESH_SECRET=") && !line.includes("#")) {
      newLines.push("JWT_REFRESH_SECRET=" + newRefreshSecret);
    } else if (line.startsWith("JWT_FALLBACK_SECRETS=") && !line.includes("#")) {
      const existing = line.split("=", 2)[1].trim();
      const fallbacks = existing ? existing.split(",").map(s => s.trim()) : [];
      if (oldJwtSecret && !fallbacks.includes(oldJwtSecret)) {
        fallbacks.unshift(oldJwtSecret);
      }
      if (fallbacks.length > 5) fallbacks.length = 5;
      newLines.push("JWT_FALLBACK_SECRETS=" + fallbacks.join(","));
      newLines.push("# rotated at " + rotatedAt);
    } else if (line.startsWith("FIELD_ENCRYPT_KEY=") && !line.includes("#")) {
      oldFieldEncryptKey = line.split("=", 2)[1].trim();
      newLines.push("FIELD_ENCRYPT_KEY=" + newFieldEncryptKey);
      newLines.push("# rotated from previous key at " + rotatedAt);
    } else if (line.startsWith("FIELD_ENCRYPT_OLD_KEY=") && !line.includes("#")) {
      if (oldFieldEncryptKey) {
        newLines.push("FIELD_ENCRYPT_OLD_KEY=" + oldFieldEncryptKey);
      }
    } else {
      newLines.push(line);
    }
  }

  // 确保有 FIELD_ENCRYPT_OLD_KEY
  if (oldFieldEncryptKey && !newLines.some(l => l.startsWith("FIELD_ENCRYPT_OLD_KEY="))) {
    newLines.push("# Previous field encryption key (for reading old data)");
    newLines.push("FIELD_ENCRYPT_OLD_KEY=" + oldFieldEncryptKey);
  }

  // 添加轮换记录
  newLines.push("");
  newLines.push("# --- Key Rotation ---");
  newLines.push("KEY_LAST_ROTATED=" + rotatedAt);
  newLines.push("KEY_ROTATION_ID=" + crypto.randomBytes(6).toString("hex"));

  fs.writeFileSync(envPath, newLines.join("\n"), "utf8");

  console.log("✅ 密钥轮换完成！");
  console.log("   JWT_SECRET: " + newJwtSecret.slice(0, 12) + "...");
  console.log("   回退密钥: " + (oldJwtSecret ? oldJwtSecret.slice(0, 8) + "..." : "无"));
  console.log("   字段加密密钥: " + newFieldEncryptKey.slice(0, 12) + "...");
  console.log("   轮换时间: " + rotatedAt);
  console.log("");
  console.log("⚠️  请立即重启服务！旧密钥将在下次轮换时移除。");
}

rotateKeys();
