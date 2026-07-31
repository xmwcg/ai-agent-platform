#!/usr/bin/env node
/**
 * 生产依赖安全门禁。
 *
 * 默认拒绝全部 high/critical 漏洞。当前唯一例外是 React Router RSC Mode 通告：
 * NexMind 客户端为纯浏览器 SPA，不启用 RSC、Server Actions 或服务端 Router，受影响代码路径不可达。
 */
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const target = process.argv[2];
if (!target) {
  console.error('用法: node scripts/audit-production-deps.cjs <client|server>');
  process.exit(2);
}

const cwd = path.resolve(process.cwd(), target);
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const result = spawnSync(
  npm,
  ['audit', '--omit=dev', '--audit-level=high', '--json', '--registry=https://registry.npmjs.org'],
  { cwd, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024, shell: process.platform === 'win32' }
);

if (result.error || result.status === null || !result.stdout) {
  console.error(result.error?.message || result.stderr || 'npm audit 未返回可解析结果');
  process.exit(1);
}

let report;
try {
  report = JSON.parse(result.stdout || '{}');
} catch (error) {
  console.error(result.stdout || result.stderr || error.message);
  process.exit(1);
}

if (report.error) {
  console.error(JSON.stringify(report.error));
  process.exit(1);
}

const vulnerabilities = Object.entries(report.vulnerabilities || {}).filter(([, detail]) =>
  ['high', 'critical'].includes(detail.severity)
);

if (vulnerabilities.length === 0) {
  console.log(`AUDIT_OK ${target}: 0 high/critical vulnerabilities`);
  process.exit(0);
}

const allowedAdvisory = 'GHSA-qwww-vcr4-c8h2';
const names = vulnerabilities.map(([name]) => name).sort();
const onlyRscAdvisory = names.length === 2
  && names[0] === 'react-router'
  && names[1] === 'react-router-dom'
  && vulnerabilities.every(([name, detail]) => {
    if (name === 'react-router-dom') {
      return detail.via.every((item) => item === 'react-router');
    }
    return detail.via.every((item) =>
      typeof item === 'object' && String(item.url || '').includes(allowedAdvisory)
    );
  });

if (target === 'client' && onlyRscAdvisory) {
  const packageJson = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const forbiddenPackages = ['@react-router/node', '@react-router/serve'];
  const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
  const hasServerPackage = forbiddenPackages.some((name) => dependencies[name]);
  const sourceRoot = path.join(cwd, 'src');
  const forbiddenApi = /createStaticRouter|StaticRouterProvider|ServerRouter|RSCRouter|react-router\/rsc/i;
  let hasServerApi = false;
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(?:ts|tsx|js|jsx)$/.test(entry.name) && forbiddenApi.test(fs.readFileSync(full, 'utf8'))) {
        hasServerApi = true;
      }
    }
  };
  walk(sourceRoot);
  if (!hasServerPackage && !hasServerApi) {
    console.log(`AUDIT_RISK_ACCEPTED ${target}: ${allowedAdvisory} 仅影响未启用的 RSC/Server Actions 路径`);
    process.exit(0);
  }
}

console.error(JSON.stringify({ target, vulnerabilities: Object.fromEntries(vulnerabilities) }, null, 2));
process.exit(1);
