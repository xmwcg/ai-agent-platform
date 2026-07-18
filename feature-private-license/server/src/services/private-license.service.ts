/**
 * 私有化授权签发服务 —— 复用金网通 License 机制
 *
 * 私有化订单支付成功后，由 webhook 履约阶段调用本服务，
 * 向同机的金网通 license-issuer（/opt/jinwangtong/store，POST /api/admin/issue）
 * 请求签发 license.json，并将结果回写订单。
 *
 * 与现有 credit-ledger 积分账本完全解耦：私有化授权不进积分系统，避免双账本冲突。
 */
import axios from 'axios';
import { JINWANGTONG_ISSUE, PrivateLicensePackage } from '../config/private-license';
import { logger } from '../lib/logger';

export interface IssuedLicense {
  /** 金网通返回的 license.json 内容（原样存库，用户控制台可下载） */
  licenseJson: Record<string, unknown>;
  /** 可下载的授权文件在线地址（若有） */
  downloadUrl?: string;
  /** 授权序列号/指纹（便于客服对账） */
  serial?: string;
}

/**
 * 向金网通管理接口签发一份私有化 license。
 * @param pkg 私有化套餐配置（含 version、validDays、seats）
 * @param orderNo 本平台订单号（作为授权备注，便于对账）
 * @param userEmail 下单用户邮箱（作为授权归属）
 */
export async function issuePrivateLicense(
  pkg: PrivateLicensePackage,
  orderNo: string,
  userEmail: string
): Promise<IssuedLicense> {
  const { baseUrl, issuePath, adminToken, timeoutMs } = JINWANGTONG_ISSUE;

  if (!adminToken) {
    // 未配置管理令牌时记录告警但不阻断订单（订单仍标记为 paid，license 可后续人工补发）
    logger.warn('private-license', 'JINWANGTONG_ADMIN_TOKEN 未配置，无法自动签发 license，需人工发货');
    throw new Error('LICENSE_ISSUER_NOT_CONFIGURED');
  }

  const resp = await axios.post(
    `${baseUrl}${issuePath}`,
    {
      product: pkg.version,
      version: pkg.version,
      validDays: pkg.validDays,
      seats: pkg.seats,
      offline: pkg.offline,
      orderNo,
      email: userEmail,
    },
    {
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      timeout: timeoutMs,
    }
  );

  const data = resp.data || {};
  return {
    licenseJson: data.license || data,
    downloadUrl: data.downloadUrl,
    serial: data.serial || data.license?.serial,
  };
}
