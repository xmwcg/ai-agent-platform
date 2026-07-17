import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import {
  dailyCheckIn,
  getCheckInStatus,
  getCheckInHistory,
  TASK_POINTS,
} from '../services/points.service';
import { sendError } from '../lib/http-error';

const router = Router();
router.use(requireAuth);

router.post('/checkin', async (req: AuthRequest, res: Response) => {
  try {
    const result = await dailyCheckIn(req.user!.id);
    if (!result.success) return res.status(400).json({ error: result.message, data: result });
    res.json({ success: true, data: result });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/checkin/status', async (req: AuthRequest, res: Response) => {
  try {
    const status = await getCheckInStatus(req.user!.id);
    res.json({ success: true, data: status });
  } catch (error) {
    sendError(res, error);
  }
});

router.get('/checkin/history', async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 30));
    const data = await getCheckInHistory(req.user!.id, page, pageSize);
    res.json({ success: true, data });
  } catch (error) {
    sendError(res, error);
  }
});

// 仅展示任务规则；任务奖励只能由已验证的内部业务事件触发。
router.get('/tasks', (_req: AuthRequest, res: Response) => {
  res.json({
    success: true,
    data: {
      tasks: Object.entries(TASK_POINTS).map(([key, points]) => ({
        taskType: key,
        points,
        label: {
          ai_chat: 'AI 对话',
          knowledge_upload: '上传知识文档',
          course_complete: '完成课程',
          tool_use: '使用智能工具',
          daily_login: '每日登录',
          profile_complete: '完善个人资料',
          share_content: '分享内容',
        }[key] || key,
      })),
    },
  });
});

export default router;
