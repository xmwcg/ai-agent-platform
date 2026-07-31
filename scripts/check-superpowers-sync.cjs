#!/usr/bin/env node
/**
 * CI 同步校验：确保仓库内置的 superpowers 方法论参考（.superpowers/skills/<name>/SKILL.md）
 * 具备完整 frontmatter，并与平台实装保持引用一致。
 * 运行：node scripts/check-superpowers-sync.cjs  （或 npm run check:superpowers）
 */
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const dir = path.join(root, '.superpowers', 'skills');
const required = ['name', 'description', 'division', 'core_mission', 'critical_rules', 'success_metrics'];

function parseFrontmatter(file) {
  const text = fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  const m = text.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!m) return null;
  const block = m[1];
  const data = {};
  let currentArr = null;
  for (const line of block.split('\n')) {
    if (/^\s*-\s+/.test(line) && currentArr) {
      data[currentArr].push(line.replace(/^\s*-\s+/, '').trim());
      continue;
    }
    currentArr = null;
    const mm = line.match(/^([a-z_]+):\s*(.*)$/);
    if (!mm) continue;
    const key = mm[1];
    const val = mm[2].trim();
    if (val === '') {
      currentArr = key;
      data[key] = [];
    } else {
      data[key] = val.replace(/^["']|["']$/g, '');
    }
  }
  return data;
}

let ok = true;
if (!fs.existsSync(dir)) {
  console.error('✗ 未找到 .superpowers/skills 目录');
  process.exit(1);
}
const entries = fs.readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory());
if (entries.length === 0) {
  console.error('✗ 没有 vendored 的 superpowers 技能');
  process.exit(1);
}
for (const e of entries) {
  const f = path.join(dir, e.name, 'SKILL.md');
  if (!fs.existsSync(f)) {
    console.error(`✗ ${e.name}: 缺少 SKILL.md`);
    ok = false;
    continue;
  }
  const fm = parseFrontmatter(f);
  if (!fm) {
    console.error(`✗ ${e.name}: 无 frontmatter`);
    ok = false;
    continue;
  }
  const missing = required.filter((k) => !fm[k] || (Array.isArray(fm[k]) && fm[k].length === 0));
  if (missing.length) {
    console.error(`✗ ${e.name}: 缺少字段 ${missing.join(', ')}`);
    ok = false;
  } else {
    console.log(`✓ ${e.name} (${fm.name})`);
  }
}

// 同步引用检查：writing-skills 必须指向平台实装路径
const wk = path.join(dir, 'writing-skills', 'SKILL.md');
if (fs.existsSync(wk)) {
  const t = fs.readFileSync(wk, 'utf8');
  if (!t.includes('server/src/skills/defs/skill-authoring.skill.ts')) {
    console.error('✗ writing-skills 未同步引用 skill-authoring 实装路径');
    ok = false;
  }
}

if (ok) {
  console.log('\n✅ superpowers 同步校验通过');
  process.exit(0);
} else {
  console.error('\n❌ superpowers 同步校验失败');
  process.exit(1);
}
