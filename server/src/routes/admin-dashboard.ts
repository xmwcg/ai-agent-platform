/**
 * 管理员运营仪表盘路由
 *
 * GET  /api/admin/dashboard   — 运营指标仪表盘
 * GET  /api/admin/backups      — 备份列表
 * POST /api/admin/backups/restore — 手动恢复备份
 */
import { Router, Response } from "express";
import { AuthRequest, requireAdmin } from "../middleware/auth";
import { getDashboardMetrics } from "../services/dashboard.service";
import { listBackups, restoreFromBackup, performFullBackup } from "../services/backup.service";
import { sendError } from "../lib/http-error";
import { writeAuditLog } from "../services/security-audit.service";

const router = Router();

// 运营指标仪表盘
router.get("/admin/dashboard", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const metrics = await getDashboardMetrics();
    res.json({ success: true, data: metrics });
  } catch (err) {
    sendError(res, err);
  }
});

// 备份列表
router.get("/admin/backups", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, data: backups });
  } catch (err) {
    sendError(res, err);
  }
});

// 手动触发全量备份
router.post("/admin/backups/full", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await performFullBackup();
    if (result) {
      await writeAuditLog({
        action: "admin_action",
        resourceType: "backup",
        resourceId: result.name,
        details: { action: "manual_full", size: result.sizeBytes },
        severity: "low",
        ctx: { adminId: req.user?.id, userId: req.user?.id, ipAddress: req.ip },
      });
      res.json({ success: true, data: result });
    } else {
      res.status(500).json({ success: false, error: "备份失败" });
    }
  } catch (err) {
    sendError(res, err);
  }
});

// 手动恢复备份
router.post("/admin/backups/restore/:name", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    // 恢复操作必须写入关键审计日志
    await writeAuditLog({
      action: "admin_action",
      resourceType: "backup_restore",
      resourceId: req.params.name,
      details: { action: "restore_requested" },
      severity: "critical",
      ctx: { adminId: req.user?.id, userId: req.user?.id, ipAddress: req.ip },
    }, true); // 关键审计：写入失败则拒绝

    const result = await restoreFromBackup(req.params.name);
    res.json(result);
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
