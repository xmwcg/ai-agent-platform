import { Router, Response } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import {
  getNotifications,
  markRead,
  markAllRead,
  getUnreadCount,
} from '../models/Notification';

const router = Router();

// 所有路由需要登录
router.use(requireAuth);

/** GET /api/notifications — 获取通知列表 */
router.get('/', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const data = await getNotifications(req.user!.id, page, pageSize);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

/** GET /api/notifications/unread-count — 获取未读计数 */
router.get('/unread-count', async (req: AuthRequest, res: Response) => {
  try {
    const count = await getUnreadCount(req.user!.id);
    res.json({ success: true, data: { count } });
  } catch (error) {
    sendError(res, error);
  }
});

/** POST /api/notifications/:id/read — 标记已读 */
router.post('/:id/read', async (req: AuthRequest, res: Response) => {
  try {
    await markRead(req.params.id, req.user!.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

/** POST /api/notifications/read-all — 全部标记已读 */
router.post('/read-all', async (req: AuthRequest, res: Response) => {
  try {
    await markAllRead(req.user!.id);
    res.json({ success: true });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
