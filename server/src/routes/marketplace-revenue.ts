import { Router, Request, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import {
  getCreatorRevenueStats,
  getRevenueList,
  createWithdrawRequest,
  getWithdrawList,
  getRevenueByResource,
} from '../services/marketplace-revenue.service';

const router = Router();
router.use(requireAuth);

const withdrawSchema: ValidationSchema = {
  amount: { required: true, type: 'number' },
  method: { required: true, type: 'string', oneOf: ['wechat', 'alipay'] },
  account: { required: true, type: 'string', minLength: 1 },
};

/**
 * GET /api/marketplace/revenue/stats
 * 收益概览
 */
router.get('/revenue/stats', async (req: AuthRequest, res: Response) => {
  try {
    const stats = await getCreatorRevenueStats(req.user!.id);
    const byResource = await getRevenueByResource(req.user!.id);
    res.json({ success: true, data: { ...stats, byResource } });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/marketplace/revenue/list
 * 收益明细列表（分页）
 * Query: status, page, pageSize
 */
router.get('/revenue/list', async (req: AuthRequest, res: Response) => {
  try {
    const { status, page, pageSize } = req.query as any;
    const data = await getRevenueList(
      req.user!.id,
      status,
      parseInt(page) || 1,
      parseInt(pageSize) || 20
    );
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * GET /api/marketplace/revenue/by-resource
 * 按资源类型统计收益
 */
router.get('/revenue/by-resource', async (req: AuthRequest, res: Response) => {
  try {
    const data = await getRevenueByResource(req.user!.id);
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * POST /api/marketplace/revenue/withdraw
 * 创建提现申请
 */
router.post(
  '/revenue/withdraw',
  validate(withdrawSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { amount, method, account } = req.body;
      const result = await createWithdrawRequest(req.user!.id, amount, method, account);
      res.json({ success: true, data: result });
    } catch (error: any) {
      sendError(res, error);
    }
  }
);

/**
 * GET /api/marketplace/revenue/withdraws
 * 提现申请列表
 */
router.get('/revenue/withdraws', async (req: AuthRequest, res: Response) => {
  try {
    const { page, pageSize } = req.query as any;
    const data = await getWithdrawList(
      req.user!.id,
      parseInt(page) || 1,
      parseInt(pageSize) || 20
    );
    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
