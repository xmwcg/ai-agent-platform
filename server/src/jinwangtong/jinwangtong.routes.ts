/**
 * 金网通 REST API 路由
 *
 * 提供 License 管理、设备管理、下载版本管理的全部端点。
 * 替换原先 license.routes.ts 的简化版本，提供完整 CRUD。
 *
 * @module jinwangtong.routes
 * @author NexMind Team
 */

import { Router, Request, Response, NextFunction } from "express";
import { requireAuth as authenticate, optionalAuth, requireAdmin, AuthRequest } from "../middleware/auth";
import * as jwts from "./jinwangtong.service";

const router = Router();

// ============================================================
//  公开端点（无需登录）
// ============================================================

/** GET /api/jinwangtong/editions — 获取 License 版本列表 */
router.get("/editions", (_req: Request, res: Response) => {
  const editions = jwts.getPublicEditions();
  res.json({ success: true, data: editions });
});

/** GET /api/jinwangtong/downloads/latest — 获取最新下载版本 */
router.get("/downloads/latest", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const platform = req.query.platform as string | undefined;
    const versions = await jwts.getLatestVersion(platform);
    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/downloads/:platform — 获取平台所有版本 */
router.get("/downloads/:platform", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const versions = await jwts.getPlatformVersions(req.params.platform as string);
    res.json({ success: true, data: versions });
  } catch (error) {
    next(error);
  }
});

/** POST /api/jinwangtong/downloads/record — 记录下载（公开） */
router.post("/downloads/record", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { version, platform } = req.body;
    await jwts.recordDownload(version, platform);
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});


/** GET /api/jinwangtong/download — 下载金网通安装包（重定向到静态文件） */
router.get("/download", (req: Request, res: Response) => {
  const version = req.query.version as string || "jinwangtong-trial";
  const platform = req.query.platform as string || "windows";
  
  if (platform === "windows" || !platform) {
    const filename = version === "portable" ? "jinwangtong-v2.1.0-portable.zip" : "jinwangtong-trial.zip";
    return res.redirect(`/download/${filename}`);
  }
  
  const ext = platform === "windows" ? ".exe" : "";
  const filename = `jwt-transfer-${platform}-amd64${ext}`;
  return res.redirect(`/download/${filename}`);
});

// ============================================================
//  需登录端点
// ============================================================

/** POST /api/jinwangtong/license/trial — 申请试用 License */
router.post("/license/trial", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { company } = req.body;
    const userId = (req.user! as any)._id || req.user!.id!;
    const result = await jwts.requestTrialLicense(userId, company || "个人用户");
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/license/mine — 查询我的 License 列表 */
router.get("/license/mine", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user! as any)._id || req.user!.id!;
    const licenses = await jwts.getUserLicenses(userId);
    res.json({ success: true, data: licenses });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/license/:licenseId — 查询 License 详情 */
router.get("/license/:licenseId", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const license = await jwts.getLicenseDetail(req.params.licenseId as string);
    if (!license) {
      res.status(404).json({ success: false, error: "License 不存在" });
      return;
    }
    res.json({ success: true, data: license });
  } catch (error) {
    next(error);
  }
});

// ============================================================
//  设备管理端点（需登录）
// ============================================================

/** POST /api/jinwangtong/devices/register — 注册设备 */
router.post("/devices/register", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user! as any)._id || req.user!.id!;
    const device = await jwts.registerDevice({ ...req.body, userId });
    res.json({ success: true, data: device });
  } catch (error: any) {
    if (error.message?.includes("License") || error.message?.includes("设备数")) {
      res.status(400).json({ success: false, error: error.message });
      return;
    }
    next(error);
  }
});

/** POST /api/jinwangtong/devices/heartbeat — 设备心跳 */
router.post("/devices/heartbeat", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { deviceId, agentVersion } = req.body;
    const device = await jwts.deviceHeartbeat(deviceId, agentVersion);
    res.json({ success: true, data: device });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/devices/mine — 我的设备列表 */
router.get("/devices/mine", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const userId = (req.user! as any)._id || req.user!.id!;
    const devices = await jwts.getUserDevices(userId);
    res.json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/devices/license/:licenseId — License 下的设备 */
router.get("/devices/license/:licenseId", authenticate, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const devices = await jwts.getLicenseDevices(req.params.licenseId as string);
    res.json({ success: true, data: devices });
  } catch (error) {
    next(error);
  }
});

// ============================================================
//  管理员端点
// ============================================================

/** POST /api/jinwangtong/admin/publish-version — 发布新版本 */
router.post("/admin/publish-version", authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const version = await jwts.publishVersion(req.body);
    res.json({ success: true, data: version });
  } catch (error) {
    next(error);
  }
});

/** POST /api/jinwangtong/admin/revoke-license/:licenseId — 吊销 License */
router.post("/admin/revoke-license/:licenseId", authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { reason } = req.body;
    const license = await jwts.revokeLicense(req.params.licenseId as string, reason || "管理员操作");
    res.json({ success: true, data: license });
  } catch (error) {
    next(error);
  }
});

/** GET /api/jinwangtong/admin/stats — 产品统计数据 */
router.get("/admin/stats", authenticate, requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await jwts.getProductStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    next(error);
  }
});

/** POST /api/jinwangtong/devices/:deviceId/block — 封禁设备 */
router.post("/devices/:deviceId/block", authenticate, requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const device = await jwts.blockDevice(req.params.deviceId as string);
    res.json({ success: true, data: device });
  } catch (error) {
    next(error);
  }
});

export default router;

