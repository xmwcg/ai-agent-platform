import express from 'express';
import request from 'supertest';

const redisStore = new Map<string, number>();
const mockRedisGet = jest.fn(async (key: string) => {
  const value = redisStore.get(key);
  return value === undefined ? null : String(value);
});
const mockRedisIncrBy = jest.fn(async (key: string, by: number) => {
  const next = (redisStore.get(key) || 0) + by;
  redisStore.set(key, next);
  return next;
});
const mockRedisExpire = jest.fn(async () => 1);
const mockRedisDel = jest.fn(async (key: string) => {
  const existed = redisStore.delete(key);
  return existed ? 1 : 0;
});
const mockResolveUserPlan = jest.fn(async () => ({ plan: 'free', expired: false }));
const mockCountDocuments = jest.fn(async () => 0);

jest.mock('../config/database', () => ({
  redisClient: {
    get: mockRedisGet,
    incrby: mockRedisIncrBy,
    expire: mockRedisExpire,
    del: mockRedisDel,
  },
}));

jest.mock('./subscription', () => ({
  resolveUserPlan: mockResolveUserPlan,
}));

jest.mock('../models/ProjectGradeProject', () => ({
  ProjectGradeProject: {
    countDocuments: mockCountDocuments,
  },
}));

jest.mock('../lib/logger', () => ({
  logger: { error: jest.fn(), warn: jest.fn(), info: jest.fn() },
}));

import {
  enforceProjectGradeDailyQuota,
  enforceProjectGradeProjectCapacity,
  getProjectGradeEntitlementSnapshot,
} from './project-grade-subscription';

function quotaKey(resource: string): string {
  return `quota:user-1:${resource}:${new Date().toISOString().slice(0, 10)}`;
}

function buildQuotaApp(resource: 'project_grade_url_scan' | 'project_grade_source_scan') {
  const app = express();
  app.use(express.json());
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-1' };
    req.byokBypass = true;
    next();
  });
  app.post('/success', enforceProjectGradeDailyQuota(resource), (_req, res) => {
    res.status(201).json({ success: true });
  });
  app.post('/failure', enforceProjectGradeDailyQuota(resource), (_req, res) => {
    res.status(500).json({ success: false });
  });
  return app;
}

function buildCapacityApp() {
  const app = express();
  app.use((req: any, _res, next) => {
    req.user = { id: 'user-1' };
    next();
  });
  app.post('/projects', enforceProjectGradeProjectCapacity, (_req, res) => {
    res.status(201).json({ success: true });
  });
  return app;
}

describe('ProjectGrade subscription enforcement', () => {
  beforeEach(() => {
    redisStore.clear();
    jest.clearAllMocks();
    mockResolveUserPlan.mockResolvedValue({ plan: 'free', expired: false });
    mockCountDocuments.mockResolvedValue(0);
    mockRedisGet.mockImplementation(async (key: string) => {
      const value = redisStore.get(key);
      return value === undefined ? null : String(value);
    });
    mockRedisIncrBy.mockImplementation(async (key: string, by: number) => {
      const next = (redisStore.get(key) || 0) + by;
      redisStore.set(key, next);
      return next;
    });
    mockRedisExpire.mockResolvedValue(1);
    mockRedisDel.mockImplementation(async (key: string) => {
      const existed = redisStore.delete(key);
      return existed ? 1 : 0;
    });
  });

  it('atomically reserves quota and does not allow BYOK to bypass ProjectGrade rights', async () => {
    const response = await request(buildQuotaApp('project_grade_url_scan')).post('/success');

    expect(response.status).toBe(201);
    expect(response.headers['x-aibak-quota-limit']).toBe('3');
    expect(response.headers['x-aibak-quota-remaining']).toBe('2');
    expect(redisStore.get(quotaKey('project_grade_url_scan'))).toBe(1);
    expect(mockRedisIncrBy).toHaveBeenCalledTimes(1);
  });

  it('blocks the request before the handler when the atomic reservation exceeds the limit', async () => {
    redisStore.set(quotaKey('project_grade_url_scan'), 3);
    const response = await request(buildQuotaApp('project_grade_url_scan')).post('/success');

    expect(response.status).toBe(402);
    expect(response.body.code).toBe('PROJECT_GRADE_QUOTA_EXCEEDED');
    expect(redisStore.get(quotaKey('project_grade_url_scan'))).toBe(3);
  });

  it('rejects a feature whose current plan limit is zero without touching Redis', async () => {
    const response = await request(buildQuotaApp('project_grade_source_scan')).post('/success');

    expect(response.status).toBe(402);
    expect(response.body.resource).toBe('project_grade_source_scan');
    expect(mockRedisIncrBy).not.toHaveBeenCalled();
  });

  it('releases a quota reservation when the business handler returns an error', async () => {
    const response = await request(buildQuotaApp('project_grade_url_scan')).post('/failure');
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(500);
    expect(redisStore.has(quotaKey('project_grade_url_scan'))).toBe(false);
  });

  it('fails closed when Redis cannot reserve quota', async () => {
    mockRedisIncrBy.mockRejectedValueOnce(new Error('redis unavailable'));
    const response = await request(buildQuotaApp('project_grade_url_scan')).post('/success');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PROJECT_GRADE_ENTITLEMENT_SERVICE_UNAVAILABLE');
  });

  it('blocks project creation when the persistent capacity has been reached', async () => {
    mockCountDocuments.mockResolvedValueOnce(1);
    const response = await request(buildCapacityApp()).post('/projects');
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(402);
    expect(response.body.code).toBe('PROJECT_GRADE_PROJECT_LIMIT_REACHED');
    expect(response.body).toMatchObject({ used: 1, limit: 1, remaining: 0 });
    expect(redisStore.size).toBe(0);
  });

  it('holds a short concurrency reservation while an allowed project creation is running', async () => {
    const response = await request(buildCapacityApp()).post('/projects');
    await new Promise((resolve) => setImmediate(resolve));

    expect(response.status).toBe(201);
    expect(response.headers['x-aibak-project-limit']).toBe('1');
    expect(redisStore.size).toBe(0);
  });

  it('fails closed when the project count cannot be read', async () => {
    mockCountDocuments.mockRejectedValueOnce(new Error('mongo unavailable'));
    const response = await request(buildCapacityApp()).post('/projects');

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PROJECT_GRADE_ENTITLEMENT_SERVICE_UNAVAILABLE');
  });

  it('returns the current plan, project capacity and daily ProjectGrade usage', async () => {
    redisStore.set(quotaKey('project_grade_url_scan'), 2);
    mockCountDocuments.mockResolvedValueOnce(1);

    const snapshot = await getProjectGradeEntitlementSnapshot('user-1');

    expect(snapshot.plan).toMatchObject({ id: 'free', name: '免费版', expired: false });
    expect(snapshot.projects).toEqual({ used: 1, limit: 1, remaining: 0 });
    expect(snapshot.daily.project_grade_url_scan).toMatchObject({
      used: 2,
      limit: 3,
      remaining: 1,
    });
    expect(snapshot.daily.project_grade_source_scan.limit).toBe(0);
    expect(snapshot.capabilities.reportPublishEnabled).toBe(false);
  });
});
