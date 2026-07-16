#!/usr/bin/env node

const args = process.argv.slice(2);

function valueOf(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数值`);
  }
  return value;
}

const baseUrl = valueOf('--base-url', 'https://aibak.site').replace(/\/$/, '');
const expectedSha = valueOf('--expected-sha', process.env.APP_COMMIT_SHA || '');
const timeoutSeconds = Number(valueOf('--timeout-seconds', '120'));
const intervalSeconds = Number(valueOf('--interval-seconds', '5'));
const allowUnknownRevision = args.includes('--allow-unknown-revision');

if (!expectedSha) {
  throw new Error('必须通过 --expected-sha 或 APP_COMMIT_SHA 指定期望提交');
}
if (!Number.isFinite(timeoutSeconds) || timeoutSeconds <= 0) {
  throw new Error('--timeout-seconds 必须为正数');
}
if (!Number.isFinite(intervalSeconds) || intervalSeconds <= 0) {
  throw new Error('--interval-seconds 必须为正数');
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestJson(path) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${path} 返回非 JSON，HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  if (response.status !== 200) {
    throw new Error(`${path} 期望 HTTP 200，实际 ${response.status}: ${text.slice(0, 160)}`);
  }
  return body;
}

async function verifyOnce() {
  const health = await requestJson('/api/health');
  const sandbox = await requestJson('/api/sandbox/status');

  if (health.status !== 'healthy') {
    throw new Error(`/api/health 状态异常: ${JSON.stringify(health)}`);
  }
  if (health.mongodb !== 'connected' || health.redis !== 'connected') {
    throw new Error(`/api/health 依赖未就绪: ${JSON.stringify(health)}`);
  }
  if (health.revision !== expectedSha) {
    const actualRevision = health.revision || 'unknown';
    if (!(allowUnknownRevision && actualRevision === 'unknown')) {
      throw new Error(`线上版本尚未同步: expected=${expectedSha} actual=${actualRevision}`);
    }
  }
  if (sandbox.success !== true) {
    throw new Error(`/api/sandbox/status 返回异常: ${JSON.stringify(sandbox)}`);
  }

  return { health, sandbox };
}

const deadline = Date.now() + timeoutSeconds * 1000;
let attempt = 0;
let lastError;

while (Date.now() < deadline) {
  attempt += 1;
  try {
    const result = await verifyOnce();
    console.log(`✅ 生产验收通过（第 ${attempt} 次）`);
    console.log(JSON.stringify({
      baseUrl,
      revision: result.health.revision,
      mongodb: result.health.mongodb,
      redis: result.health.redis,
      sandboxMode: result.sandbox.data?.defaultMode,
      sandboxProviders: result.sandbox.data?.providers,
    }, null, 2));
    process.exit(0);
  } catch (error) {
    lastError = error;
    console.warn(`等待部署完成（第 ${attempt} 次）: ${error.message}`);
    if (Date.now() + intervalSeconds * 1000 >= deadline) break;
    await sleep(intervalSeconds * 1000);
  }
}

console.error(`❌ 生产验收超时: ${lastError?.message || 'unknown error'}`);
process.exit(1);
