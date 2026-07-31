import { logger } from '../lib/logger';
import {
  projectGradeService,
  type RecoverExpiredProjectGradeProjectionsReport,
} from './project-grade.service';

const DEFAULT_INTERVAL_MS = 60_000;
const MIN_INTERVAL_MS = 10_000;
const MAX_INTERVAL_MS = 60 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 20;

export interface ProjectGradeProjectionRecoveryConfig {
  enabled: boolean;
  intervalMs: number;
  batchSize: number;
}

export interface ProjectGradeProjectionRecoveryService {
  recoverExpiredEvaluationProjections(options: {
    limit: number;
    actorId: string;
  }): Promise<RecoverExpiredProjectGradeProjectionsReport>;
}

function boundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number
): number {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, parsed));
}

export function resolveProjectGradeProjectionRecoveryConfig(
  env: NodeJS.ProcessEnv = process.env
): ProjectGradeProjectionRecoveryConfig {
  return {
    enabled: env.PROJECT_GRADE_PROJECTION_RECOVERY_ENABLED?.trim().toLowerCase() === 'true',
    intervalMs: boundedInteger(
      env.PROJECT_GRADE_PROJECTION_RECOVERY_INTERVAL_MS,
      DEFAULT_INTERVAL_MS,
      MIN_INTERVAL_MS,
      MAX_INTERVAL_MS
    ),
    batchSize: boundedInteger(
      env.PROJECT_GRADE_PROJECTION_RECOVERY_BATCH_SIZE,
      DEFAULT_BATCH_SIZE,
      1,
      100
    ),
  };
}

export class ProjectGradeProjectionRecoveryWorker {
  private timer?: NodeJS.Timeout;
  private inFlight?: Promise<RecoverExpiredProjectGradeProjectionsReport>;

  constructor(
    private readonly recoveryService: ProjectGradeProjectionRecoveryService = projectGradeService,
    private readonly config: ProjectGradeProjectionRecoveryConfig = resolveProjectGradeProjectionRecoveryConfig()
  ) {}

  start(): boolean {
    if (!this.config.enabled) {
      logger.info(
        'project-grade-projection-recovery',
        'ProjectGrade 投影恢复 worker 未启用；仅保留请求触发恢复。'
      );
      return false;
    }
    if (this.timer) return true;

    void this.runAndLog();
    this.timer = setInterval(() => {
      void this.runAndLog();
    }, this.config.intervalMs);
    this.timer.unref();

    logger.info(
      'project-grade-projection-recovery',
      `ProjectGrade 投影恢复 worker 已启动，intervalMs=${this.config.intervalMs}, batchSize=${this.config.batchSize}`
    );
    return true;
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  async runOnce(): Promise<RecoverExpiredProjectGradeProjectionsReport | undefined> {
    if (this.inFlight) return undefined;

    const recovery = this.recoveryService.recoverExpiredEvaluationProjections({
      limit: this.config.batchSize,
      actorId: 'system:project-grade-projection-recovery',
    });
    this.inFlight = recovery;
    try {
      return await recovery;
    } finally {
      if (this.inFlight === recovery) this.inFlight = undefined;
    }
  }

  private async runAndLog(): Promise<void> {
    try {
      const report = await this.runOnce();
      if (!report) return;
      if (report.scanned === 0) return;

      const message = `ProjectGrade 过期投影恢复完成：scanned=${report.scanned}, recovered=${report.recovered}, skipped=${report.skipped}, failed=${report.failed}`;
      if (report.failed > 0) {
        logger.warn('project-grade-projection-recovery', message, {
          failures: report.failures,
        });
      } else {
        logger.info('project-grade-projection-recovery', message);
      }
    } catch (error) {
      logger.error(
        'project-grade-projection-recovery',
        `ProjectGrade 过期投影恢复轮询失败: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }
}

export const projectGradeProjectionRecoveryWorker = new ProjectGradeProjectionRecoveryWorker();
