jest.mock('../config/ai-models', () => ({
  __esModule: true,
  getPreferredAgnesTextModel: jest.fn(() => 'agnes25/agnes-2.5-flash'),
}));

jest.mock('../gateway/ai-gateway.service', () => ({
  __esModule: true,
  route: jest.fn(),
}));

jest.mock('../middleware/subscription', () => ({
  __esModule: true,
  enforceQuota: () => (_req: any, _res: any, next: any) => next(),
  quotaIncrement: jest.fn().mockResolvedValue(undefined),
}));

import express from 'express';
import request from 'supertest';
import { route } from '../gateway/ai-gateway.service';
import { Course } from '../models/Course';
import learningPathRouter, { isLearningPathTemplateFallbackAllowed } from './learning-path';

const mockedRoute = route as jest.MockedFunction<typeof route>;
const OLD_ENV = process.env;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/learning-path', learningPathRouter);
  return app;
}

function mockPublishedCourses() {
  const chain: any = {
    select: jest.fn(() => chain),
    limit: jest.fn(() => chain),
    lean: jest.fn().mockResolvedValue([
      { _id: 'course-1', title: '真实课程', level: 'beginner', category: 'AI' },
    ]),
  };
  const find = jest.spyOn(Course, 'find') as unknown as jest.Mock;
  find.mockReturnValue(chain);
}

function mockCompletion(content: string) {
  mockedRoute.mockResolvedValue({
    reply: content,
    provider: 'agnes25',
    model: 'agnes-2.5-flash',
  } as any);
}

describe('学习路径生产真实 AI 门禁', () => {
  beforeEach(() => {
    process.env = { ...OLD_ENV, NODE_ENV: 'production' };
    mockedRoute.mockReset();
    mockPublishedCourses();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('生产环境 Provider 失败时返回 503，不回退静态模板伪装成功', async () => {
    mockedRoute.mockRejectedValue(new Error('provider down'));

    const response = await request(createApp())
      .post('/api/learning-path/generate')
      .send({ level: 'beginner', goal: '学习 AI' });

    expect(response.status).toBe(503);
    expect(response.body.code).toBe('LEARNING_PATH_PROVIDER_UNAVAILABLE');
    expect(response.body.success).toBe(false);
  });

  it('生产环境 AI 返回非法 JSON 时返回 502', async () => {
    mockCompletion('not-json');

    const response = await request(createApp())
      .post('/api/learning-path/generate')
      .send({ level: 'beginner' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('LEARNING_PATH_INVALID_RESPONSE');
  });

  it('生产环境 AI 返回缺字段结构时返回 502', async () => {
    mockCompletion(JSON.stringify({ title: '不完整路径', milestones: [] }));

    const response = await request(createApp())
      .post('/api/learning-path/generate')
      .send({ level: 'beginner' });

    expect(response.status).toBe(502);
    expect(response.body.code).toBe('LEARNING_PATH_INVALID_RESPONSE');
  });

  it('有效 AI 结果以 generatedBy=ai 返回，并明确使用 Agnes 2.5', async () => {
    mockCompletion(JSON.stringify({
      title: '个性化 AI 路径',
      description: '真实模型生成',
      targetLevel: 'beginner',
      estimatedWeeks: 4,
      milestones: [
        { week: 1, title: '起步', description: '学习基础', courses: [{ id: 'course-1', title: '真实课程' }] },
      ],
    }));

    const response = await request(createApp())
      .post('/api/learning-path/generate')
      .send({ level: 'beginner' });

    expect(response.status).toBe(200);
    expect(response.body.data).toEqual(expect.objectContaining({
      title: '个性化 AI 路径',
      generatedBy: 'ai',
    }));
    expect(mockedRoute).toHaveBeenCalledWith(expect.objectContaining({
      model: 'agnes25/agnes-2.5-flash',
    }));
  });

  it('模板回退只允许非生产环境', () => {
    expect(isLearningPathTemplateFallbackAllowed('production')).toBe(false);
    expect(isLearningPathTemplateFallbackAllowed('development')).toBe(true);
    expect(isLearningPathTemplateFallbackAllowed('test')).toBe(true);
  });

  it('开发环境 Provider 失败时明确返回 generatedBy=template 的预置模板', async () => {
    process.env = { ...OLD_ENV, NODE_ENV: 'development' };
    mockedRoute.mockRejectedValue(new Error('provider down'));

    const response = await request(createApp())
      .post('/api/learning-path/generate')
      .send({ level: 'beginner' });

    expect(response.status).toBe(200);
    expect(response.body.data.generatedBy).toBe('template');
  });
});
