import { Router, Request, Response } from 'express';
import { compareService, type CompareItem, type CompareRequest, type CompareResult } from '../services/compare.service';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';

const router = Router();

// ───────────── API 状态 ─────────────
router.get('/', (_req, res) => { res.json({ ok: true, name: 'compare' }); });

// 获取可对比项列表
router.get('/items', (req: Request, res: Response) => {
  const type = req.query.type as CompareItem['type'];
  const items = type ? compareService.getPresetsByType(type) : compareService.getPresets();
  res.json({ success: true, data: items });
});

// 生成对比（可选登录：登录用户消耗 ai_chat 配额，匿名放行）
router.post('/generate', optionalAuth, enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const body: CompareRequest = req.body;
    if (!body.items || body.items.length < 2) {
      return res.status(400).json({ success: false, error: 'At least 2 items required' });
    }
    const result = await compareService.generateCompare(body);
    if (req.user?.id) await quotaIncrement(req.user.id, 'ai_chat');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
