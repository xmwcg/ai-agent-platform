/**
 * 路由鉴权集成回归测试（M7）——覆盖 S1–S6 + M8 修复点
 *
 * 设计：
 * - 复用真实路由模块与真实 requireAuth 中间件（JWT 验签路径完全真实）。
 * - enforceQuota 部分 mock 为「直接放行」，以便测试进入 handler 验证业务层归属校验。
 * - 匿名访问写操作必须在 requireAuth 被拦截（401），不触达 DB —— 这是 S1–S6 的核心回归断言。
 *
 * 注意：每个路由独立构造 express app 挂载，避免 index.ts 的真实 DB 连接/ listen 副作用。
 */

// 提高集成测试超时，防止 CI 环境 flaky 失败
jest.setTimeout(15000);

import express from 'express';
import request from 'supertest';
import { generateToken } from '../middleware/auth';
import coursesRouter from '../routes/courses';
import mcpRouter from '../routes/mcp';
import billingRouter from '../routes/billing';
import ragRouter from '../routes/rag';
import aiRouter from '../routes/ai';
import diagnosticsRouter from '../routes/diagnostics';
import compareRouter from '../routes/compare';

// 部分 mock subscription：仅放行配额，保留真实 requireAuth（来自模块真实导出）
jest.mock('../middleware/subscription', () => {
  const actual = jest.requireActual('../middleware/subscription');
  return {
    __esModule: true,
    ...actual,
    enforceQuota: () => (_req: any, _res: any, next: any) => next(),
    quotaIncrement: jest.fn().mockResolvedValue(undefined),
    getQuotaUsage: jest.fn().mockResolvedValue({}),
  };
});

const userToken = generateToken({ id: 'user-1', email: 'u@example.com', role: 'user' });
const otherToken = generateToken({ id: 'user-2', email: 'o@example.com', role: 'user' });
const authHeader = (t: string) => ({ Authorization: `Bearer ${t}` });

function mount(router: any, prefix = ''): express.Express {
  const app = express();
  app.use(express.json());
  app.use(prefix, router);
  return app;
}

describe('S1 课程路由写操作鉴权', () => {
  const app = mount(coursesRouter, '/courses');

  it('匿名 POST /courses 必须返回 401（修复前为裸奔）', async () => {
    const res = await request(app).post('/courses').send({ title: 't', description: 'd' });
    expect(res.status).toBe(401);
  });

  it('匿名 PUT /courses/:id 必须返回 401', async () => {
    const res = await request(app).put('/courses/abc').send({ title: 'x' });
    expect(res.status).toBe(401);
  });

  it('匿名 PATCH /courses/:id/publish 必须返回 401', async () => {
    const res = await request(app).patch('/courses/abc/publish').send({ isPublished: true });
    expect(res.status).toBe(401);
  });

  it('匿名 POST /courses/:id/chapters 必须返回 401', async () => {
    const res = await request(app).post('/courses/abc/chapters').send({ title: 'ch' });
    expect(res.status).toBe(401);
  });

  it('GET /courses（读）对匿名开放', async () => {
    const Course = require('../models/Course').Course;
    const chain = {
      sort: () => chain,
      skip: () => chain,
      limit: () => chain,
      select: () => chain,
      then: (resolve: any) => resolve([]),
      catch: (reject: any) => reject,
    };
    Course.find = jest.fn().mockReturnValue(chain);
    Course.countDocuments = jest.fn().mockResolvedValue(0);
    const res = await request(app).get('/courses');
    expect(res.status).not.toBe(401);
  });
});

describe('S2 MCP 路由写操作鉴权', () => {
  const app = mount(mcpRouter, '/mcp');

  it('匿名 POST /mcp/servers 必须返回 401', async () => {
    const res = await request(app)
      .post('/mcp/servers')
      .send({ id: 's1', name: 's1', transport: 'stdio' });
    expect(res.status).toBe(401);
  });

  it('匿名 PUT /mcp/servers/:id 必须返回 401', async () => {
    const res = await request(app).put('/mcp/servers/s1').send({ name: 'x' });
    expect(res.status).toBe(401);
  });

  it('匿名 DELETE /mcp/servers/:id 必须返回 401', async () => {
    const res = await request(app).delete('/mcp/servers/s1');
    expect(res.status).toBe(401);
  });

  it('匿名 POST /mcp/servers/:id/call 必须返回 401', async () => {
    const res = await request(app).post('/mcp/servers/s1/call').send({ tool: 't' });
    expect(res.status).toBe(401);
  });

  it('匿名 POST /mcp/servers/:id/connect 必须返回 401', async () => {
    const res = await request(app).post('/mcp/servers/s1/connect');
    expect(res.status).toBe(401);
  });

  it('GET /mcp/servers（读）对匿名开放', async () => {
    const res = await request(app).get('/mcp/servers');
    expect(res.status).not.toBe(401);
  });
});

describe('S3 模拟支付接口鉴权', () => {
  const app = mount(billingRouter, '/billing');

  it('匿名 GET /billing/orders/:orderNo/pay 必须返回 401', async () => {
    const res = await request(app).get('/billing/orders/AI123456789abc/pay');
    expect(res.status).toBe(401);
  });

  it('登录但订单不存在返回 404（而非激活他人订单）', async () => {
    const Order = require('../models/Order').Order;
    Order.findOne = jest.fn().mockResolvedValue(null);
    const res = await request(app)
      .get('/billing/orders/AI-nonexist/pay')
      .set(authHeader(otherToken));
    expect(res.status).toBe(404);
  });

  it('登录用户访问他人订单返回 403（归属校验）', async () => {
    // stub Order.findOne 返回属于 user-1 的订单，current user 为 user-2
    const Order = require('../models/Order').Order;
    Order.findOne = jest.fn().mockResolvedValue({
      orderNo: 'AI-xyz',
      userId: { toString: () => 'user-1' },
      status: 'pending',
      save: jest.fn(),
    });
    const res = await request(app).get('/billing/orders/AI-xyz/pay').set(authHeader(otherToken));
    expect(res.status).toBe(403);
  });
});

describe('S4 RAG 嵌入接口鉴权', () => {
  const app = mount(ragRouter, '/rag');

  it('匿名 POST /rag/embed/document/:id 必须返回 401', async () => {
    const res = await request(app).post('/rag/embed/document/doc1');
    expect(res.status).toBe(401);
  });

  it('匿名 POST /rag/embed/documents 必须返回 401', async () => {
    const res = await request(app).post('/rag/embed/documents').send({ ids: ['d1'] });
    expect(res.status).toBe(401);
  });

  it('匿名 GET /rag/status 必须返回 401', async () => {
    const res = await request(app).get('/rag/status');
    expect(res.status).toBe(401);
  });
});

describe('S5 AI 会话删除鉴权', () => {
  const app = mount(aiRouter, '/ai');

  it('匿名 DELETE /ai/session/:id 必须返回 401', async () => {
    const res = await request(app).delete('/ai/session/sess1');
    expect(res.status).toBe(401);
  });

  it('匿名 DELETE /ai/session/:id/delete 必须返回 401', async () => {
    const res = await request(app).delete('/ai/session/sess1/delete');
    expect(res.status).toBe(401);
  });

  it('登录用户删除不存在会话返回 404（进入 handler 验证）', async () => {
    const aiAgentService = require('../services/ai-agent').aiAgentService;
    aiAgentService.getSession = jest.fn().mockReturnValue(undefined);
    const res = await request(app).delete('/ai/session/nope').set(authHeader(userToken));
    expect(res.status).toBe(404);
  });

  it('登录用户删除他人会话返回 403（归属校验）', async () => {
    const aiAgentService = require('../services/ai-agent').aiAgentService;
    aiAgentService.getSession = jest.fn().mockReturnValue({ userId: 'user-2' });
    const res = await request(app).delete('/ai/session/sess1').set(authHeader(userToken));
    expect(res.status).toBe(403);
  });
});

describe('S6 diagnostics 鉴权', () => {
  const app = mount(diagnosticsRouter, '/diagnostics');

  it('匿名 GET /diagnostics 必须返回 401', async () => {
    const res = await request(app).get('/diagnostics');
    expect(res.status).toBe(401);
  });

  it('登录用户可访问 /diagnostics', async () => {
    const res = await request(app).get('/diagnostics').set(authHeader(userToken));
    expect(res.status).not.toBe(401);
  });
});

describe('M8 compare 生成接口鉴权', () => {
  const app = mount(compareRouter, '/compare');

  it('匿名 POST /compare/generate 仍可用（optionalAuth，匿名放行）', async () => {
    // 不触真实 AI：stub compareService.generateCompare
    const compareService = require('../services/compare.service').compareService;
    compareService.generateCompare = jest.fn().mockResolvedValue({ items: [] });
    const res = await request(app)
      .post('/compare/generate')
      .send({ items: ['a', 'b'] });
    expect(res.status).not.toBe(401);
  });

  it('匿名缺 items 返回 400（进入 handler 验证参数）', async () => {
    const res = await request(app).post('/compare/generate').send({});
    expect(res.status).toBe(400);
  });

  it('登录用户 POST /compare/generate 通过（消耗 ai_chat 配额）', async () => {
    const compareService = require('../services/compare.service').compareService;
    compareService.generateCompare = jest.fn().mockResolvedValue({ items: [] });
    const res = await request(app)
      .post('/compare/generate')
      .set(authHeader(userToken))
      .send({ items: ['a', 'b'] });
    expect(res.status).toBe(200);
  });
});
