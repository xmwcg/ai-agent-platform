import { Router, Request, Response } from 'express';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { listXhsAgents, generateXhsCopy, XhsRole } from '../services/xhs-copy.service';

const VALID_ROLES: XhsRole[] = ['copywriter', 'architect', 'frontend', 'devops'];

const router = Router();

// 列出可用的专家角色（前端选择器数据源）
router.get('/agents', (_req: Request, res: Response) => {
  res.json({ success: true, data: listXhsAgents() });
});

// 生成文案 / 调用专家角色
router.post('/generate', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { role, product, audience, style, keywords, count } = req.body || {};

    if (!role || !VALID_ROLES.includes(role)) {
      return res.status(400).json({ success: false, error: 'role 必填，且必须为 copywriter/architect/frontend/devops 之一' });
    }
    if (!product || typeof product !== 'string' || !product.trim()) {
      return res.status(400).json({ success: false, error: 'product（产品卖点/主题）为必填项' });
    }

    const result = await generateXhsCopy({
      role,
      product: product.trim(),
      audience: typeof audience === 'string' ? audience.trim() : undefined,
      style: typeof style === 'string' ? style.trim() : undefined,
      keywords: typeof keywords === 'string' ? keywords.trim() : undefined,
      count: typeof count === 'number' ? count : undefined,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
