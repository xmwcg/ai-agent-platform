/**
 * 生产就绪冒烟测试：验证全链路商业闭环。
 *
 * 运行：npx ts-node src/scripts/production-readiness-smoke.ts
 *
 * 本测试按顺序执行：
 *   1. 公开匿名 URL 体检（验证归因 sessionId 返回）
 *   2. 公开 Landing 聚合数据（验证非鉴权可访问）
 *   3. 公开报告详情（验证公开报告 API）
 *   4. 套餐查询（验证定价接口）
 *   5. 健康检查（验证 DB/Redis 连通）
 *
 * 注意：此测试仅验证公开 API 合约；需要鉴权的端点由 Jest 集成测试覆盖。
 */

import http from 'http';
import assert from 'assert';

const BASE = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:3000';
const TIMEOUT = 10000;

function request(method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: any }> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const data = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      url,
      {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        timeout: TIMEOUT,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode || 0, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  console.log('🔍 AIbak 生产就绪冒烟测试');
  console.log(`   目标: ${BASE}`);
  console.log('');

  // ─── 1. Health Check ───
  console.log('1. 健康检查...');
  const health = await request('GET', '/api/health');
  assert.strictEqual(health.status, 200, '健康检查应返回 200');
  assert(health.body?.mongodb, 'MongoDB 应连接');
  assert(health.body?.redis, 'Redis 应连接');
  console.log(`   ✅ status=${health.body.status} mongo=${health.body.mongodb} redis=${health.body.redis} uptime=${health.body.uptime}s`);

  // ─── 2. Billing Plans (Public) ───
  console.log('2. 套餐定价...');
  const plans = await request('GET', '/api/billing/plans');
  assert.strictEqual(plans.status, 200, '套餐接口应返回 200');
  assert(Array.isArray(plans.body?.data), '套餐数据应为数组');
  const freePlan = plans.body.data.find((p: any) => p.id === 'free');
  const proPlan = plans.body.data.find((p: any) => p.id === 'pro');
  assert(freePlan, '应有免费版套餐');
  assert(proPlan, '应有专业版套餐');
  console.log(`   ✅ 共 ${plans.body.data.length} 档套餐（免费: ¥${(freePlan.priceMonthly/100).toFixed(1)}/月, 专业: ¥${(proPlan.priceMonthly/100).toFixed(1)}/月）`);

  // ─── 3. ProjectGrade Public Landing ───
  console.log('3. 智评通公开落地页...');
  const landing = await request('GET', '/api/project-grade/public/landing');
  assert.strictEqual(landing.status, 200, '公开落地页应返回 200');
  assert(typeof landing.body?.data?.totalPublishedReports === 'number', '应有 totalPublishedReports');
  console.log(`   ✅ 已公开 ${landing.body.data.totalPublishedReports} 份报告, ${landing.body.data.totalPublicProjects} 个项目`);

  // ─── 4. ProjectGrade Anonymous Evaluate ───
  console.log('4. 匿名 URL 体检...');
  const evaluate = await request('POST', '/api/project-grade/evaluate', {
    projectName: 'Smoke Test',
    projectUrl: 'https://aibak.site',
    projectType: 'website',
  });
  assert.strictEqual(evaluate.status, 200, '匿名体检应返回 200');
  assert(evaluate.body?.data?.run, '应有评估运行');
  assert(typeof evaluate.body?.data?.attributionSessionId === 'string', '应返回归因 sessionId');
  console.log(`   ✅ grade=${evaluate.body.data.run.grade} score=${evaluate.body.data.run.externalScore?.toFixed(1)} sessionId=${evaluate.body.data.attributionSessionId.slice(0,8)}...`);

  // ─── 5. ProjectGrade Public Reports ───
  console.log('5. 公开报告列表...');
  const reports = await request('GET', '/api/project-grade/public/reports?limit=3');
  assert.strictEqual(reports.status, 200, '公开报告列表应返回 200');
  console.log(`   ✅ ${Array.isArray(reports.body?.data?.reports) ? reports.body.data.reports.length : 0} 份公开报告`);

  // ─── 6. Ops Public Metrics ───
  console.log('6. 运营公开指标...');
  const ops = await request('GET', '/api/ops/public');
  assert.strictEqual(ops.status, 200, '运营公开指标应返回 200');
  console.log(`   ✅ ok=${ops.body?.success}`);

  console.log('');
  console.log('🎉 全部冒烟测试通过。生产就绪 API 合约验证完成。');
  console.log('');
  console.log('下一步生产部署检查清单：');
  console.log('  □ 1. 服务器配置 server/.env（MONGODB_URI, REDIS_URL, JWT_SECRET）');
  console.log('  □ 2. 配置 WECHAT_OPEN_APPID/SECRET 启用微信登录（可选）');
  console.log('  □ 3. 配置真实支付密钥启用收款（可选，Mock 模式可先用）');
  console.log('  □ 4. 执行 bash deploy/push-deploy.sh 完成部署');
  console.log('  □ 5. 验证 https://aibak.site 可访问全栈功能');
  console.log('  □ 6. 验证 https://aibak.site/project-grade/demo 可匿名体检');
}

main().catch((err) => {
  console.error('❌ 冒烟测试失败:', err.message);
  process.exit(1);
});