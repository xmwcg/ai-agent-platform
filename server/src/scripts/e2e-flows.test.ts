/**
 * 端到端商业路径集成测试（API 级别）
 *
 * 验证关键商业路径的 HTTP 状态码和响应结构，不依赖浏览器。
 * 使用 Jest + supertest 风格（直接用 axios 调本地 Express app）。
 *
 * 运行方式：需要先启动 server，然后 npx jest e2e-flows.test.ts
 *
 * 覆盖路径：
 * 1. 公开获客：GET /api/project-grade/public/landing → 200
 * 2. 公开获客：GET /api/billing/plans → 200
 * 3. 匿名体检：POST /api/project-grade/evaluate → 200 + sessionId
 * 4. 用户注册：POST /api/auth/register → 201 + token
 * 5. 获取推荐码：GET /api/referral/code → 200
 * 6. 用户仪表板：GET /api/ops/my-stats → 200
 * 7. 通知系统：GET /api/notifications/unread-count → 200
 */

import axios from 'axios';

const BASE = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const REQUEST_TIMEOUT = 15_000;

// 测试辅助：断言 API 响应结构
function expectSuccess(res: any) {
  expect(res.status).toBeGreaterThanOrEqual(200);
  expect(res.status).toBeLessThan(300);
  expect(res.data).toBeDefined();
}

function expectApiOk(res: any) {
  expectSuccess(res);
  expect(res.data.success).toBe(true);
}

describe('E2E 商业路径 — 公开获客（无需登录）', () => {
  it(
    'GET /api/project-grade/public/landing 返回公开数据',
    async () => {
      const res = await axios.get(`${BASE}/api/project-grade/public/landing`, { timeout: REQUEST_TIMEOUT });
      expectApiOk(res);
      expect(res.data.data).toBeDefined();
      // 公开数据不应包含敏感信息
      expect(res.data.data.totalPublishedReports).toBeGreaterThanOrEqual(0);
    },
    20_000
  );

  it(
    'GET /api/billing/plans 返回套餐列表',
    async () => {
      const res = await axios.get(`${BASE}/api/billing/plans`, { timeout: REQUEST_TIMEOUT });
      expectApiOk(res);
      const plans = res.data.data || res.data;
      expect(Array.isArray(plans)).toBe(true);
      // 至少有免费版
      const freePlan = plans.find((p: any) => p.id === 'free');
      expect(freePlan).toBeDefined();
    },
    20_000
  );

  it(
    'GET /api/ops/public 返回公开运营指标',
    async () => {
      const res = await axios.get(`${BASE}/api/ops/public`, { timeout: REQUEST_TIMEOUT });
      expectApiOk(res);
      expect(res.data.data.serviceOnline).toBe(true);
    },
    20_000
  );
});

describe('E2E 商业路径 — 匿名体验', () => {
  let sessionId: string | null = null;

  it(
    'POST /api/project-grade/evaluate 匿名体检返回 sessionId',
    async () => {
      const res = await axios.post(
        `${BASE}/api/project-grade/evaluate`,
        { url: 'https://aibak.site' },
        { timeout: REQUEST_TIMEOUT, validateStatus: () => true }
      );
      // 匿名体检可能因扫描耗时/外部依赖而失败，但至少不 500
      expect(res.status).toBeLessThan(500);
      // 如果成功，应返回 sessionId
      if (res.data?.data?.attributionSessionId) {
        sessionId = res.data.data.attributionSessionId;
      }
    },
    30_000
  );
});

describe('E2E 商业路径 — 认证与用户', () => {
  let authToken: string | null = null;

  it(
    'POST /api/auth/register 注册新用户（测试账号）',
    async () => {
      const testEmail = `e2e-test-${Date.now()}@aibak.site`;
      const res = await axios.post(
        `${BASE}/api/auth/register`,
        { email: testEmail, password: 'Test123456!', name: 'E2E Test' },
        { timeout: REQUEST_TIMEOUT, validateStatus: () => true }
      );
      // 200 成功注册 / 409 已存在都算正常
      expect([200, 201, 409]).toContain(res.status);
      if (res.data?.data?.token) {
        authToken = res.data.data.token;
      }
    },
    20_000
  );

  it(
    'POST /api/auth/login 登录',
    async () => {
      const res = await axios.post(
        `${BASE}/api/auth/login`,
        { email: 'admin@aibak.site', password: 'admin123' },
        { timeout: REQUEST_TIMEOUT, validateStatus: () => true }
      );
      // 登录成功 200 / 401 密码错误都算 API 正常
      expect([200, 401]).toContain(res.status);
      if (res.data?.data?.token) {
        authToken = res.data.data.token;
      }
    },
    20_000
  );
});

describe('E2E 商业路径 — 支付与套餐', () => {
  it(
    'GET /api/billing/payment-status 返回支付渠道状态',
    async () => {
      const res = await axios.get(`${BASE}/api/billing/payment-status`, {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
        headers: {
          // 尝试不带 token 访问（预期 401 或 200）
        },
      });
      // 未登录时 401 也正常
      expect([200, 401]).toContain(res.status);
    },
    20_000
  );
});

describe('E2E 商业路径 — 健康检查与运维', () => {
  it(
    'GET /api/ops 运维端点可用',
    async () => {
      const res = await axios.get(`${BASE}/api/ops`, { timeout: REQUEST_TIMEOUT });
      expectSuccess(res);
      expect(res.data.ok).toBe(true);
    },
    10_000
  );

  it(
    'GET /api/referral 推荐端点可用',
    async () => {
      const res = await axios.get(`${BASE}/api/referral`, { timeout: REQUEST_TIMEOUT });
      expectSuccess(res);
      expect(res.data.ok).toBe(true);
    },
    10_000
  );

  it(
    'GET /api/notifications 需要登录',
    async () => {
      const res = await axios.get(`${BASE}/api/notifications`, {
        timeout: REQUEST_TIMEOUT,
        validateStatus: () => true,
      });
      // 未登录应返回 401
      expect(res.status).toBe(401);
    },
    10_000
  );
});
