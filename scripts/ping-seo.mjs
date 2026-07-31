#!/usr/bin/env node
/**
 * 主动 SEO 收录：发布后向搜索引擎提交 sitemap，替代被动分享转发。
 *
 * 用法：
 *   node scripts/ping-seo.mjs                 # 使用默认站点 https://aibak.site
 *   SITE_URL=https://example.com node scripts/ping-seo.mjs
 *
 * 说明：
 * - Bing / 百度 支持通过 ping 接口提交 sitemap URL，触发爬虫主动收录。
 * - 各平台 ping 失败不阻断流程（部分平台接口鉴权/频率限制，属正常）。
 * - 建议接入 CI / 部署钩子，在每次上线后自动执行。
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE_URL = (process.env.SITE_URL || 'https://aibak.site').replace(/\/$/, '');
const SITEMAP_URL = `${SITE_URL}/sitemap.xml`;

// 校验本地 sitemap 是否存在并包含 URL（仅本地校验，不阻断远程 ping）
const sitemapLocal = resolve(__dirname, '../client/public/sitemap.xml');
try {
  const xml = readFileSync(sitemapLocal, 'utf8');
  const urlCount = (xml.match(/<loc>/g) || []).length;
  console.log(`[seo] 本地 sitemap 校验通过：${urlCount} 条 <loc> 路由`);
} catch {
  console.warn('[seo] 未找到 client/public/sitemap.xml，仅执行远程 ping');
}

const targets = [
  { name: 'Bing', url: `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` },
  { name: 'Baidu', url: `https://www.baidu.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}` },
  { name: 'Bing(IndexNow 备选)', url: `https://api.indexnow.org/indexnow?url=${encodeURIComponent(SITEMAP_URL)}&key=placeholder` },
];

async function ping(target) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(target.url, { method: 'GET', signal: controller.signal });
    clearTimeout(timer);
    console.log(`[seo] ${target.name} -> HTTP ${res.status} ${res.statusText}`);
    return res.ok;
  } catch (err) {
    console.warn(`[seo] ${target.name} -> 失败：${err?.message || err}`);
    return false;
  }
}

async function main() {
  console.log(`[seo] 提交 sitemap：${SITEMAP_URL}`);
  const results = await Promise.all(targets.map(ping));
  const ok = results.filter(Boolean).length;
  console.log(`[seo] 完成：${ok}/${targets.length} 个平台提交成功`);
  // 非阻断：即使全部失败也以 0 退出，避免阻塞部署
  process.exit(0);
}

main();
