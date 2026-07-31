/**
 * NexMind 创作工坊（Studio）接口
 * ----------------------------------------------------------------
 * 复用平台账号(JWT) / 积分(User.credits) / BYOK(MediaUserKey) / 对象存储 / 支付(billing)。
 * 本路由只负责「场景编排 + 任务生命周期 + 积分预估/扣减」，不重复造支付与会员体系。
 */
import { Router, Request, Response } from "express";
import { requireAuth } from "../middleware/auth";
import { sendError } from "../lib/http-error";
import * as studio from "../services/studiopipe/studio.service";
import { StudioJobInput } from "../services/studiopipe/types";

const router = Router();

router.get("/scenes", (_req: Request, res: Response) => {
  res.json({ success: true, data: studio.listScenes() });
});

router.get("/templates", (_req: Request, res: Response) => {
  res.json({ success: true, data: studio.getTemplates() });
});

router.get("/balance", requireAuth, async (req: Request, res: Response) => {
  try {
    const b = await studio.getBalance((req as any).user.id);
    res.json({ success: true, data: b });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/create", requireAuth, async (req: Request, res: Response) => {
  try {
    const body = req.body || {};
    const input: StudioJobInput = {
      sceneId: body.sceneId,
      templateId: body.templateId,
      fields: body.fields || {},
    };
    if (!input.sceneId) {
      return res.status(400).json({ success: false, error: "sceneId 必填" });
    }
    const r = await studio.createJob(input, (req as any).user.id);
    res.json({ success: true, data: r });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({ success: false, error: err?.message || "创建失败", code: err?.code });
  }
});

router.get("/job/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const job = await studio.getJob(req.params.id, (req as any).user.id);
    if (!job) return res.status(404).json({ success: false, error: "任务不存在" });
    res.json({ success: true, data: job });
  } catch (err) {
    sendError(res, err);
  }
});

// ── 抖音链接提取 ──
router.post("/douyin/extract", requireAuth, async (req: Request, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "url 必填，请提供抖音分享链接" });
    }
    const result = await studio.extractDouyin(url);
    res.json({ success: true, data: result });
  } catch (err: any) {
    const status = err?.status || 500;
    res.status(status).json({
      success: false,
      error: err?.message || "抖音链接提取失败",
      code: err?.code || err?.name,
    });
  }
});

// ── 多平台发布调度 ──
router.post("/publish/dispatch", requireAuth, async (req: Request, res: Response) => {
  try {
    const { videoUrl, title, platforms, tags } = req.body || {};
    if (!videoUrl || !title) {
      return res.status(400).json({ success: false, error: "videoUrl 和 title 必填" });
    }
    const result = await studio.dispatchPublish({
      videoUrl,
      title,
      platforms: platforms || ["douyin"],
      tags: tags || [],
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "发布调度失败" });
  }
});

// ── 混剪视频 ──
router.post("/mixcut", requireAuth, async (req: Request, res: Response) => {
  try {
    const { assets, targetDurationSec, style, bgmPath } = req.body || {};
    if (!assets || !Array.isArray(assets) || assets.length === 0) {
      return res.status(400).json({ success: false, error: "assets 必填，至少一个素材 URL" });
    }
    const result = await studio.composeMixCut({
      assets,
      targetDurationSec: targetDurationSec || 0,
      style: style || "fast",
      bgmPath,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "混剪失败" });
  }
});

// ── 商品详情页文章 ──
router.post("/product-article", requireAuth, async (req: Request, res: Response) => {
  try {
    const { productName, category, sellingPoints, productImages, platform, tone, imageCount } = req.body || {};
    if (!productName || !productImages || !Array.isArray(productImages)) {
      return res.status(400).json({ success: false, error: "productName 和 productImages 必填" });
    }
    const result = await studio.generateProductArticle({
      productName,
      category: category || "general",
      sellingPoints: sellingPoints || [],
      productImages,
      platform: platform || "taobao",
      tone: tone || "professional",
      imageCount: imageCount || 4,
    });
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || "商品文章生成失败" });
  }
});

export default router;
