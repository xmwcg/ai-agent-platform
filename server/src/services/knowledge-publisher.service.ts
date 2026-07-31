/**
 * NexMind 知识产品发布服务
 * 从 Obsidian 知识库读取 Markdown → 解析 YAML frontmatter → 创建/更新 KnowledgeDocument
 * 打通：Obsidian 知识库 → aibak.site 知识商城
 */

import fs from "fs";
import path from "path";
import { KnowledgeDocument, IKnowledgeDocument } from "../models/KnowledgeDocument";
import { logger } from "../lib/logger";

// Obsidian 知识库路径（从环境变量或默认值读取）
const OBSIDIAN_VAULT =
  process.env.OBSIDIAN_VAULT || "G:/项目成品及测试/Obsidian 知识库";

/** 知识库目录结构 */
interface VaultEntry {
  /** 相对 vault 根目录的路径 */
  relPath: string;
  /** 绝对路径 */
  absPath: string;
  /** 文件大小 */
  size: number;
  /** Markdown 内容 */
  content: string;
  /** 解析后的 YAML frontmatter */
  frontmatter: Record<string, any>;
}

/** 发布选项 */
export interface PublishOptions {
  /** 覆盖已有文档的价格 */
  price?: number;
  /** 覆盖已有文档的套餐要求 */
  requiredPlan?: "free" | "pro" | "max";
  /** 覆盖已有文档的积分消耗 */
  creditsCost?: number;
  /** 覆盖已有文档的免费预览页数 */
  freePreviewPages?: number;
  /** 是否设为公开 */
  isPublic?: boolean;
  /** 标签（追加到已有标签） */
  tags?: string[];
}

/** 发布结果 */
export interface PublishResult {
  success: boolean;
  created: number;
  updated: number;
  skipped: number;
  errors: string[];
  details: Array<{
    file: string;
    status: "created" | "updated" | "skipped" | "error";
    docId?: string;
    title?: string;
    error?: string;
  }>;
}

/**
 * 解析 Markdown 文件的 YAML frontmatter
 */
function parseFrontmatter(content: string): {
  frontmatter: Record<string, any>;
  body: string;
} {
  const frontmatter: Record<string, any> = {};
  let body = content;

  if (content.startsWith("---")) {
    const endIdx = content.indexOf("---", 3);
    if (endIdx !== -1) {
      const yamlBlock = content.slice(3, endIdx).trim();
      body = content.slice(endIdx + 3).trim();

      // 简易 YAML 解析（支持字符串、数字、数组、布尔值）
      for (const line of yamlBlock.split("\n")) {
        const colonIdx = line.indexOf(":");
        if (colonIdx === -1) continue;
        const key = line.slice(0, colonIdx).trim();
        let value: any = line.slice(colonIdx + 1).trim();

        // 移除引号
        if ((value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }

        // 布尔值
        if (value === "true") { value = true; }
        else if (value === "false") { value = false; }
        // 数字
        else if (/^-?\d+(\.\d+)?$/.test(value)) {
          value = Number(value);
        }
        // 空值
        else if (value === "" || value === "null" || value === "~") {
          value = null;
        }
        // 数组（[a, b, c]）
        else if (value.startsWith("[") && value.endsWith("]")) {
          value = value.slice(1, -1).split(",").map((s: string) =>
            s.trim().replace(/^['"]|['"]$/g, "")
          ).filter(Boolean);
        }

        frontmatter[key] = value;
      }
    }
  }

  return { frontmatter, body };
}

/**
 * 扫描 Obsidian 知识库目录，返回所有 Markdown 文件
 */
export function scanVaultDirectory(
  subDir: string = ""
): VaultEntry[] {
  const entries: VaultEntry[] = [];
  const scanDir = path.join(OBSIDIAN_VAULT, subDir);
  if (!fs.existsSync(scanDir)) {
    logger.warn("knowledge-publisher", `目录不存在: ${scanDir}`);
    return entries;
  }

  // 排除的目录
  const skipDirs = new Set([
    ".obsidian", ".git", ".trash", "node_modules",
    ".codex", "plugins", "templates", ".tmp",
    "04 资源", // 自动同步区
    "100-项目", "200-领域", "300-资源", "500-日记", // PARA
  ]);

  function walk(dir: string) {
    const items = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        if (!skipDirs.has(item.name) && !item.name.startsWith(".")) {
          walk(path.join(dir, item.name));
        }
      } else if (item.name.endsWith(".md")) {
        const absPath = path.join(dir, item.name);
        const relPath = path.relative(OBSIDIAN_VAULT, absPath);
        try {
          const content = fs.readFileSync(absPath, "utf-8");
          const { frontmatter, body } = parseFrontmatter(content);
          entries.push({
            relPath,
            absPath,
            size: fs.statSync(absPath).size,
            content: body,
            frontmatter,
          });
        } catch (e: any) {
          logger.error("knowledge-publisher", `读取失败: ${absPath}`, { error: e.message });
        }
      }
    }
  }

  walk(scanDir);
  return entries;
}

/**
 * 从 Obsidian 知识库导入/发布知识产品到 aibak.site
 */
export async function publishFromVault(
  subDir: string = "",
  opts: PublishOptions = {}
): Promise<PublishResult> {
  const entries = scanVaultDirectory(subDir);
  const result: PublishResult = {
    success: true,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  for (const entry of entries) {
    try {
      const fm = entry.frontmatter;
      const title = fm.title || path.basename(entry.relPath, ".md");
      const summary = fm.summary || entry.content.slice(0, 200).replace(/[#*\n]/g, " ").trim() + "...";

      // 查找是否已存在（按标题匹配）
      const existing = await KnowledgeDocument.findOne({
        title,
        author: "system", // 管理员发布
      });

      // 构建文档数据
      const docData: any = {
        title,
        content: entry.content,
        summary,
        tags: [
          ...(fm.tags || []),
          ...(opts.tags || []),
          ...(fm.industry ? [fm.industry] : []),
        ].filter((v, i, a) => a.indexOf(v) === i),
        categories: [
          fm.category || fm.industry || path.dirname(entry.relPath).split(/[\\/]/).pop() || "未分类",
        ],
        author: "system",
        isPublic: opts.isPublic !== undefined ? opts.isPublic : true,
        price: opts.price ?? fm.price,
        requiredPlan: opts.requiredPlan || fm.requiredPlan || "free",
        creditsCost: opts.creditsCost ?? fm.creditsCost,
        freePreviewPages: opts.freePreviewPages ?? fm.freePreviewPages,
      };

      if (existing) {
        // 更新已有文档
        const changed = Object.keys(docData).some(
          (k) => JSON.stringify(docData[k]) !== JSON.stringify((existing as any)[k])
        );
        if (changed) {
          await KnowledgeDocument.findByIdAndUpdate(existing._id, { $set: docData });
          result.updated++;
          result.details.push({
            file: entry.relPath,
            status: "updated",
            docId: existing._id.toString(),
            title,
          });
        } else {
          result.skipped++;
          result.details.push({ file: entry.relPath, status: "skipped", title });
        }
      } else {
        // 创建新文档
        const doc = await KnowledgeDocument.create(docData);
        result.created++;
        result.details.push({
          file: entry.relPath,
          status: "created",
          docId: doc._id.toString(),
          title,
        });
      }
    } catch (e: any) {
      result.errors.push(`${entry.relPath}: ${e.message}`);
      result.details.push({
        file: entry.relPath,
        status: "error",
        error: e.message,
      });
    }
  }

  result.success = result.errors.length === 0;
  logger.info("knowledge-publisher", `发布完成: 新建${result.created} 更新${result.updated} 跳过${result.skipped} 错误${result.errors.length}`);

  return result;
}

/**
 * 获取已发布的知识产品列表（管理后台用）
 */
export async function getPublishedProducts(
  query: {
    page?: number;
    limit?: number;
    category?: string;
    search?: string;
    isPublic?: boolean;
  } = {}
) {
  const page = query.page || 1;
  const limit = Math.min(query.limit || 20, 100);
  const filter: any = { author: "system" };

  if (query.category) {
    filter.categories = query.category;
  }
  if (query.isPublic !== undefined) {
    filter.isPublic = query.isPublic;
  }
  if (query.search) {
    filter.$or = [
      { title: { $regex: query.search, $options: "i" } },
      { summary: { $regex: query.search, $options: "i" } },
    ];
  }

  const [docs, total] = await Promise.all([
    KnowledgeDocument.find(filter)
      .select("title summary tags categories requiredPlan creditsCost price isPublic viewCount likeCount createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    KnowledgeDocument.countDocuments(filter),
  ]);

  return {
    docs,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * 获取 Obsidian 知识库目录树（供管理后台选择导入范围）
 */
export function getVaultDirectoryTree(
  subDir: string = ""
): Array<{ name: string; path: string; count: number }> {
  const scanDir = path.join(OBSIDIAN_VAULT, subDir);
  if (!fs.existsSync(scanDir)) return [];

  const skipDirs = new Set([
    ".obsidian", ".git", ".trash", "node_modules",
    ".codex", "plugins", "templates", ".tmp",
  ]);

  const tree: Array<{ name: string; path: string; count: number }> = [];

  const items = fs.readdirSync(scanDir, { withFileTypes: true });
  for (const item of items) {
    if (!item.isDirectory() || item.name.startsWith(".") || skipDirs.has(item.name)) {
      continue;
    }
    const dirPath = path.join(scanDir, item.name);
    const relPath = subDir ? `${subDir}/${item.name}` : item.name;

    // 统计目录下 Markdown 文件数量
    let count = 0;
    function countMd(dir: string) {
      const subs = fs.readdirSync(dir, { withFileTypes: true });
      for (const s of subs) {
        if (s.isDirectory() && !s.name.startsWith(".")) {
          countMd(path.join(dir, s.name));
        } else if (s.name.endsWith(".md")) {
          count++;
        }
      }
    }
    countMd(dirPath);

    tree.push({ name: item.name, path: relPath, count });
  }

  return tree.sort((a, b) => b.count - a.count);
}

export default {
  publishFromVault,
  getPublishedProducts,
  getVaultDirectoryTree,
  scanVaultDirectory,
};
