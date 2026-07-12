import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  getReferralStats,
  getReferralList,
  getCommissionList,
} from '../services/referral.service';

const router = Router();

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
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取推荐统计失败' });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取推荐列表失败' });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取佣金列表失败' });
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
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取推荐码失败' });
  }
});

export default router;
