/**
 * 退款路由 — 退款申请、审批、详情查询
 */
import { Router, Response } from "express";
import { AuthRequest, requireAuth, requireAdmin } from "../../middleware/auth";
import { RefundService } from "../../services/refund.service";
import { sendError } from "../../lib/http-error";
import { logger } from "../../lib/logger";

const router = Router();

// 用户提交退款申请
router.post("/refunds", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { orderNo, reason, description } = req.body as {
      orderNo?: string;
      reason?: string;
      description?: string;
    };
    if (!orderNo) return res.status(400).json({ success: false, error: "缺少订单号" });
    if (!reason) return res.status(400).json({ success: false, error: "缺少退款原因" });

    const validReasons = ["duplicate_payment", "voluntary_refund", "service_unavailable", "fraud", "other"];
    if (!validReasons.includes(reason)) {
      return res.status(400).json({ success: false, error: "无效的退款原因" });
    }

    const result = await RefundService.submitRefund({
      userId: req.user!.id,
      orderNo,
      reason: reason as any,
      description,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员审批退款
router.put("/refunds/:refundNo/approve", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { actualRefundAmount, adminNote } = req.body as {
      actualRefundAmount?: number;
      adminNote?: string;
    };
    if (!adminNote) return res.status(400).json({ success: false, error: "缺少审批备注" });

    const result = await RefundService.approveRefund({
      refundNo: req.params.refundNo,
      adminId: req.user!.id,
      actualRefundAmount,
      adminNote,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员拒绝退款
router.put("/refunds/:refundNo/reject", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { adminNote } = req.body as { adminNote?: string };
    if (!adminNote) return res.status(400).json({ success: false, error: "缺少拒绝原因" });

    const result = await RefundService.rejectRefund(req.params.refundNo, req.user!.id, adminNote);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 退款详情（用户/管理员）
router.get("/refunds/:refundNo", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const refund = await RefundService.getRefundDetail(req.params.refundNo, req.user!.id);
    res.json({ success: true, data: refund });
  } catch (err) {
    sendError(res, err);
  }
});

// 我的退款列表
router.get("/my-refunds", requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const status = req.query.status as string | undefined;
    const validStatuses = ["pending", "approved", "rejected", "processing", "success", "failed"];
    const filterStatus = status && validStatuses.includes(status) ? (status as any) : undefined;
    const refunds = await RefundService.getUserRefunds(req.user!.id, filterStatus);
    res.json({ success: true, data: refunds });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员：全部退款列表
router.get("/admin-refunds", requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 20));
    const status = req.query.status as string | undefined;
    const result = await RefundService.getAllRefunds(page, limit, status);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
