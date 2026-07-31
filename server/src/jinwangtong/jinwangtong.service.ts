/**
 * 金网通 核心服务层
 *
 * License 全生命周期管理 + 设备注册/心跳 + 下载版本管理。
 * 对接 private-license.service 签发 License，对接 MongoDB 持久化。
 *
 * @module jinwangtong.service
 * @author NexMind Team
 */

import mongoose from "mongoose";
import {
  LicenseRecord,
  DeviceRecord,
  DownloadVersion,
  ILicenseRecord,
  IDeviceRecord,
  IDownloadVersion,
} from "./jinwangtong.model";
import { issueLicense, verifyLicense } from "../services/private-license.service";
import { LICENSE_EDITIONS } from "../config/private-license";

// ============================================================
//  License 服务
// ============================================================

/**
 * 获取所有 License 版本（公开，无需登录）
 */
export function getPublicEditions() {
  return LICENSE_EDITIONS.map((e) => ({
    key: e.key,
    name: e.name,
    price: e.price,
    maxDevices: e.maxDevices,
    days: e.days,
    features: e.features,
    highlighted: e.highlighted,
    description: e.description,
    downloadUrl: e.downloadUrl,
  }));
}

/**
 * 为用户签发试用 License（需登录）
 */
export async function requestTrialLicense(userId: string, company: string) {
  const result = issueLicense({
    company: company || "个人用户",
    edition: "trial",
    orderNo: `TRIAL-${Date.now()}`,
    userId,
  });

  // 持久化到数据库
  await LicenseRecord.create({
    licenseId: result.licenseId,
    userId: new mongoose.Types.ObjectId(userId),
    company: company || "个人用户",
    edition: "trial",
    maxDevices: 3,
    expireDate: result.expireDate,
    features: result.features,
    licenseContent: result.licenseContent,
    orderNo: `TRIAL-${Date.now()}`,
    signature: "PLACEHOLDER_TRIAL",
    status: "active",
  });

  return result;
}

/**
 * 购买后自动签发正式 License
 */
export async function issuePaidLicense(params: {
  userId: string;
  company: string;
  edition: string;
  orderNo: string;
  customDays?: number;
  customDevices?: number;
}) {
  const result = issueLicense(params);

  // 持久化
  await LicenseRecord.create({
    licenseId: result.licenseId,
    userId: new mongoose.Types.ObjectId(params.userId),
    company: params.company,
    edition: params.edition,
    maxDevices: params.customDevices ?? 0,
    expireDate: result.expireDate,
    features: result.features,
    licenseContent: result.licenseContent,
    orderNo: params.orderNo,
    signature: "PLACEHOLDER_TRIAL",
    status: "active",
  });

  return result;
}

/**
 * 查询用户的所有 License
 */
export async function getUserLicenses(userId: string) {
  return LicenseRecord.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ issuedAt: -1 })
    .lean();
}

/**
 * 查询单个 License 详情
 */
export async function getLicenseDetail(licenseId: string) {
  return LicenseRecord.findOne({ licenseId }).lean();
}

/**
 * 吊销 License
 */
export async function revokeLicense(licenseId: string, reason: string) {
  return LicenseRecord.findOneAndUpdate(
    { licenseId },
    {
      status: "revoked",
      revokedAt: new Date(),
      revokeReason: reason,
    },
    { new: true }
  ).lean();
}

// ============================================================
//  设备服务
// ============================================================

/**
 * 注册设备（Agent 首次连接时调用）
 */
export async function registerDevice(params: {
  deviceId: string;
  licenseId: string;
  userId: string;
  hostname: string;
  os: string;
  osVersion?: string;
  cpuModel?: string;
  totalMemoryGB?: number;
  macAddresses?: string[];
  ipAddress?: string;
  agentVersion?: string;
}) {
  // 检查 License 是否有效
  const license = await LicenseRecord.findOne({ licenseId: params.licenseId });
  if (!license || license.status !== "active") {
    throw new Error("License 无效或已过期");
  }

  // 检查设备数是否超限
  const deviceCount = await DeviceRecord.countDocuments({ licenseId: params.licenseId });
  if (deviceCount >= license.maxDevices) {
    throw new Error(`设备数已达上限 (${license.maxDevices})`);
  }

  // Upsert 设备记录
  return DeviceRecord.findOneAndUpdate(
    { deviceId: params.deviceId },
    {
      ...params,
      userId: new mongoose.Types.ObjectId(params.userId),
      firstSeen: new Date(),
      lastHeartbeat: new Date(),
      status: "online",
    },
    { upsert: true, new: true }
  ).lean();
}

/**
 * 设备心跳上报
 */
export async function deviceHeartbeat(deviceId: string, agentVersion?: string) {
  return DeviceRecord.findOneAndUpdate(
    { deviceId },
    {
      lastHeartbeat: new Date(),
      status: "online",
      ...(agentVersion ? { agentVersion } : {}),
    },
    { new: true }
  ).lean();
}

/**
 * 查询 License 下的所有设备
 */
export async function getLicenseDevices(licenseId: string) {
  return DeviceRecord.find({ licenseId }).sort({ lastHeartbeat: -1 }).lean();
}

/**
 * 查询用户的所有设备
 */
export async function getUserDevices(userId: string) {
  return DeviceRecord.find({ userId: new mongoose.Types.ObjectId(userId) })
    .sort({ lastHeartbeat: -1 })
    .lean();
}

/**
 * 封禁设备
 */
export async function blockDevice(deviceId: string) {
  return DeviceRecord.findOneAndUpdate(
    { deviceId },
    { status: "blocked" },
    { new: true }
  ).lean();
}

// ============================================================
//  下载版本服务
// ============================================================

/**
 * 获取最新版本下载信息
 */
export async function getLatestVersion(platform?: string) {
  const filter: Record<string, unknown> = { isLatest: true };
  if (platform) filter.platform = platform;
  return DownloadVersion.find(filter).sort({ publishedAt: -1 }).lean();
}

/**
 * 获取特定平台的所有版本
 */
export async function getPlatformVersions(platform: string) {
  return DownloadVersion.find({ platform }).sort({ publishedAt: -1 }).lean();
}

/**
 * 记录下载
 */
export async function recordDownload(version: string, platform: string) {
  const result = await DownloadVersion.findOneAndUpdate(
    { version, platform, isLatest: true },
    { $inc: { downloadCount: 1 } },
    { new: true }
  ).lean();
  return result;
}

/**
 * 发布新版本（管理员）
 */
export async function publishVersion(params: {
  version: string;
  platform: string;
  arch: string;
  fileName: string;
  fileSize: number;
  downloadUrl: string;
  checksum: string;
  releaseNotes?: string;
  isLatest?: boolean;
  isBeta?: boolean;
}) {
  // 如果设为最新版本，先取消其他版本的最新标记
  if (params.isLatest) {
    await DownloadVersion.updateMany(
      { platform: params.platform, arch: params.arch },
      { isLatest: false }
    );
  }

  return DownloadVersion.create(params);
}

// ============================================================
//  统计分析服务
// ============================================================

/**
 * 获取金网通产品统计数据
 */
export async function getProductStats() {
  const [totalLicenses, activeLicenses, totalDevices, onlineDevices, totalDownloads] =
    await Promise.all([
      LicenseRecord.countDocuments(),
      LicenseRecord.countDocuments({ status: "active" }),
      DeviceRecord.countDocuments(),
      DeviceRecord.countDocuments({ status: "online" }),
      DownloadVersion.aggregate([
        { $group: { _id: null, total: { $sum: "$downloadCount" } } },
      ]).then((r) => (r[0]?.total ?? 0)),
    ]);

  return {
    totalLicenses,
    activeLicenses,
    totalDevices,
    onlineDevices,
    totalDownloads,
  };
}
