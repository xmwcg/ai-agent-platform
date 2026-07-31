/**
 * NexMind Platform — 金网通 License 路由
 *
 * 提供金网通产品授权版本列表、试用申请、License 验证等端点。
 * 与 billing 路由分开，避免覆盖线上已部署的 SaaS 计费端点。
 *
 * @author NexMind Team
 * @license MIT
 */

import { Router, Request, Response, NextFunction } from "express";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { LICENSE_EDITIONS } from "../config/private-license";
import { issueTrialLicense, verifyLicense } from "../services/private-license.service";

const router = Router();

// ============== 获取金网通 License 版本列表 ==============

router.get("/editions", (_req: Request, res: Response) => {
  const editions = LICENSE_EDITIONS.map((e) => ({
    key: e.key,
    name: e.name,
    price: e.price,
    maxDevices: e.maxDevices,
    days: e.days,
    features: e.features,
    highlighted: e.highlighted,
    description: e.description,
    downloadUrl: e.downloadUrl,
  }));
  res.json({ success: true, data: editions });
});

// ============== 申请试用 License ==============

router.post("/trial", requireAuth, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { company } = req.body;
    const result = issueTrialLicense({
      company: company || "个人用户",
      userId: (req.user! as any)._id || req.user!.id!,
    });

    res.json({
      success: true,
      data: {
        licenseId: result.licenseId,
        licenseContent: result.licenseContent,
        downloadUrl: result.downloadUrl,
        expireDate: result.expireDate,
        edition: result.edition,
        features: result.features,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============== 验证 License ==============

router.post("/verify", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { license } = req.body;
    if (!license) {
      res.status(400).json({ success: false, error: "缺少 license 内容" });
      return;
    }

    const result = verifyLicense(license);
    res.json({ success: result.valid, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
