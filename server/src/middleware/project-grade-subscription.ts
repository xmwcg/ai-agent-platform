import type { NextFunction, Response } from 'express';
import { PLANS, QUOTA_RESOURCE_LABELS, type PlanId, type QuotaResource } from '../config/billing';
import { redisClient } from '../config/database';
import { AppError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { ProjectGradeProject } from '../models/ProjectGradeProject';
import type { AuthRequest } from './auth';
import { resolveUserPlan } from './subscription';

export const PROJECT_GRADE_UPGRADE_URL = '/pricing?source=project-grade&returnTo=%2Fproject-grade%2Fprojects';

export const PROJECT_GRADE_DAILY_RESOURCES = [
  'project_grade_url_scan',
  'project_grade_source_scan',
  'project_grade_evaluation',
  'project_grade_report_publish',
  'project_grade_report_download',
] as const satisfies readonly QuotaResource[];

export type ProjectGradeDailyQuotaResource = (typeof PROJECT_GRADE_DAILY_RESOURCES)[number];

export interface ProjectGradeQuotaSnapshot {
  resource: ProjectGradeDailyQuotaResource;
  label: string;
  used: number;
  limit: number;
  remaining: number;
}

export interface ProjectGradeEntitlementSnapshot {
  plan: {
    id: PlanId;
    name: string;
    expired: boolean;
    upgradeUrl: string;
  };
  projects: {
    used: number;
    limit: number;
    remaining: number;
  };
  daily: Record<ProjectGradeDailyQuotaResource, ProjectGradeQuotaSnapshot>;
  capabilities: {
    reportPublishEnabled: boolean;
    reportDownloadEnabled: boolean;
    reportValidityDays: number;
    removeAibakBranding: boolean;
  };
  accounting: {
    timezone: 'UTC';
    resetsAt: string;
  };
}

function todayKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function nextUtcReset(now = new Date()): string {
  const reset = new Date(now);
  reset.setUTCHours(24, 0, 0, 0);
  return reset.toISOString();
}

function quotaKey(userId: string, resource: ProjectGradeDailyQuotaResource): string {
  return `quota:${userId}:${resource}:${todayKey()}`;
}

function remaining(limit: number, used: number): number {
  return limit === -1 ? -1 : Math.max(0, limit - used);
}

async function releaseCounter(key: string, by = 1): Promise<void> {
  try {
    const after = Number(await redisClient.incrby(key, -by));
    if (after <= 0) await redisClient.del(key);
  } catch (error) {
    logger.error('project-grade-subscription', `Failed to release quota reservation for ${key}`, error);
  }
}

function releaseOnFailedResponse(res: Response, release: () => Promise<void>): void {
  let responseFinished = false;
  let released = false;
  const releaseOnce = async () => {
    if (released) return;
    released = true;
    await release();
  };

  res.once('finish', () => {
    responseFinished = true;
    if (res.statusCode >= 400) void releaseOnce();
  });
  res.once('close', () => {
    if (!responseFinished) void releaseOnce();
  });
}

function sendQuotaUnavailable(res: Response): void {
  res.status(503).json({
    success: false,
    error: '智评通权益服务暂时不可用，请稍后重试',
    code: 'PROJECT_GRADE_ENTITLEMENT_SERVICE_UNAVAILABLE',
  });
}

/**
 * 智评通每日额度采用请求开始时的 Redis 原子预占。
 * 与通用 enforceQuota 不同：这里 fail-closed，且 BYOK 不能绕过商业权益。
 * 业务返回 4xx/5xx 或连接中断时自动退回本次预占。
 */
export function enforceProjectGradeDailyQuota(resource: ProjectGradeDailyQuotaResource) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({ success: false, error: '请先登录', code: 'AUTH_REQUIRED' });
      return;
    }

    try {
      const { plan } = await resolveUserPlan(req.user.id);
      const limit = PLANS[plan].limits[resource];

      if (limit === -1) {
        res.setHeader('X-AIBak-Quota-Limit', '-1');
        res.setHeader('X-AIBak-Quota-Remaining', '-1');
        next();
        return;
      }

      if (limit <= 0) {
        res.status(402).json({
          success: false,
          error: `当前${PLANS[plan].name}不包含${QUOTA_RESOURCE_LABELS[resource]}权益`,
          code: 'PROJECT_GRADE_QUOTA_EXCEEDED',
          resource,
          label: QUOTA_RESOURCE_LABELS[resource],
          limit,
          used: 0,
          remaining: 0,
          currentPlan: plan,
          upgradeUrl: PROJECT_GRADE_UPGRADE_URL,
        });
        return;
      }

      const key = quotaKey(req.user.id, resource);
      const used = Number(await redisClient.incrby(key, 1));
      if (used === 1) {
        try {
          await redisClient.expire(key, 86400);
        } catch (error) {
          await releaseCounter(key);
          throw error;
        }
      }

      if (used > limit) {
        await releaseCounter(key);
        res.status(402).json({
          success: false,
          error: `今日${QUOTA_RESOURCE_LABELS[resource]}额度已用尽`,
          code: 'PROJECT_GRADE_QUOTA_EXCEEDED',
          resource,
          label: QUOTA_RESOURCE_LABELS[resource],
          limit,
          used: limit,
          remaining: 0,
          currentPlan: plan,
          upgradeUrl: PROJECT_GRADE_UPGRADE_URL,
        });
        return;
      }

      res.setHeader('X-AIBak-Quota-Limit', String(limit));
      res.setHeader('X-AIBak-Quota-Remaining', String(Math.max(0, limit - used)));
      releaseOnFailedResponse(res, () => releaseCounter(key));
      next();
    } catch (error) {
      logger.error('project-grade-subscription', `Quota reservation failed for ${resource}`, error);
      sendQuotaUnavailable(res);
    }
  };
}

/**
 * 项目容量是持久权益而非每日用量。数据库活动项目数与短时 Redis 并发预占共同判定，
 * 避免同一账号并发创建请求越过套餐容量。
 */
export async function enforceProjectGradeProjectCapacity(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: '请先登录', code: 'AUTH_REQUIRED' });
    return;
  }

  let reservationKey: string | null = null;
  try {
    const { plan } = await resolveUserPlan(req.user.id);
    const limit = PLANS[plan].projectGrade.activeProjects;
    const used = await ProjectGradeProject.countDocuments({ ownerId: req.user.id, status: 'active' });

    if (limit === -1) {
      res.setHeader('X-AIBak-Project-Limit', '-1');
      res.setHeader('X-AIBak-Project-Remaining', '-1');
      next();
      return;
    }

    reservationKey = `project-grade:project-capacity:${req.user.id}`;
    const inFlight = Number(await redisClient.incrby(reservationKey, 1));
    if (inFlight === 1) {
      try {
        await redisClient.expire(reservationKey, 120);
      } catch (error) {
        await releaseCounter(reservationKey);
        throw error;
      }
    }

    if (used + inFlight > limit) {
      await releaseCounter(reservationKey);
      reservationKey = null;
      res.status(402).json({
        success: false,
        error: `当前${PLANS[plan].name}最多可保留 ${limit} 个活动项目`,
        code: 'PROJECT_GRADE_PROJECT_LIMIT_REACHED',
        used,
        limit,
        remaining: Math.max(0, limit - used),
        currentPlan: plan,
        upgradeUrl: PROJECT_GRADE_UPGRADE_URL,
      });
      return;
    }

    res.setHeader('X-AIBak-Project-Limit', String(limit));
    res.setHeader('X-AIBak-Project-Remaining', String(Math.max(0, limit - used - inFlight)));
    const heldKey = reservationKey;
    releaseOnFailedResponse(res, () => releaseCounter(heldKey));
    // 成功创建后数据库会成为权威计数，因此响应完成时也释放短时并发预占。
    res.once('finish', () => {
      if (res.statusCode < 400) void releaseCounter(heldKey);
    });
    next();
  } catch (error) {
    if (reservationKey) await releaseCounter(reservationKey);
    logger.error('project-grade-subscription', 'Project capacity check failed', error);
    sendQuotaUnavailable(res);
  }
}

export async function getProjectGradeEntitlementSnapshot(
  userId: string
): Promise<ProjectGradeEntitlementSnapshot> {
  try {
    const { plan, expired } = await resolveUserPlan(userId);
    const planConfig = PLANS[plan];
    const projectLimit = planConfig.projectGrade.activeProjects;
    const projectUsed = await ProjectGradeProject.countDocuments({ ownerId: userId, status: 'active' });

    const entries = await Promise.all(
      PROJECT_GRADE_DAILY_RESOURCES.map(async (resource) => {
        const limit = planConfig.limits[resource];
        const used = Number(await redisClient.get(quotaKey(userId, resource))) || 0;
        return [
          resource,
          {
            resource,
            label: QUOTA_RESOURCE_LABELS[resource],
            used,
            limit,
            remaining: remaining(limit, used),
          },
        ] as const;
      })
    );

    return {
      plan: {
        id: plan,
        name: planConfig.name,
        expired,
        upgradeUrl: PROJECT_GRADE_UPGRADE_URL,
      },
      projects: {
        used: projectUsed,
        limit: projectLimit,
        remaining: remaining(projectLimit, projectUsed),
      },
      daily: Object.fromEntries(entries) as ProjectGradeEntitlementSnapshot['daily'],
      capabilities: { ...planConfig.projectGrade },
      accounting: {
        timezone: 'UTC',
        resetsAt: nextUtcReset(),
      },
    };
  } catch (error) {
    logger.error('project-grade-subscription', 'Entitlement snapshot failed', error);
    throw new AppError(
      503,
      '智评通权益服务暂时不可用，请稍后重试',
      'PROJECT_GRADE_ENTITLEMENT_SERVICE_UNAVAILABLE'
    );
  }
}
