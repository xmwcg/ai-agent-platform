/**
 * 后台管理 — 知识产品管理路由
 * 入口：/api/admin/knowledge-products
 * 权限：requireAdmin（仅管理员）
 */

import { Router, Response } from "express";
import { AuthRequest, requireAdmin } from "../middleware/auth";
import {
  publishFromVault,
  getPublishedProducts,
  getVaultDirectoryTree,
} from "../services/knowledge-publisher.service";
import { KnowledgeDocument } from "../models/KnowledgeDocument";
import { sendError } from "../lib/http-error";
import { logger } from "../lib/logger";

const router = Router();

// ─── 获取 Obsidian 知识库目录树（选择导入范围）───
router.get("/vault-tree", requireAdmin, async (_req: AuthRequest, res: Response) => {
  try {
    const subDir = (typeof _req.query.subDir === "string" ? _req.query.subDir : "");
    const tree = getVaultDirectoryTree(subDir);
    res.json({ success: true, data: { tree, vaultPath: process.env.OBSIDIAN_VAULT || "G:/项目成品及测试/Obsidian 知识库" } });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 从 Obsidian 导入并发布 ───
router.post("/import-from-vault", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { subDir, price, requiredPlan, creditsCost, freePreviewPages, isPublic, tags } = req.body || {};

    const result = await publishFromVault(subDir || "", {
      price,
      requiredPlan,
      creditsCost,
      freePreviewPages,
      isPublic,
      tags,
    });

    logger.info("admin-knowledge-products", `管理员导入知识产品: ${subDir}`, {
      adminId: req.user!.id,
      created: result.created,
      updated: result.updated,
      errors: result.errors.length,
    });

    res.json({ success: result.success, data: result });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 获取已发布产品列表 ───
router.get("/", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { page, limit, category, search, isPublic } = req.query;
    const result = await getPublishedProducts({
      page: page ? parseInt(page as string, 10) : 1,
      limit: limit ? parseInt(limit as string, 10) : 20,
      category: category as string,
      search: search as string,
      isPublic: isPublic !== undefined ? isPublic === "true" : undefined,
    });
    res.json({ success: true, data: result });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 更新单个产品 ───
router.put("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    // 仅允许更新特定字段
    const allowedFields = [
      "title", "content", "summary", "tags", "categories",
      "price", "requiredPlan", "creditsCost", "freePreviewPages",
      "isPublic",
    ];
    const safeUpdates: any = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        safeUpdates[field] = updates[field];
      }
    }

    const doc = await KnowledgeDocument.findByIdAndUpdate(
      id,
      { $set: safeUpdates },
      { new: true }
    ).select("title summary tags categories requiredPlan creditsCost price isPublic updatedAt");

    if (!doc) {
      return res.status(404).json({ success: false, error: "产品不存在" });
    }

    res.json({ success: true, data: doc });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 下架/上架产品 ───
router.patch("/:id/toggle-visibility", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await KnowledgeDocument.findById(id).select("isPublic title");
    if (!doc) {
      return res.status(404).json({ success: false, error: "产品不存在" });
    }

    doc.isPublic = !doc.isPublic;
    await doc.save();

    res.json({
      success: true,
      data: {
        id: doc._id,
        title: doc.title,
        isPublic: doc.isPublic,
        message: doc.isPublic ? "已上架" : "已下架",
      },
    });
  } catch (e: any) {
    sendError(res, e);
  }
});

// ─── 删除产品 ───
router.delete("/:id", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await KnowledgeDocument.findByIdAndDelete(id);
    if (!doc) {
      return res.status(404).json({ success: false, error: "产品不存在" });
    }
    logger.info("admin-knowledge-products", `管理员删除知识产品: ${doc.title}`, { adminId: req.user!.id });
    res.json({ success: true, data: { message: "已删除", title: doc.title } });
  } catch (e: any) {
    sendError(res, e);
  }
});

export default router;
