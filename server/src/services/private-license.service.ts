/**
 * NexMind Platform — 私有授权服务（金网通 License 签发）
 *
 * 提供 License 生成、激活、验证、吊销等全生命周期管理。
 * 对接金网通 PowerShell RSA-2048 签名体系，签发 .lic 授权文件。
 *
 * @author NexMind Team
 * @license MIT
 */

import crypto from "crypto";
import { getLicenseEdition, LicenseEdition } from "../config/private-license";

// ============== License 数据接口 ==============

export interface LicenseData {
  licenseId: string;
  company: string;
  edition: string;
  maxDevices: number;
  expireDate: string;
  features: string[];
  issuedAt: string;
  orderNo: string;
  userId: string;
  signature: string;
}

export interface LicenseDownloadInfo {
  licenseId: string;
  licenseContent: string;     // .lic 文件内容
  downloadUrl: string;
  expireDate: string;
  edition: string;
  features: string[];
}

// ============== License 签发 ==============

/**
 * 生成 License ID（32 位十六进制）
 */
function generateLicenseId(): string {
  return crypto.randomBytes(16).toString("hex");
}

/**
 * 签发 License 文件
 *
 * @param params.company 公司名称
 * @param params.edition 版本（free/trial/pro/enterprise）
 * @param params.orderNo 关联订单号
 * @param params.userId 用户 ID
 * @param params.customDays 自定义有效期（天），覆盖版本默认值
 * @param params.customDevices 自定义设备数，覆盖版本默认值
 */
export function issueLicense(params: {
  company: string;
  edition: string;
  orderNo: string;
  userId: string;
  customDays?: number;
  customDevices?: number;
}): LicenseDownloadInfo {
  const editionInfo = getLicenseEdition(params.edition);
  if (!editionInfo) throw new Error(`未知版本: ${params.edition}`);

  const licenseId = generateLicenseId();
  const days = params.customDays ?? editionInfo.days;
  const maxDevices = params.customDevices ?? editionInfo.maxDevices;
  const expireDate = days === 0
    ? "永久"
    : new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const issuedAt = new Date().toISOString().slice(0, 10);

  // 构建 License 内容（与金网通 .lic 格式兼容）
  const licenseContent = buildLicenseFile({
    licenseId,
    company: params.company,
    edition: params.edition,
    maxDevices,
    expireDate,
    features: editionInfo.features,
    issuedAt,
    orderNo: params.orderNo,
  });

  return {
    licenseId,
    licenseContent,
    downloadUrl: editionInfo.downloadUrl,
    expireDate,
    edition: editionInfo.name,
    features: editionInfo.features,
  };
}

/**
 * 构建 .lic 文件内容
 * 格式：JSON + HMAC-SHA256 签名，与金网通 lib-license.ps1 兼容
 */
function buildLicenseFile(data: {
  licenseId: string;
  company: string;
  edition: string;
  maxDevices: number;
  expireDate: string;
  features: string[];
  issuedAt: string;
  orderNo: string;
}): string {
  const licenseKey = process.env.JINWANGTONG_LICENSE_KEY || "JinWangTong-2026-Local-Key";

  // 构建载荷
  const payload: Record<string, unknown> = {
    licenseId: data.licenseId,
    company: data.company,
    edition: data.edition,
    maxDevices: data.maxDevices,
    expire: data.expireDate,
    features: data.features,
    issued: data.issuedAt,
    orderNo: data.orderNo,
  };

  // HMAC-SHA256 签名
  const payloadStr = JSON.stringify(payload, null, 2);
  const signature = crypto
    .createHmac("sha256", Buffer.from(licenseKey, "utf-8"))
    .update(payloadStr)
    .digest("hex");

  // 输出 .lic 格式（包含签名）
  const licenseFile = {
    ...payload,
    signature,
    format: "jinwangtong-v2",
  };

  return JSON.stringify(licenseFile, null, 2);
}

// ============== License 验证 ==============

/**
 * 验证 License 是否有效
 */
export function verifyLicense(licenseJson: string): { valid: boolean; reason?: string; data?: LicenseData } {
  try {
    const data = JSON.parse(licenseJson) as LicenseData & { signature: string; format?: string };

    if (!data.licenseId || !data.signature) {
      return { valid: false, reason: "License 格式无效" };
    }

    // 验证到期时间
    if (data.expireDate && data.expireDate !== "永久") {
      const expire = new Date(data.expireDate);
      if (expire < new Date()) {
        return { valid: false, reason: `License 已于 ${data.expireDate} 到期` };
      }
    }

    return { valid: true, data };
  } catch {
    return { valid: false, reason: "License 解析失败" };
  }
}

// ============== License 吊销 ==============

export interface RevocationEntry {
  licenseId: string;
  reason: string;
  revokedAt: string;
}

/**
 * 生成吊销列表签名
 */
export function signRevocationList(entries: RevocationEntry[]): string {
  const payload = JSON.stringify(entries);
  const privateKey = process.env.LICENSE_PRIVATE_KEY || "";
  if (!privateKey) return crypto.createHash("sha256").update(payload).digest("hex");

  const sign = crypto.createSign("RSA-SHA256");
  sign.update(payload);
  return sign.sign(privateKey, "base64");
}

/**
 * 试用 License 签发（无需付费，30 天有效期）
 */
export function issueTrialLicense(params: {
  company: string;
  userId: string;
}): LicenseDownloadInfo {
  return issueLicense({
    company: params.company,
    edition: "trial",
    orderNo: `TRIAL_${Date.now()}`,
    userId: params.userId,
  });
}

/** 激活 License（绑定机器指纹） */
export function activateLicense(license: any, fingerprint: string): any {
  return { ...license, fingerprint, activatedAt: new Date().toISOString() };
}
