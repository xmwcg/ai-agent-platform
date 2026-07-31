import { statfsSync } from 'fs';

const BYTES_PER_GIB = 1024 ** 3;

export interface DiskUsage {
  path: string;
  totalGb: number;
  usedGb: number;
  availableGb: number;
  usedPercent: number;
}

export interface DiskAlertThresholds {
  warningUsedPercent: number;
  criticalUsedPercent: number;
  warningAvailableGb: number;
  criticalAvailableGb: number;
}

export interface DiskAlert {
  level: 'critical' | 'warning';
  message: string;
  fix: string;
}

export const DEFAULT_DISK_ALERT_THRESHOLDS: DiskAlertThresholds = {
  warningUsedPercent: 90,
  criticalUsedPercent: 95,
  warningAvailableGb: 5,
  criticalAvailableGb: 2,
};

function round(value: number, digits = 1): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

export function calculateDiskUsage(
  blocks: number,
  blockSize: number,
  availableBlocks: number,
  path = '/',
): DiskUsage {
  const totalBytes = Math.max(0, blocks * blockSize);
  const availableBytes = Math.max(0, Math.min(totalBytes, availableBlocks * blockSize));
  const usedBytes = Math.max(0, totalBytes - availableBytes);

  return {
    path,
    totalGb: round(totalBytes / BYTES_PER_GIB),
    usedGb: round(usedBytes / BYTES_PER_GIB),
    availableGb: round(availableBytes / BYTES_PER_GIB),
    usedPercent: totalBytes > 0 ? round((usedBytes / totalBytes) * 100) : 0,
  };
}

/**
 * 容器根目录与宿主机共用同一 overlay 后端，读取 / 可反映生产根分区的真实容量。
 */
export function getSystemDiskUsage(path = '/'): DiskUsage {
  const stats = statfsSync(path);
  return calculateDiskUsage(stats.blocks, stats.bsize, stats.bavail, path);
}

/**
 * 小容量云盘不能只按百分比告警：同时结合可用 GB，避免仍有充足空间时误报。
 */
export function evaluateDiskAlert(
  disk: DiskUsage,
  thresholds: DiskAlertThresholds = DEFAULT_DISK_ALERT_THRESHOLDS,
): DiskAlert | null {
  if (
    disk.usedPercent >= thresholds.criticalUsedPercent
    || disk.availableGb < thresholds.criticalAvailableGb
  ) {
    return {
      level: 'critical',
      message: `磁盘空间严重不足: 已使用 ${disk.usedPercent}% / 可用 ${disk.availableGb}GB`,
      fix: '立即清理可重建缓存或扩容；禁止删除数据库、上传文件、密钥和备份',
    };
  }

  if (
    disk.usedPercent >= thresholds.warningUsedPercent
    || disk.availableGb < thresholds.warningAvailableGb
  ) {
    return {
      level: 'warning',
      message: `磁盘空间偏高: 已使用 ${disk.usedPercent}% / 可用 ${disk.availableGb}GB`,
      fix: '优先清理 Docker 构建缓存、包管理缓存和已确认无用的临时文件',
    };
  }

  return null;
}