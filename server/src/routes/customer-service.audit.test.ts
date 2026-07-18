/**
 * 可信合规客服 - 审计日志（Audit Log）测试
 * 覆盖：buildAuditEntry 纯函数、对话落库审计、匿名拦截、合规查询/导出/统计。
 * 沿用项目风格：mongoose/ioredis 由 test/setup.ts 全局 mock，路由测试挂载真实路由 + 真实 requireAuth。
 */
import express from 'express';
import request from 'supertest';
import { generateAccessToken } from '../middleware/auth';
import csRouter from './customer-service';
import { buildAuditEntry } from '../models/CustomerService';

// 配额中间件放行，聚焦审计业务逻辑
jest.mock('../middleware/subscription', () => ({
  __esModule: true,
  enforceQuota: () => (_req: any, _res: any, next: any) => next(),
  quotaIncrement: jest.fn().mockResolvedValue(undefined),
  getQuotaUsage: jest.fn(),
}));

// 模型整体 mock，但保留真实 buildAuditEntry（纯函数）
jest.mock('../models/CustomerService', () => {
  const actual = jest.requireActual('../models/CustomerService');
  return {
    __esModule: true,
    ...actual,
    CustomerService: { findOne: jest.fn(), findById: jest.fn(), findByIdAndUpdate: jest.fn() },
    CustomerServiceSession: { findOne: jest.fn(), create: jest.fn(), findOneAndUpdate: jest.fn() },
    CustomerServiceAuditLog: {
      create: jest.fn().mockResolvedValue({}),
      find: jest.fn(),
      findOneAndUpdate: jest.fn(),
      countDocuments: jest.fn(),
      aggregate: jest.fn(),
    },
  };
});

const { CustomerService, CustomerServiceSession, CustomerServiceAuditLog } = require('../models/CustomerService');
const userToken = generateAccessToken({ id: 'user-1', email: 'u@example.com', role: 'user' });
const authHeader = (t: string) => ({ Authorization: `Bearer ${t}` });

const fakeCs = {
  _id: 'bot_1',
  name: '合规客服',
  embedCode: 'embed_1',
  enabled: true,
  knowledgeBaseIds: [],
  handoffEnabled: true,
  handoffPrompt: '正在为您转人工',
  fallbackMessage: '暂无法回答',
  welcomeMessage: '您好',
  ownerId: 'user-1',
  teamId: undefined,
};

const auditItems = [
  {
    _id: 'a1', botId: 'bot_1', sessionId: 'sess_1', visitorId: 'v1',
    question: '退款政策', answer: '根据文档...', sources: [{ title: '退款政策', confidence: 0.9 }],
    similarityAvg: 0.9, escalated: false, createdAt: new Date().toISOString(),
  },
];

function mount(): express.Express {
  const app = express();
  app.use(express.json());
  app.use('/api/customer-service', csRouter);
  return app;
}

beforeAll(() => { process.env.ENABLE_MOCK_MODE = 'true'; });
beforeEach(() => {
  jest.clearAllMocks();
  CustomerService.findOne.mockResolvedValue(fakeCs);
  CustomerService.findById.mockResolvedValue(fakeCs);
  CustomerService.findByIdAndUpdate.mockResolvedValue({});
  CustomerServiceSession.findOne.mockResolvedValue(null);
  CustomerServiceSession.create.mockResolvedValue({
    _id: 'sess_1', visitorId: 'v1', messages: [], save: jest.fn().mockResolvedValue(undefined),
  });
  CustomerServiceSession.findOneAndUpdate.mockResolvedValue({ satisfaction: 5 });
  const findChain: any = {
    sort: () => findChain, skip: () => findChain, limit: () => findChain,
    lean: () => Promise.resolve(auditItems),
  };
  CustomerServiceAuditLog.find.mockReturnValue(findChain);
  CustomerServiceAuditLog.findOneAndUpdate.mockResolvedValue({});
  CustomerServiceAuditLog.countDocuments.mockResolvedValue(auditItems.length);
  CustomerServiceAuditLog.aggregate.mockResolvedValue([]);
});

describe('buildAuditEntry 纯函数', () => {
  it('空来源时 similarityAvg 为 0', () => {
    const e = buildAuditEntry({ botId: 'b', sessionId: 's', visitorId: 'v', question: 'q', answer: 'a', escalated: false });
    expect(e.similarityAvg).toBe(0);
    expect(e.escalated).toBe(false);
    expect(e.botId).toBe('b');
  });
  it('多来源时 similarityAvg 为均值（保留3位）', () => {
    const e = buildAuditEntry({
      botId: 'b', sessionId: 's', visitorId: 'v', question: 'q', answer: 'a', escalated: true,
      sources: [{ docId: 'd1', title: 't1', confidence: 0.9, snippet: 'x' }, { docId: 'd2', title: 't2', confidence: 0.5, snippet: 'y' }],
    });
    expect(e.similarityAvg).toBe(0.7);
    expect(e.escalated).toBe(true);
  });
});

describe('对话落审计日志', () => {
  const app = mount();
  it('普通问答应写入审计日志（含问题/答案/未转人工）', async () => {
    const res = await request(app)
      .post('/api/customer-service/chat/embed_1')
      .send({ message: '退款怎么操作', visitorId: 'v1' });
    expect(res.status).toBe(200);
    expect(res.body.data.reply).toBe('暂无法回答');
    expect(CustomerServiceAuditLog.create).toHaveBeenCalledTimes(1);
    const entry = CustomerServiceAuditLog.create.mock.calls[0][0];
    expect(entry.botId).toBe('bot_1');
    expect(entry.sessionId).toBe('sess_1');
    expect(entry.question).toBe('退款怎么操作');
    expect(entry.escalated).toBe(false);
  });

  it('命中转人工关键词应记录 escalated=true 且答案为转人工话术', async () => {
    const res = await request(app)
      .post('/api/customer-service/chat/embed_1')
      .send({ message: '我要转人工', visitorId: 'v1' });
    expect(res.status).toBe(200);
    expect(res.body.data.escalated).toBe(true);
    expect(res.body.data.reply).toBe('正在为您转人工');
    const entry = CustomerServiceAuditLog.create.mock.calls[0][0];
    expect(entry.escalated).toBe(true);
  });
});

describe('合规审计日志接口', () => {
  const app = mount();
  it('匿名访问 /:id/audit-logs 必须 401', async () => {
    const res = await request(app).get('/api/customer-service/bot_1/audit-logs');
    expect(res.status).toBe(401);
  });

  it('授权后可分页查询并拿到总数', async () => {
    const res = await request(app)
      .get('/api/customer-service/bot_1/audit-logs?page=1&pageSize=20')
      .set(authHeader(userToken));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.total).toBe(auditItems.length);
    expect(res.body.data.items.length).toBe(auditItems.length);
  });

  it('可导出 CSV 且带有 BOM 与表头', async () => {
    const res = await request(app)
      .get('/api/customer-service/bot_1/audit-logs/export?format=csv')
      .set(authHeader(userToken));
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text.startsWith('﻿')).toBe(true);
    expect(res.text).toContain('问题');
    expect(res.text).toContain('是否转人工');
  });

  it('统计接口返回结构（总量/转人工率/满意度/高频来源）', async () => {
    const res = await request(app)
      .get('/api/customer-service/bot_1/audit-stats')
      .set(authHeader(userToken));
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('escalatedRate');
    expect(res.body.data).toHaveProperty('avgSatisfaction');
    expect(res.body.data).toHaveProperty('topSources');
  });

  it('非拥有者访问审计日志应 403', async () => {
    CustomerService.findById.mockResolvedValue({ ...fakeCs, ownerId: 'other-user' });
    const res = await request(app)
      .get('/api/customer-service/bot_1/audit-logs')
      .set(authHeader(userToken));
    expect(res.status).toBe(403);
  });
});
