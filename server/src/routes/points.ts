import { Router, Request, Response } from 'express';
import { auth } from '../middleware/auth';
import {
  dailyCheckIn,
  getCheckInStatus,
  getCheckInHistory,
  awardTaskPoints,
  TASK_POINTS,
} from '../services/points.service';

const router = Router();

// 所有路由需要登录
router.use(auth);

/**
 * POST /api/points/checkin
 * 每日签到
 */
router.post('/checkin', async (req: Request, res: Response) => {
  try {
    const result = await dailyCheckIn((req as any).user._id);
    if (!result.success) {
      return res.status(400).json({ error: result.message, data: result });
    }
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '签到失败' });
  }
});

/**
 * GET /api/points/checkin/status
 * 获取签到状态
 */
router.get('/checkin/status', async (req: Request, res: Response) => {
  try {
    const status = await getCheckInStatus((req as any).user._id);
    res.json({ success: true, data: status });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取签到状态失败' });
  }
});

/**
 * GET /api/points/checkin/history
 * 获取签到历史
 */
router.get('/checkin/history', async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize as string) || 30));
    const data = await getCheckInHistory((req as any).user._id, page, pageSize);
    res.json({ success: true, data });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '获取签到历史失败' });
  }
});

/**
 * POST /api/points/task
 * 任务积分奖励
 * Body: { taskType: string }
 */
router.post('/task', async (req: Request, res: Response) => {
  try {
    const { taskType } = req.body;
    if (!taskType) {
      return res.status(400).json({ error: '缺少 taskType 参数' });
    }

    const amount = TASK_POINTS[taskType as keyof typeof TASK_POINTS];
    if (!amount) {
      return res.status(400).json({ error: `未知的任务类型: ${taskType}` });
    }

    await awardTaskPoints((req as any).user._id, amount, taskType);
    res.json({ success: true, data: { amount, taskType } });
  } catch (error: any) {
    res.status(500).json({ error: error.message || '任务积分发放失败' });
  }
});

/**
 * GET /api/points/tasks
 * 获取任务列表与积分配置
 */
router.get('/tasks', async (_req: Request, res: Response) => {
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
