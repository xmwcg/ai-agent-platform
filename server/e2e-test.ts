/**
 * 进程内端到端验证（临时，验证后删除）
 * 直接挂载 skills 路由 + 内存 MongoDB，避免启动整服务的长耗时。
 * 依赖 shell 已设置 ENABLE_MOCK_MODE=true 与 JWT_SECRET。
 */
import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import jwt from 'jsonwebtoken';
import skillsRouter from './src/routes/skills';

const JWT_SECRET = process.env.JWT_SECRET || 'e2e-test-secret';
const results: { name: string; ok: boolean; detail: any }[] = [];
function log(name: string, ok: boolean, detail?: any) {
  results.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail !== undefined ? '  → ' + JSON.stringify(detail).slice(0, 240) : ''}`);
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  console.log('✔ 内存 MongoDB 就绪');

  const app = express();
  app.use(express.json());
  app.use('/api/skills', skillsRouter);

  const token = jwt.sign({ id: 'e2e-user', email: 'e2e@x.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { Authorization: `Bearer ${token}` };

  // 1) market 含 4 个 xhs-*
  const market = await request(app).get('/api/skills/market');
  const mIds = (market.body.skills || []).map((s: any) => s.id);
  const xhs = mIds.filter((x: string) => x.startsWith('xhs-'));
  log('GET /api/skills/market 含 4 个 xhs-*', xhs.length === 4, xhs);

  // 2) catalog 含新增条目
  const cat = await request(app).get('/api/skills/catalog');
  const cIds = (cat.body.catalog || []).map((c: any) => c.id);
  const expect = ['mcp-memory', 'mcp-postgres', 'mcp-slack', 'mcp-google-maps', 'mcp-gitlab', 'mcp-everything', 'skill-translator', 'skill-meeting-notes', 'skill-sql-helper', 'skill-email-writer', 'link-pulsemcp', 'link-glama', 'link-composio', 'link-awesome-mcp', 'link-cline-marketplace'];
  const missing = expect.filter((x) => !cIds.includes(x));
  log('GET /api/skills/catalog 含全部新增条目', missing.length === 0, { total: cIds.length, missing });

  // 3) invoke copywriter（无需登录）
  const inv = await request(app).post('/api/skills/xhs-copywriter/invoke').send({ product: '一款主打提效的 AI 笔记 App', audience: '职场新人', style: '干货', keywords: '效率,笔记' });
  log('POST /api/skills/xhs-copywriter/invoke 成功', inv.body.ok === true && !!inv.body.result?.data, { ok: inv.body.ok, provider: inv.body.result?.data?.provider, hasStructured: !!inv.body.result?.data?.structured });

  // 3b) invoke 缺 product 应报错
  const inv2 = await request(app).post('/api/skills/xhs-architect/invoke').send({});
  log('invoke 缺 product 返回错误', inv2.body.ok === false && !!inv2.body.error, inv2.body.error);

  // 4) install 技能包
  const inst = await request(app).post('/api/skills/catalog/skill-translator/install').set(auth);
  log('POST /api/skills/catalog/skill-translator/install', inst.body.ok === true && inst.body.type === 'skill', { ok: inst.body.ok, type: inst.body.type, id: inst.body.id });

  // 4b) install MCP
  const instm = await request(app).post('/api/skills/catalog/mcp-memory/install').set(auth);
  log('POST /api/skills/catalog/mcp-memory/install', instm.body.ok === true && instm.body.type === 'mcp', { ok: instm.body.ok, type: instm.body.type });

  // 4c) install link
  const instl = await request(app).post('/api/skills/catalog/link-pulsemcp/install').set(auth);
  log('POST /api/skills/catalog/link-pulsemcp/install (link)', instl.body.ok === true && instl.body.type === 'link', { ok: instl.body.ok, type: instl.body.type });

  // 4d) install 不存在 → 404
  const nf = await request(app).post('/api/skills/catalog/not-exist/install').set(auth);
  log('install 不存在条目 → 404', nf.status === 404, { status: nf.status });

  // 5) mine 含已安装技能
  const mine = await request(app).get('/api/skills/mine').set(auth);
  const mineIds = (mine.body.skills || []).map((s: any) => s.id);
  log('GET /api/skills/mine 含已安装技能', mineIds.includes('translator') || mineIds.includes('skill-translator'), mineIds);

  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== 结果：${passed}/${results.length} 通过 ===`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.log('失败项：', failed.map((f) => f.name).join('; '));

  await mongoose.disconnect();
  await mongo.stop();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('💥 验证异常：', e);
  process.exit(1);
});
