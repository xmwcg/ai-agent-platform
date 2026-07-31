/**
 * 金网通 MongoDB 数据模型
 *
 * 包含 License 授权、设备注册、下载版本管理三个核心模型。
 * 与金网通 enterprise-lan-management PowerShell 脚本集联动。
 *
 * @module jinwangtong.model
 * @author NexMind Team
 */

import mongoose, { Document, Schema } from "mongoose";

// ============== License 授权模型 ==============

export interface ILicenseRecord extends Document {
  licenseId: string;           // License 唯一 ID（32位hex）
  userId: mongoose.Types.ObjectId;  // 所属用户
  company: string;             // 公司/团队名称
  edition: string;             // 版本：free/trial/pro/enterprise
  maxDevices: number;          // 最大设备数
  expireDate: string;          // 过期日期（"永久" 或 ISO 日期）
  features: string[];          // 功能列表
  licenseContent: string;      // .lic 文件完整内容
  orderNo: string;             // 关联订单号
  signature: string;           // RSA-2048 签名
  issuedAt: Date;              // 签发时间
  activatedAt?: Date;          // 首次激活时间
  revokedAt?: Date;            // 吊销时间
  revokeReason?: string;       // 吊销原因
  status: "active" | "revoked" | "expired";  // 状态
  devices: string[];           // 已激活设备 ID 列表
  metadata: Record<string, unknown>;  // 扩展元数据
}

const LicenseRecordSchema = new Schema<ILicenseRecord>(
  {
    licenseId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    company: { type: String, required: true },
    edition: { type: String, required: true, enum: ["free", "trial", "pro", "enterprise"] },
    maxDevices: { type: Number, required: true, default: 3 },
    expireDate: { type: String, required: true },
    features: [{ type: String }],
    licenseContent: { type: String, required: true },
    orderNo: { type: String, required: true, index: true },
    signature: { type: String, required: true },
    issuedAt: { type: Date, default: Date.now },
    activatedAt: { type: Date },
    revokedAt: { type: Date },
    revokeReason: { type: String },
    status: { type: String, enum: ["active", "revoked", "expired"], default: "active", index: true },
    devices: [{ type: String }],
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// ============== 设备注册模型 ==============

export interface IDeviceRecord extends Document {
  deviceId: string;            // 设备唯一 ID
  licenseId: string;           // 关联 License ID
  userId: mongoose.Types.ObjectId;  // 所属用户
  hostname: string;            // 主机名
  os: string;                  // 操作系统
  osVersion: string;           // 系统版本
  cpuModel: string;            // CPU 型号
  totalMemoryGB: number;       // 总内存 (GB)
  macAddresses: string[];      // MAC 地址列表
  ipAddress: string;           // 内网 IP
  agentVersion: string;        // 金网通 Agent 版本
  lastHeartbeat: Date;         // 最后心跳时间
  firstSeen: Date;             // 首次注册时间
  status: "online" | "offline" | "blocked";  // 在线状态
  metadata: Record<string, unknown>;
}

const DeviceRecordSchema = new Schema<IDeviceRecord>(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    licenseId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    hostname: { type: String, required: true },
    os: { type: String, required: true },
    osVersion: { type: String },
    cpuModel: { type: String },
    totalMemoryGB: { type: Number },
    macAddresses: [{ type: String }],
    ipAddress: { type: String },
    agentVersion: { type: String },
    lastHeartbeat: { type: Date, default: Date.now },
    firstSeen: { type: Date, default: Date.now },
    status: { type: String, enum: ["online", "offline", "blocked"], default: "offline" },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

// ============== 下载版本管理模型 ==============

export interface IDownloadVersion extends Document {
  version: string;             // 版本号（如 2.1.0）
  platform: string;            // 平台：windows/macos/linux/android/ios
  arch: string;                // 架构：amd64/arm64
  fileName: string;            // 文件名
  fileSize: number;            // 文件大小（字节）
  downloadUrl: string;         // 下载地址
  checksum: string;            // SHA-256 校验和
  releaseNotes: string;        // 更新日志
  minAgentVersion?: string;    // 最低 Agent 版本要求
  isLatest: boolean;           // 是否最新版本
  isBeta: boolean;             // 是否测试版
  downloadCount: number;       // 下载次数
  publishedAt: Date;           // 发布时间
  metadata: Record<string, unknown>;
}

const DownloadVersionSchema = new Schema<IDownloadVersion>(
  {
    version: { type: String, required: true },
    platform: { type: String, required: true },
    arch: { type: String, required: true },
    fileName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    downloadUrl: { type: String, required: true },
    checksum: { type: String, required: true },
    releaseNotes: { type: String, default: "" },
    minAgentVersion: { type: String },
    isLatest: { type: Boolean, default: false },
    isBeta: { type: Boolean, default: false },
    downloadCount: { type: Number, default: 0 },
    publishedAt: { type: Date, default: Date.now },
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

DownloadVersionSchema.index({ version: 1, platform: 1, arch: 1 }, { unique: true });

// ============== 导出 ==============

export const LicenseRecord = mongoose.model<ILicenseRecord>("LicenseRecord", LicenseRecordSchema);
export const DeviceRecord = mongoose.model<IDeviceRecord>("DeviceRecord", DeviceRecordSchema);
export const DownloadVersion = mongoose.model<IDownloadVersion>("DownloadVersion", DownloadVersionSchema);
