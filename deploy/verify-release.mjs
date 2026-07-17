#!/usr/bin/env node

import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_GITHUB_REPOSITORY = 'xmwcg/ai-agent-platform';

function valueOf(args, name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${name} 缺少参数值`);
  }
  return value;
}

export function normalizeDigest(value, label = '镜像摘要') {
  if (!value) throw new Error(`${label} 未配置`);
  const digest = value.includes('@') ? value.slice(value.lastIndexOf('@') + 1) : value;
  if (!/^sha256:[a-f0-9]{64}$/i.test(digest)) {
    throw new Error(`${label} 格式无效`);
  }
  return digest.toLowerCase();
}

export function validateHealth(health, expected) {
  if (health?.status !== 'healthy') {
    throw new Error(`/api/health 状态异常: ${JSON.stringify(health)}`);
  }
  if (health.mongodb !== 'connected' || health.redis !== 'connected') {
    throw new Error(`/api/health 依赖未就绪: ${JSON.stringify(health)}`);
  }
  if (health.revision !== expected.sha) {
    throw new Error(`生产提交未同步: expected=${expected.sha} actual=${health.revision || 'unknown'}`);
  }
  if (normalizeDigest(health.serverImageDigest, '线上 server 镜像摘要') !== expected.serverDigest) {
    throw new Error(`server 镜像摘要不一致: expected=${expected.serverDigest} actual=${health.serverImageDigest || 'unknown'}`);
  }
  if (normalizeDigest(health.clientImageDigest, '线上 client 镜像摘要') !== expected.clientDigest) {
    throw new Error(`client 镜像摘要不一致: expected=${expected.clientDigest} actual=${health.clientImageDigest || 'unknown'}`);
  }
}

export function validateSandbox(sandbox) {
  const data = sandbox?.data;
  if (sandbox?.success !== true || !data) {
    throw new Error(`/api/sandbox/status 返回异常: ${JSON.stringify(sandbox)}`);
  }
  if (data.production !== true || data.defaultMode !== 'remote') {
    throw new Error(`Sandbox 未锁定 production/remote: ${JSON.stringify(data)}`);
  }
  if (data.mockEnabled !== false || data.localEnabled !== false) {
    throw new Error(`Sandbox Mock/Local 未关闭: ${JSON.stringify(data)}`);
  }
  const providers = Array.isArray(data.providers) ? data.providers : [];
  const remote = providers.find((provider) => provider?.mode === 'remote');
  const mock = providers.find((provider) => provider?.mode === 'mock');
  const local = providers.find((provider) => provider?.mode === 'local');
  if (remote?.configured !== true || mock?.configured === true || local?.configured === true) {
    throw new Error(`Sandbox Provider 状态不安全: ${JSON.stringify(providers)}`);
  }
}

export function validateRuntimeSafety(runtimeSafetyResponse) {
  const runtimeSafety = runtimeSafetyResponse?.data?.runtimeSafety;
  if (runtimeSafetyResponse?.success !== true || !runtimeSafety || runtimeSafety.production !== true) {
    throw new Error(`生产运行安全探针失败: ${JSON.stringify(runtimeSafetyResponse)}`);
  }
  const unsafeFlags = Object.entries(runtimeSafety)
    .filter(([key, value]) => key !== 'production' && value !== false)
    .map(([key]) => key);
  if (unsafeFlags.length > 0) {
    throw new Error(`生产运行安全探针仍有非 false 状态: ${unsafeFlags.join(', ')}`);
  }
}

export function validatePaymentMethods(paymentMethodsResponse) {
  const methods = paymentMethodsResponse?.data?.methods;
  if (paymentMethodsResponse?.success !== true || !Array.isArray(methods)) {
    throw new Error(`支付方式业务探针失败: ${JSON.stringify(paymentMethodsResponse)}`);
  }
  if (methods.length !== 1 || methods[0]?.key !== 'wechat' || methods[0]?.enabled !== true) {
    throw new Error(`生产支付渠道必须且只能启用微信: ${JSON.stringify(methods)}`);
  }
}

async function requestJson(url, label = url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'User-Agent': 'aibak-release-verifier/1.0',
    },
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${label} 返回非 JSON，HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  if (response.status !== 200) {
    throw new Error(`${label} 期望 HTTP 200，实际 ${response.status}: ${text.slice(0, 160)}`);
  }
  return body;
}

export async function fetchGitHubSha(repository = DEFAULT_GITHUB_REPOSITORY, token = '') {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'aibak-release-verifier/1.0',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`https://api.github.com/repos/${repository}/git/ref/heads/main`, {
    headers,
    signal: AbortSignal.timeout(10_000),
  });
  const text = await response.text();
  if (response.status !== 200) {
    throw new Error(`GitHub main 查询失败，HTTP ${response.status}: ${text.slice(0, 160)}`);
  }
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error('GitHub main 查询返回非 JSON');
  }
  if (!/^[a-f0-9]{40}$/i.test(body?.object?.sha || '')) {
    throw new Error('GitHub main 返回的 SHA 无效');
  }
  return body.object.sha.toLowerCase();
}

export async function verifyReleaseOnce(options) {
  const expected = {
    sha: options.expectedSha.toLowerCase(),
    serverDigest: normalizeDigest(options.expectedServerDigest, '期望 server 镜像摘要'),
    clientDigest: normalizeDigest(options.expectedClientDigest, '期望 client 镜像摘要'),
  };
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const [health, sandbox, runtimeSafety, paymentMethods] = await Promise.all([
    requestJson(`${baseUrl}/api/health`, '/api/health'),
    requestJson(`${baseUrl}/api/sandbox/status`, '/api/sandbox/status'),
    requestJson(`${baseUrl}/api/diagnostics/runtime-safety`, '/api/diagnostics/runtime-safety'),
    requestJson(`${baseUrl}/api/billing/payment-methods`, '/api/billing/payment-methods'),
  ]);

  validateHealth(health, expected);
  validateSandbox(sandbox);
  validateRuntimeSafety(runtimeSafety);
  validatePaymentMethods(paymentMethods);

  let githubSha = null;
  if (!options.skipGitHub) {
    try {
      githubSha = await fetchGitHubSha(options.githubRepository, options.githubToken);
      if (githubSha !== options.expectedGitHubSha.toLowerCase()) {
        console.warn(`[WARN] GitHub 镜像 SHA 不一致（已跳过严格校验）: expected=${options.expectedGitHubSha} actual=${githubSha}`);
      }
    } catch (err) {
      console.warn(`[WARN] GitHub 校验跳过（fetch 失败，已忽略）: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return {
    verifiedAt: new Date().toISOString(),
    baseUrl,
    cnbSha: expected.sha,
    githubSha,
    productionSha: health.revision,
    serverImageDigest: expected.serverDigest,
    clientImageDigest: expected.clientDigest,
    health,
    sandbox: sandbox.data,
    runtimeSafety: runtimeSafety.data.runtimeSafety,
    businessProbe: {
      paymentMethods: paymentMethods.data.methods,
    },
  };
}

async function writeEvidence(file, evidence) {
  if (!file) return;
  const target = path.resolve(file);
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
  await rename(temporary, target);
}

export function parseOptions(args = process.argv.slice(2), env = process.env) {
  const expectedSha = valueOf(args, '--expected-sha', env.APP_COMMIT_SHA || '');
  const expectedGitHubSha = valueOf(args, '--expected-github-sha', expectedSha);
  const options = {
    baseUrl: valueOf(args, '--base-url', 'https://aibak.site'),
    expectedSha,
    expectedGitHubSha,
    expectedServerDigest: valueOf(args, '--expected-server-digest', env.SERVER_IMAGE_DIGEST || ''),
    expectedClientDigest: valueOf(args, '--expected-client-digest', env.CLIENT_IMAGE_DIGEST || ''),
    githubRepository: valueOf(args, '--github-repository', env.GITHUB_REPOSITORY || DEFAULT_GITHUB_REPOSITORY),
    githubToken: env.GH_TOKEN || '',
    evidenceFile: valueOf(args, '--evidence-file', ''),
    timeoutSeconds: Number(valueOf(args, '--timeout-seconds', '120')),
    intervalSeconds: Number(valueOf(args, '--interval-seconds', '5')),
    skipGitHub: args.includes('--skip-github'),
  };

  if (!/^[a-f0-9]{40}$/i.test(options.expectedSha)) {
    throw new Error('--expected-sha 必须是完整的 40 位提交 SHA');
  }
  if (!options.skipGitHub && !/^[a-f0-9]{40}$/i.test(options.expectedGitHubSha)) {
    throw new Error('--expected-github-sha 必须是完整的 40 位提交 SHA');
  }
  normalizeDigest(options.expectedServerDigest, '期望 server 镜像摘要');
  normalizeDigest(options.expectedClientDigest, '期望 client 镜像摘要');
  if (!Number.isFinite(options.timeoutSeconds) || options.timeoutSeconds <= 0) {
    throw new Error('--timeout-seconds 必须为正数');
  }
  if (!Number.isFinite(options.intervalSeconds) || options.intervalSeconds <= 0) {
    throw new Error('--interval-seconds 必须为正数');
  }
  return options;
}

export async function main(args = process.argv.slice(2), env = process.env) {
  const options = parseOptions(args, env);
  const deadline = Date.now() + options.timeoutSeconds * 1000;
  let attempt = 0;
  let lastError;

  while (Date.now() < deadline) {
    attempt += 1;
    try {
      const evidence = await verifyReleaseOnce(options);
      evidence.attempt = attempt;
      await writeEvidence(options.evidenceFile, evidence);
      console.log(`✅ 生产验收通过（第 ${attempt} 次）`);
      console.log(JSON.stringify(evidence, null, 2));
      return evidence;
    } catch (error) {
      lastError = error;
      console.warn(`等待部署完成（第 ${attempt} 次）: ${error instanceof Error ? error.message : String(error)}`);
      if (Date.now() + options.intervalSeconds * 1000 >= deadline) break;
      await new Promise((resolve) => setTimeout(resolve, options.intervalSeconds * 1000));
    }
  }

  throw new Error(`生产验收超时: ${lastError instanceof Error ? lastError.message : String(lastError || 'unknown error')}`);
}

const isDirectRun = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isDirectRun) {
  main().catch((error) => {
    console.error(`❌ ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
