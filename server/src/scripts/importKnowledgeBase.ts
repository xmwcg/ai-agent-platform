/**
 * 金奕鸣通用知识库 · Markdown 内容库导入器
 * 读取项目根 knowledge-base/ 目录树下的 .md 文件（含 YAML frontmatter），
 * 解析为 KnowledgeDocument 并幂等 UPSERT 进 MongoDB。
 *
 * 用法：
 *   ts-node --transpile-only src/scripts/importKnowledgeBase.ts            # 导入
 *   ts-node --transpile-only src/scripts/importKnowledgeBase.ts --dry-run  # 仅解析校验，不写库
 * 也可被 seedKnowledge.ts 调用：seedKnowledgeBase(root?, dryRun?)
 */
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { KnowledgeDocument } from '../models/KnowledgeDocument';

dotenv.config();

export interface ImportDoc {
  title: string;
  content: string;
  tags: string[];
  categories: string[];
  categoryTree: string[];
  requiredPlan: 'free' | 'pro' | 'max';
  creditsCost: number;
  freePreviewPages: number;
  vendor?: string;
  sourceUrl?: string;
  fetchedAt?: string;
}

const SYSTEM_AUTHOR = '64b0f2c2c3d4e5f600000001';

/** 最小 YAML frontmatter 解析：支持 `key: value`、行内列表 `[a, b]`、数字、引号字符串 */
function parseFrontmatter(fm: string): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const raw of fm.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim();
    let val = line.slice(idx + 1).trim();
    if (!key) continue;
    if (val.startsWith('[') && val.endsWith(']')) {
      out[key] = val
        .slice(1, -1)
        .split(',')
        .map((s) => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean);
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      out[key] = Number(val);
    } else {
      out[key] = val.replace(/^['"]|['"]$/g, '');
    }
  }
  return out;
}

/** 读取知识库目录，返回解析后的文档列表（不连接数据库） */
export function loadKnowledgeBase(root?: string): ImportDoc[] {
  // 从 cwd 向上探测 knowledge-base 目录（ts-node 下 __dirname 不可靠）
  let base = root || process.env.KB_ROOT || '';
  if (!base || !fs.existsSync(base)) {
    let dir = process.cwd();
    while (true) {
      const cand = path.join(dir, 'knowledge-base');
      if (fs.existsSync(cand)) {
        base = cand;
        break;
      }
      const parent = path.dirname(dir);
      if (parent === dir) {
        base = '';
        break;
      }
      dir = parent;
    }
  }
  if (!base || !fs.existsSync(base)) {
    throw new Error('未找到 knowledge-base 目录，请从项目根或 server 目录运行，或用 KB_ROOT 指定');
  }
  const docs: ImportDoc[] = [];
  const warnings: string[] = [];
  const walk = (dir: string) => {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        const raw = fs.readFileSync(p, 'utf-8').replace(/\r\n/g, '\n');
        const m = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
        if (!m) {
          warnings.push(`跳过（无 frontmatter）: ${path.relative(base, p)}`);
          continue;
        }
        const fm = parseFrontmatter(m[1]);
        const industry = fm.industry as string;
        const category = fm.category as string;
        if (!industry || !category) {
          warnings.push(`跳过（缺 industry/category）: ${path.relative(base, p)}`);
          continue;
        }
        const title = (fm.title as string) || entry.name.replace(/\.md$/, '');
        const body = m[2].trim();
        const sourceUrl = fm.sourceUrl as string | undefined;
        const fetchedAt = fm.fetchedAt as string | undefined;
        const vendor = fm.vendor as string | undefined;
        const tags = Array.isArray(fm.tags) ? (fm.tags as string[]) : [];
        if (vendor) tags.push(vendor);

        let content = body;
        if (sourceUrl) {
          content +=
            `\n\n---\n\n> 来源：${sourceUrl}` +
            (fetchedAt ? `（采集于 ${fetchedAt}）` : '') +
            (vendor ? `\n> 厂商：${vendor}` : '');
        }

        docs.push({
          title,
          content,
          tags,
          categories: [industry, category],
          categoryTree: [industry, category],
          requiredPlan: (fm.requiredPlan as ImportDoc['requiredPlan']) || 'free',
          creditsCost: (fm.creditsCost as number) ?? 0,
          freePreviewPages: (fm.freePreviewPages as number) ?? 0,
          vendor,
          sourceUrl,
          fetchedAt,
        });
      }
    }
  };
  walk(base);
  if (warnings.length) {
    console.warn(`⚠️  ${warnings.length} 个文件被跳过：\n - ` + warnings.join('\n - '));
  }
  return docs;
}

/** 连接库并幂等 UPSERT；dryRun 时仅解析并返回数量 */
export async function seedKnowledgeBase(root?: string, dryRun = false): Promise<number> {
  const docs = loadKnowledgeBase(root);
  if (dryRun) {
    console.log(`🔍 dry-run：解析到 ${docs.length} 篇知识文档`);
    const byIndustry: Record<string, number> = {};
    for (const d of docs) byIndustry[d.categoryTree[0]] = (byIndustry[d.categoryTree[0]] || 0) + 1;
    console.log('按行业分布：', byIndustry);
    return docs.length;
  }

  // 仅在尚无连接时自建连接，避免误断平台启动期的已有连接
  const ownConnection = mongoose.connection.readyState !== 1;
  if (ownConnection) {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/ai-agent-platform');
    console.log('✅ MongoDB connected');
  }

  let inserted = 0;
  let updated = 0;
  for (const d of docs) {
    const existing = await KnowledgeDocument.findOne({ title: d.title });
    await KnowledgeDocument.findOneAndUpdate(
      { title: d.title },
      {
        $set: {
          title: d.title,
          content: d.content,
          tags: d.tags,
          categories: d.categories,
          categoryTree: d.categoryTree,
          isPublic: true,
          requiredPlan: d.requiredPlan,
          creditsCost: d.creditsCost,
          freePreviewPages: d.freePreviewPages,
          author: SYSTEM_AUTHOR,
        },
      },
      { upsert: true, new: true },
    );
    if (existing) updated++;
    else inserted++;
  }
  console.log(`✅ 知识库导入完成：新增 ${inserted}，更新 ${updated}，共 ${docs.length} 篇`);
  if (ownConnection) await mongoose.disconnect();
  return docs.length;
}

if (require.main === module) {
  const dryRun = process.argv.includes('--dry-run');
  // 仅当显式传入「存在的目录」时作为 root；否则交给 KB_ROOT / 向上探测
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
  const rootArg = args.find((a) => fs.existsSync(a) && fs.statSync(a).isDirectory());
  seedKnowledgeBase(rootArg || process.env.KB_ROOT, dryRun)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('❌ 导入失败:', e);
      process.exit(1);
    });
}
