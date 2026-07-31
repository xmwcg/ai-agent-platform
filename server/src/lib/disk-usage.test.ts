import { calculateDiskUsage, evaluateDiskAlert } from './disk-usage';

describe('磁盘监控指标', () => {
  it('正确计算 40GB 云盘的可用空间和使用率', () => {
    const disk = calculateDiskUsage(40, 1024 ** 3, 7.4);

    expect(disk.totalGb).toBe(40);
    expect(disk.availableGb).toBe(7.4);
    expect(disk.usedGb).toBe(32.6);
    expect(disk.usedPercent).toBe(81.5);
  });

  it('仍有 7.4GB 可用且使用率 81.5% 时不误告警', () => {
    const disk = calculateDiskUsage(40, 1024 ** 3, 7.4);
    expect(evaluateDiskAlert(disk)).toBeNull();
  });

  it('使用率达到 90% 或可用空间不足 5GB 时产生警告', () => {
    const disk = calculateDiskUsage(40, 1024 ** 3, 3.2);
    expect(evaluateDiskAlert(disk)).toMatchObject({ level: 'warning' });
  });

  it('使用率达到 95% 或可用空间不足 2GB 时产生严重告警', () => {
    const disk = calculateDiskUsage(40, 1024 ** 3, 1.5);
    expect(evaluateDiskAlert(disk)).toMatchObject({ level: 'critical' });
  });
});