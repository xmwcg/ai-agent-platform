/**
 * 实践沙盒路由
 *
 * POST /api/sandbox/run   执行一段代码并返回 stdout/stderr/exitCode（requireAuth）
 * GET  /api/sandbox/status 返回部署验收所需的沙盒能力状态（公开只读，可选身份）
 */
import { Router, Response } from 'express';
import { AuthRequest, requireAuth, optionalAuth } from '../middleware/auth';
import { sandboxService } from '../services/sandbox.service';
import { SUPPORTED_LANGUAGES } from '../services/sandbox.service';
import { sendError } from '../lib/http-error';

const router = Router();

router.post('/run', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { language, code, mode, resourceId } = req.body || {};
    if (typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'code 不能为空' });
    }
    if (code.length > 64 * 1024) {
      return res.status(413).json({ success: false, error: '代码过长（上限 64KB）' });
    }
    const result = await sandboxService.run({
      language: language as any,
      code,
      mode: mode as any,
      resourceId: resourceId || (req.body as any)?.resourceId,
    });
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/status', optionalAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const providers = sandboxService.providers();
    res.json({
      success: true,
      data: {
        defaultMode: sandboxService.defaultMode(),
        providers,
        supportedLanguages: SUPPORTED_LANGUAGES,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
