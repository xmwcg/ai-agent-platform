import {
  ProjectGradeProjectionRecoveryWorker,
  resolveProjectGradeProjectionRecoveryConfig,
  type ProjectGradeProjectionRecoveryService,
} from './project-grade-projection-recovery.service';

const emptyReport = {
  scanned: 0,
  recovered: 0,
  skipped: 0,
  failed: 0,
  failures: [],
};

describe('ProjectGradeProjectionRecoveryWorker', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('defaults to disabled and bounds untrusted environment configuration', () => {
    expect(resolveProjectGradeProjectionRecoveryConfig({})).toEqual({
      enabled: false,
      intervalMs: 60_000,
      batchSize: 20,
    });
    expect(
      resolveProjectGradeProjectionRecoveryConfig({
        PROJECT_GRADE_PROJECTION_RECOVERY_ENABLED: 'TRUE',
        PROJECT_GRADE_PROJECTION_RECOVERY_INTERVAL_MS: '1',
        PROJECT_GRADE_PROJECTION_RECOVERY_BATCH_SIZE: '999',
      })
    ).toEqual({ enabled: true, intervalMs: 10_000, batchSize: 100 });
  });

  it('does not schedule recovery while the opt-in feature is disabled', () => {
    jest.useFakeTimers();
    const recoverExpiredEvaluationProjections = jest.fn();
    const worker = new ProjectGradeProjectionRecoveryWorker(
      { recoverExpiredEvaluationProjections },
      { enabled: false, intervalMs: 10_000, batchSize: 5 }
    );

    expect(worker.start()).toBe(false);
    jest.advanceTimersByTime(30_000);
    expect(recoverExpiredEvaluationProjections).not.toHaveBeenCalled();
  });

  it('runs immediately, schedules periodic recovery, and stops cleanly', async () => {
    jest.useFakeTimers();
    const recoverExpiredEvaluationProjections = jest.fn().mockResolvedValue(emptyReport);
    const service: ProjectGradeProjectionRecoveryService = {
      recoverExpiredEvaluationProjections,
    };
    const worker = new ProjectGradeProjectionRecoveryWorker(service, {
      enabled: true,
      intervalMs: 10_000,
      batchSize: 7,
    });

    expect(worker.start()).toBe(true);
    await Promise.resolve();
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledTimes(1);
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledWith({
      limit: 7,
      actorId: 'system:project-grade-projection-recovery',
    });

    await jest.advanceTimersByTimeAsync(10_000);
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledTimes(2);

    worker.stop();
    await jest.advanceTimersByTimeAsync(20_000);
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledTimes(2);
  });

  it('prevents overlapping recovery cycles', async () => {
    let resolveRecovery!: (value: typeof emptyReport) => void;
    const recoverExpiredEvaluationProjections = jest.fn(
      () =>
        new Promise<typeof emptyReport>((resolve) => {
          resolveRecovery = resolve;
        })
    );
    const worker = new ProjectGradeProjectionRecoveryWorker(
      { recoverExpiredEvaluationProjections },
      { enabled: true, intervalMs: 10_000, batchSize: 3 }
    );

    const first = worker.runOnce();
    await expect(worker.runOnce()).resolves.toBeUndefined();
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledTimes(1);

    resolveRecovery(emptyReport);
    await expect(first).resolves.toEqual(emptyReport);
    recoverExpiredEvaluationProjections.mockResolvedValueOnce(emptyReport);
    await expect(worker.runOnce()).resolves.toEqual(emptyReport);
    expect(recoverExpiredEvaluationProjections).toHaveBeenCalledTimes(2);
  });
});
