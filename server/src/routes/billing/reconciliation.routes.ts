/**
 * 对账路由 — 手动触发对账、对账列表、对账详情
 */
import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireAdmin } from "../../middleware/auth";
import { ReconciliationService } from "../../services/reconciliation.service";
import { sendError } from "../../lib/http-error";

const router = Router();

// 手动触发对账（管理员）
router.post("/reconciliation/trigger", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const dateStr = req.body.date as string | undefined;
    const date = dateStr ? new Date(dateStr) : undefined;
    const result = await ReconciliationService.triggerReconciliation(date);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 对账列表（管理员）
router.get("/admin/reconciliation", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await ReconciliationService.getReconciliationList(page, limit);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 对账详情（管理员）
router.get("/admin/reconciliation/:batchId", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await ReconciliationService.getReconciliationDetail(req.params.batchId);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
