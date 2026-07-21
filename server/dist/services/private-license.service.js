"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.issuePrivateLicense = issuePrivateLicense;
exports.activateLicense = activateLicense;
const crypto_1 = __importDefault(require("crypto"));
const logger_1 = require("../lib/logger");
const LICENSE_KEY = process.env.JINWANGTONG_LICENSE_KEY || 'JinWangTong-2026-Local-Key';
const DOWNLOAD_BASE = process.env.JINWANGTONG_DOWNLOAD_BASE || 'https://aibak.site';
// 版本映射：网站套餐ID → 金网通内部 edition
const EDITION_MAP = {
    'ent-standard': 'pro',
    'ent-pro': 'enterprise',
    'ent-ultimate': 'team',
};
function sign(fp, seats, expire, edition) {
    const payload = fp + '|' + seats + '|' + expire + '|' + edition;
    return crypto_1.default.createHmac('sha256', LICENSE_KEY).update(payload, 'utf8').digest('hex').toUpperCase();
}
/**
 * 签发金网通私有化 License（内嵌 HMAC-SHA256，不需要外部 store）
 * 购买后自动签发，无需人工联系
 */
function issuePrivateLicense(pkg, orderNo, userEmail) {
    const edition = EDITION_MAP[pkg.version] || 'pro';
    const validDays = pkg.validDays < 0 ? 36500 : pkg.validDays;
    const seats = pkg.seats < 0 ? 999999 : pkg.seats;
    const expire = new Date(Date.now() + validDays * 86400000).toISOString().slice(0, 10);
    const fingerprint = 'PENDING_ACTIVATION';
    const license = {
        fingerprint, seats, expire, edition,
        sign: sign(fingerprint, seats, expire, edition),
        activationRequired: true,
        activationUrl: 'https://aibak.site/api/billing/private-license/activate',
        orderNo, email: userEmail,
        issuedAt: new Date().toISOString(),
        product: 'aibak-private',
    };
    logger_1.logger.info('private-license', 'License issued: orderNo=' + orderNo + ' edition=' + edition + ' seats=' + seats);
    return {
        licenseJson: license,
        downloadUrl: DOWNLOAD_BASE + '/jinwangtong?orderNo=' + orderNo,
        serial: license.sign,
    };
}
/**
 * 客户端激活 License：将 PENDING_ACTIVATION 绑定到真实机器指纹
 */
function activateLicense(existingLicense, realFingerprint) {
    const seats = existingLicense.seats || 10;
    const expireDate = existingLicense.expire || new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
    const remainingDays = Math.max(1, Math.ceil((new Date(expireDate).getTime() - Date.now()) / 86400000));
    const edition = existingLicense.edition || 'pro';
    const newExpire = new Date(Date.now() + remainingDays * 86400000).toISOString().slice(0, 10);
    return {
        fingerprint: realFingerprint, seats, expire: newExpire, edition,
        sign: sign(realFingerprint, seats, newExpire, edition),
        activatedAt: new Date().toISOString(),
        orderNo: existingLicense.orderNo,
        product: existingLicense.product || 'aibak-private',
    };
}
//# sourceMappingURL=private-license.service.js.map