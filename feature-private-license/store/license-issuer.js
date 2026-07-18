// 金网通 License 签发器（Node 版）
// 算法与 scripts/license.ps1 完全一致：HMAC-SHA256(payload, LICENSE_KEY) -> 大写十六进制
// payload = "指纹|席位|到期(YYYY-MM-DD)|版本"
// 这样本服务签发的 license.json 能被客户端 Test-License 直接校验通过。
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// 必须与 scripts/license.ps1 中的 $script:LicenseKey 一致
const LICENSE_KEY = process.env.LICENSE_KEY || 'JinWangTong-2026-Local-Key';

function sign(fingerprint, seats, expire, edition) {
  const payload = `${fingerprint}|${seats}|${expire}|${edition}`;
  return crypto.createHmac('sha256', LICENSE_KEY).update(payload, 'utf8').digest('hex').toUpperCase();
}

// 签发一张 license 对象
function issueLicense({ fingerprint, seats = 10, days = 365, edition = 'pro' }) {
  const expire = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10); // YYYY-MM-DD
  const obj = { fingerprint, seats, expire, edition, sign: sign(fingerprint, seats, expire, edition) };
  return obj;
}

// 把 license 写入目录（默认与 license.ps1 同结构：license.json）
function saveLicense(lic, outDir) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const file = path.join(outDir, 'license.json');
  fs.writeFileSync(file, JSON.stringify(lic), 'utf8');
  return file;
}

module.exports = { issueLicense, saveLicense, sign, LICENSE_KEY };
