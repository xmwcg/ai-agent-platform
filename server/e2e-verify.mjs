/**
 * 端到端验证脚本（临时，验证后删除）
 * - 启动内存 MongoDB（mongodb-memory-server）
 * - 以 mock 模式启动服务端（无厂商 Key 也能跑，AI 走 Mock 兜底）
 * - 逐项验证：market / catalog / invoke / install / mine
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import jwt from 'jsonwebtoken';

const PORT = 3999;
const BASE = `http://localhost:${PORT}`;
const JWT_SECRET = 'e2e-test-secret-please-ignore';

let mongo;
let serverProc;
const results = [];
function check(name, cond, detail) {
  results.push({ name, ok: !!cond, detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? '  → ' + JSON.stringify(detail).slice(0, 200) : ''}`);
}

async function startMongo() {
  mongo = await MongoMemoryServer.create();
  return mongo.getUri();
}

function startServer(mongoUri) {
  const env = {
    ...process.env,
    MONGODB_URI: mongoUri,
    PORT: String(PORT),
    ENABLE_MOCK_MODE: 'true',
    JWT_SECRET,
    NODE_ENV: 'development',
    REDIS_URL: 'redis://localhost:6379',
  };
  const p = spawn('npx', ['ts-node', '--transpile-only', 'src/index.ts'], {
    cwd: process.cwd(),
    env,
    shell: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  p.stdout.on('data', (d) => {
    const s = d.toString();
    if (/Server running on/.test(s)) console.log('   🚀 ' + s.trim());
  });
  p.stderr.on('data', (d) => process.stderr.write('   [srv-err] ' + d));
  return p;
}

async function waitReady() {
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(`${BASE}/api/health`);
      if (r.ok) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

async function main() {
  console.log('▶ 启动内存 MongoDB…');
  let mongoUri;
  try {
    mongoUri = await startMongo();
    console.log('   ✔ Mongo 就绪');
  } catch (e) {
    console.warn('   ⚠️ 内存 Mongo 启动失败（可能无网络下载二进制）：', e.message);
  }

  console.log('▶ 启动服务端…');
  serverProc = startServer(mongoUri || 'mongodb://localhost:27017/none');
  const ready = await waitReady();
  if (!ready) {
    console.error('❌ 服务端未就绪，终止');
    if (serverProc) serverProc.kill('SIGKILL');
    if (mongo) await mongo.stop();
    process.exit(1);
  }
  console.log('   ✔ 服务端已就绪\n');

  // 1) market 含 4 个 xhs-*
  try {
    const r = await (await fetch(`${BASE}/api/skills/market`)).json();
    const ids = (r.skills || []).map((s) => s.id);
    const xhs = ids.filter((x) => x.startsWith('xhs-'));
    check('GET /api/skills/market 含 4 个 xhs-*', xhs.length === 4, xhs);
  } catch (e) {
    check('GET /api/skills/market', false, e.message);
  }

  // 2) catalog 含新增条目
  try {
    const r = await (await fetch(`${BASE}/api/skills/catalog`)).json();
    const ids = (r.catalog || []).map((c) => c.id);
    const expectNew = ['mcp-memory', 'mcp-postgres', 'mcp-slack', 'skill-translator', 'skill-meeting-notes', 'link-pulsemcp', 'link-glama', 'link-composio'];
    const missing = expectNew.filter((x) => !ids.includes(x));
    check('GET /api/skills/catalog 含新增条目', missing.length === 0, { total: ids.length, missing });
  } catch (e) {
    check('GET /api/skills/catalog', false, e.message);
  }

  // 3) invoke xhs-copywriter（无需登录，requireAuth=false）
  try {
    const r = await (await fetch(`${BASE}/api/skills/xhs-copywriter/invoke`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ product: '一款主打提效的 AI 笔记 App', audience: '职场新人', style: '干货', keywords: '效率,笔记' }),
    })).json();
    check('POST /api/skills/xhs-copywriter/invoke 成功', r.ok === true && r.result?.data, {
      ok: r.ok,
      hasData: !!r.result?.data,
      provider: r.result?.data?.provider,
    });
  } catch (e) {
    check('POST /api/skills/xhs-copywriter/invoke', false, e.message);
  }

  // invoke 缺 product 应报错
  try {
    const r = await (await fetch(`${BASE}/api/skills/xhs-architect/invoke`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })).json();
    check('invoke 缺 product 返回错误', r.ok === false && !!r.error, r.error);
  } catch (e) {
    check('invoke 缺 product', false, e.message);
  }

  // 4) install（需登录）—— 生成 token
  const token = jwt.sign({ id: 'e2e-user', email: 'e2e@x.com', role: 'user' }, JWT_SECRET, { expiresIn: '1h' });
  const auth = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 4a) 安装技能包
  try {
    const r = await (await fetch(`${BASE}/api/skills/catalog/skill-translator/install`, { method: 'POST', headers: auth })).json();
    check('POST /api/skills/catalog/skill-translator/install', r.ok === true && r.type === 'skill', { ok: r.ok, type: r.type, id: r.id });
  } catch (e) {
    check('安装技能包', false, e.message);
  }

  // 4b) 安装 MCP
  try {
    const r = await (await fetch(`${BASE}/api/skills/catalog/mcp-memory/install`, { method: 'POST', headers: auth })).json();
    check('POST /api/skills/catalog/mcp-memory/install', r.ok === true && r.type === 'mcp', { ok: r.ok, type: r.type });
  } catch (e) {
    check('安装 MCP', false, e.message);
  }

  // 4c) 安装 link
  try {
    const r = await (await fetch(`${BASE}/api/skills/catalog/link-pulsemcp/install`, { method: 'POST', headers: auth })).json();
    check('POST /api/skills/catalog/link-pulsemcp/install (link)', r.ok === true && r.type === 'link', { ok: r.ok, type: r.type });
  } catch (e) {
    check('安装 link', false, e.message);
  }

  // 4d) install 不存在条目 → 404
  try {
    const res = await fetch(`${BASE}/api/skills/catalog/not-exist/install`, { method: 'POST', headers: auth });
    check('install 不存在条目 → 404', res.status === 404, { status: res.status });
  } catch (e) {
    check('install 404', false, e.message);
  }

  // 5) mine 含刚安装的技能
  try {
    const r = await (await fetch(`${BASE}/api/skills/mine`, { headers: auth })).json();
    const ids = (r.skills || []).map((s) => s.id);
    check('GET /api/skills/mine 含已安装技能', ids.includes('translator') || ids.includes('skill-translator'), ids);
  } catch (e) {
    check('GET /api/skills/mine', false, e.message);
  }

  // 汇总
  const passed = results.filter((r) => r.ok).length;
  console.log(`\n=== 结果：${passed}/${results.length} 通过 ===`);
  const failed = results.filter((r) => !r.ok);
  if (failed.length) console.log('失败项：', failed.map((f) => f.name).join('; '));

  if (serverProc) serverProc.kill('SIGKILL');
  if (mongo) await mongo.stop();
  process.exit(failed.length ? 1 : 0);
}

main().catch(async (e) => {
  console.error('💥 验证脚本异常：', e);
  if (serverProc) serverProc.kill('SIGKILL');
  if (mongo) await mongo.stop();
  process.exit(1);
});
