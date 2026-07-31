/**
 * 安全审计管理路由
 *
 * GET  /api/admin/audit-logs   管理员查询安全审计日志
 * GET  /api/admin/sessions     管理员查看所有活跃会话（安全审计）
 * POST /api/admin/sessions/revoke 管理员强制撤销用户会话
 */
import { Router, Response } from "express";
import { AuthRequest, requireAdmin } from "../middleware/auth";
import { queryAuditLogs } from "../services/security-audit.service";
import { AuthSession } from "../models/AuthSession";
import { sendError } from "../lib/http-error";

const router = Router();

// 管理员查询安全审计日志
router.get("/admin/audit-logs", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const result = await queryAuditLogs({
      userId: req.query.userId as string,
      action: req.query.action as any,
      severity: req.query.severity as string,
      outcome: req.query.outcome as string,
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      page: parseInt(req.query.page as string, 10) || 1,
      limit: parseInt(req.query.limit as string, 10) || 20,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员查看所有活跃会话
router.get("/admin/sessions", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.query.userId as string;
    const filter: any = { status: "active" };
    if (userId) filter.userId = userId;

    const sessions = await AuthSession.find(filter)
      .select("-refreshToken")
      .populate("userId", "email name role")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    res.json({ success: true, data: sessions });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员强制撤销会话
router.post("/admin/sessions/:sessionId/revoke", requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const session = await AuthSession.findByIdAndUpdate(
      req.params.sessionId,
      { $set: { status: "revoked", revokedAt: new Date(), revokeReason: "admin_revoke" } }
    );

    if (!session) {
      return res.status(404).json({ error: "会话不存在" });
    }

    res.json({ success: true, message: "会话已撤销" });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
