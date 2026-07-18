import axios from 'axios';
import { PrivateLicensePackage } from '../config/private-license';
import { logger } from '../lib/logger';

export interface IssuedLicense {
  licenseJson: Record<string, unknown>;
  downloadUrl?: string;
  serial?: string;
}

// 金网通 store 签发服务地址与管理员令牌（由部署环境变量注入）
const JW_STORE_BASE = process.env.JINWANGTONG_STORE_URL || 'http://127.0.0.1:3100';
const JW_ADMIN_TOKEN = process.env.JINWANGTONG_ADMIN_TOKEN || '';

/**
 * 调用金网通 store 的 /api/admin/issue（模式 B）直接签发私有化 license。
 * 契约：{ product, version, validDays, seats, offline, email, orderNo, adminToken }
 * 金网通用 PLATFORM_EDITION_MAP[version] 映射内部 edition，validDays<0 视为永久(36500)。
 */
export async function issuePrivateLicense(
  pkg: PrivateLicensePackage,
  orderNo: string,
  userEmail: string
): Promise<IssuedLicense> {
  if (!JW_ADMIN_TOKEN) {
    logger.warn('private-license', '未配置 JINWANGTONG_ADMIN_TOKEN，跳过实际签发');
    throw new Error('LICENSE_ISSUER_NOT_CONFIGURED');
  }

  const validDays = pkg.validDays < 0 ? 36500 : pkg.validDays; // 永久用 100 年占位
  const seats = pkg.seats < 0 ? 999999 : pkg.seats; // 不限席位用极大值

  const resp = await axios.post(
    `${JW_STORE_BASE}/api/admin/issue`,
    {
      product: 'aibak-private',
      version: pkg.version, // ent-standard / ent-pro / ent-ultimate
      validDays,
      seats,
      offline: pkg.offline,
      email: userEmail,
      orderNo,
      adminToken: JW_ADMIN_TOKEN,
    },
    { timeout: 10000 }
  );

  const data = resp.data || {};
  const license = data.license || data;
  return {
    licenseJson: license,
    downloadUrl: data.downloadUrl,
    serial: (license && (license.serial || license.sign)) || undefined,
  };
}
