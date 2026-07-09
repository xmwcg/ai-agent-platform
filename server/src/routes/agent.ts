/**
 * 自主 Agent 路由
 * 对标 AutoGPT：接收高层目标 → 自动拆解 → 多步执行 → 汇总结果
 */

import { Router, Response } from 'express';
import { autonomousAgent } from '../services/autonomous-agent.service';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';

const router = Router();

/**
 * POST /api/agent/goal
 * 提交高层目标，Agent 自主完成
 */
router.post('/goal', requireAuth, enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const { goal, context, constraints, maxSteps, maxRetries } = req.body;

    if (!goal) {
      return res.status(400).json({ error: 'Goal is required' });
    }

    const result = await autonomousAgent.executeGoal({
      goal,
      context,
      constraints: constraints || [],
      userId: req.user!.id,
      maxSteps: maxSteps || 5,
      maxRetries: maxRetries || 2,
    });

    if (req.user?.id) await quotaIncrement(req.user.id, 'ai_chat');

    res.json({ success: result.success, data: result });
  } catch (err) { sendError(res, err); }
});

/**
 * GET /api/agent/memory
 * 获取当前用户的 Agent 记忆
 */
router.get('/memory', requireAuth, async (req: AuthRequest, res: Response) => {
  const memory = autonomousAgent.getUserMemory(req.user!.id);
  res.json({ success: true, data: memory || { preferences: {}, recentTopics: [] } });
});

/**
 * DELETE /api/agent/memory
 * 清除当前用户的 Agent 记忆
 */
router.delete('/memory', requireAuth, async (req: AuthRequest, res: Response) => {
  autonomousAgent.clearUserMemory(req.user!.id);
  res.json({ success: true, message: 'Memory cleared' });
});

export default router;
