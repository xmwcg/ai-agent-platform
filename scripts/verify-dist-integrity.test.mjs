import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const verifier = path.join(currentDir, 'verify-dist-integrity.mjs');

function createDist(indexHtml, assets = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexmind-dist-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), indexHtml, 'utf8');
  for (const [name, content] of Object.entries(assets)) {
    fs.writeFileSync(path.join(root, 'assets', name), content, 'utf8');
  }
  return root;
}

function verify(root) {
  return spawnSync(process.execPath, [verifier, root], { encoding: 'utf8' });
}

test('现代 module 构建通过完整性门禁', (t) => {
  const root = createDist('<div id="root"></div><script type="module" src="/assets/index-modern.js"></script>', {
    'index-modern.js': 'console.log("ok")',
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = verify(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"entryMode": "modern"/);
  assert.match(result.stdout, /DIST_INTEGRITY_OK/);
});

test('legacy-only 构建必须被拒绝', (t) => {
  const root = createDist('<script id="vite-legacy-entry" data-src="/assets/index-legacy-bad.js"></script>', {
    'index-legacy-bad.js': 'console.log("legacy")',
  });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = verify(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"entryMode": "legacy-only"/);
  assert.match(result.stderr, /禁止发布 legacy/);
});

test('缺少现代入口的空壳 index 必须被拒绝', (t) => {
  const root = createDist('<div id="root"></div>');
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const result = verify(root);
  assert.notEqual(result.status, 0);
  assert.match(result.stdout, /"entryMode": "missing"/);
  assert.match(result.stderr, /缺少现代 ES module 入口/);
});
