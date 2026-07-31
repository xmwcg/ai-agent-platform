#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(process.argv[2] || 'client/dist');
const textExtensions = new Set(['.html', '.js', '.css']);
const assetPattern = /(?:(?:\/assets\/)|(?:\.\/))([A-Za-z0-9_.-]+\.(?:js|css|woff2?|png|svg|webp|jpg|jpeg))/g;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) {
  console.error(`构建产物目录不存在：${root}`);
  process.exit(1);
}

const indexPath = path.join(root, 'index.html');
if (!fs.existsSync(indexPath)) {
  console.error(`缺少入口文件：${indexPath}`);
  process.exit(1);
}

const indexHtml = fs.readFileSync(indexPath, 'utf8');
const hasModernEntry = /<script\b[^>]*type=["']module["'][^>]*src=["'][^"']+["']/i.test(indexHtml);
const hasLegacyEntry = /vite-legacy-entry|(?:^|[\/"'])[^"']+-legacy-[A-Za-z0-9_-]+\.js/i.test(indexHtml);
const entryViolations = [];
if (!hasModernEntry) entryViolations.push('index.html 缺少现代 ES module 入口');
if (hasLegacyEntry) entryViolations.push('index.html 包含 legacy 入口，禁止发布 legacy 或 legacy-only 构建');

const files = walk(root);
const relativeFiles = new Set(files.map((file) => path.relative(root, file).split(path.sep).join('/')));
const references = [];

for (const file of files) {
  if (!textExtensions.has(path.extname(file).toLowerCase())) continue;
  const text = fs.readFileSync(file, 'utf8');
  for (const match of text.matchAll(assetPattern)) {
    references.push({
      source: path.relative(root, file).split(path.sep).join('/'),
      target: `assets/${match[1]}`,
    });
  }
}

const missing = references.filter((item) => !relativeFiles.has(item.target));
const duplicateKey = (item) => `${item.source}\u0000${item.target}`;
const uniqueMissing = [...new Map(missing.map((item) => [duplicateKey(item), item])).values()];
const indexSha256 = crypto.createHash('sha256').update(indexHtml).digest('hex');
const report = {
  root,
  files: files.length,
  assets: [...relativeFiles].filter((file) => file.startsWith('assets/')).length,
  references: references.length,
  missing: uniqueMissing,
  entryMode: hasModernEntry ? (hasLegacyEntry ? 'mixed' : 'modern') : (hasLegacyEntry ? 'legacy-only' : 'missing'),
  entryViolations,
  indexSha256,
};

console.log(JSON.stringify(report, null, 2));
if (uniqueMissing.length > 0) {
  console.error(`检测到 ${uniqueMissing.length} 个缺失的构建资源，拒绝发布。`);
}
for (const violation of entryViolations) console.error(`构建入口违规：${violation}`);
if (uniqueMissing.length > 0 || entryViolations.length > 0) process.exit(1);
console.log('DIST_INTEGRITY_OK');
