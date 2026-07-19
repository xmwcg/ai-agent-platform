import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getReferralStats,
  getReferralList,
  getCommissionList,
  requestWithdrawal,
} from '../services/referral.service';
import { sendError } from '../lib/http-error';
import { Withdrawal } from '../models/Withdrawal';

const router = Router();

router.get('/', (req, res) => { res.json({ ok: true, name: 'referral', routes: ['/code', '/stats', '/list', '/commissions', '/withdraw'] }); });

// 所有路由需要登录
router.use(requireAuth);

/**
 * GET /api/referral/stats
 * 获取推荐统计
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getReferralStats((req as any).user._id);
    res.json({ success: true, data: stats });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/referral/list
 * 获取推荐列表（分页）
 */
router.get('/list', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const data = await getReferralList((req as any).user._id, page, pageSize);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/referral/commissions
 * 获取佣金列表（分页）
 */
router.get('/commissions', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const data = await getCommissionList((req as any).user._id, page, pageSize);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

/**
 * GET /api/referral/code
 * 获取当前用户的推荐码
 */
router.get('/code', async (req: Request, res: Response) => {
  try {
    const user = await import('../models/User').then((m) =>
      m.User.findById((req as any).user._id).select('referralCode')
    );
    res.json({
      success: true,
      data: {
        referralCode: user?.referralCode || '',
        referralLink: user?.referralCode
          ? `https://aibak.site/register?ref=${user.referralCode}`
          : '',
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 申请提现（真实锁定佣金，生成提现单，管理员/财务复核打款）
router.post('/withdraw', async (req: Request, res: Response) => {
  try {
    const { amount, method, account } = req.body || {};
    const amt = Number(amount);
    const userId = (req as any).user._id;
    const result = await requestWithdrawal(
      userId,
      amt,
      method === 'alipay' ? 'alipay' : 'wechat',
      account,
    );
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 我的提现记录
router.get('/withdrawals', async (req: Request, res: Response) => {
  try {
    const list = await Withdrawal.find({ userId: (req as any).user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
