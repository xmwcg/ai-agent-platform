/**
 * 实践沙盒路由
 *
 * POST /api/sandbox/run             执行一段代码（requireAuth，生产仅 remote）
 * GET  /api/sandbox/status          沙盒能力状态（公开只读）
 * GET  /api/sandbox/executions      当前用户执行记录列表
 * GET  /api/sandbox/executions/:id  执行详情查询
 */
import { Router, Response } from 'express';
import { AuthRequest, requireAuth, requireAdmin, optionalAuth } from '../middleware/auth';
import { sandboxService } from '../services/sandbox.service';
import { SUPPORTED_LANGUAGES } from '../services/sandbox.service';
import { sendError } from '../lib/http-error';
import { SandboxExecution } from '../models/SandboxExecution';

const router = Router();

router.post('/run', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { language, code, mode, resourceId } = req.body || {};
    const production = process.env.NODE_ENV === 'production';

    // 生产环境严禁指定 mode，强制 remote
    if (production && Object.prototype.hasOwnProperty.call(req.body || {}, 'mode')) {
      return res.status(400).json({ success: false, error: '生产环境不接受 mode 参数，执行器固定为 remote' });
    }
    // 生产环境拒绝 mock/local 模式
    const effectiveMode = production ? 'remote' : (mode || undefined);
    if (production && (effectiveMode === 'mock' || effectiveMode === 'local')) {
      return res.status(400).json({ success: false, error: '生产环境不允许 mock 或 local 模式' });
    }

    if (typeof code !== 'string' || code.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'code 不能为空' });
    }
    if (code.length > 64 * 1024) {
      return res.status(413).json({ success: false, error: '代码过长（上限 64KB）' });
    }

    // 用户级限流检查
    const userId = req.user?.id;
    if (userId) {
      const limitCheck = await sandboxService.checkRateLimit(userId.toString());
      if (!limitCheck.allowed) {
        return res.status(429).json({
          success: false,
          error: limitCheck.reason || '请求过于频繁，请稍后再试',
          retryAfterMs: limitCheck.retryAfterMs,
        });
      }
    }

    const result = await sandboxService.run({
      language: language as any,
      code,
      mode: production ? undefined : effectiveMode as any,
      resourceId: resourceId || (req.body as any)?.resourceId,
    });

    // 持久化执行记录（异步，不阻塞响应）
    if (userId) {
      sandboxService.persistExecution(userId.toString(), result, code).catch((err) => {
        console.error('sandbox persist error:', err?.message || err);
      });
    }

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
        production: process.env.NODE_ENV === 'production',
        defaultMode: sandboxService.defaultMode(),
        mockEnabled: providers.find((item) => item.mode === 'mock')?.configured === true,
        localEnabled: providers.find((item) => item.mode === 'local')?.configured === true,
        providers,
        supportedLanguages: SUPPORTED_LANGUAGES,
        // 生产验收探针字段
        remoteAvailable: process.env.NODE_ENV === 'production'
          ? Boolean(process.env.SANDBOX_REMOTE_URL && process.env.SANDBOX_REMOTE_TOKEN)
          : undefined,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 查询当前用户的执行记录列表
router.get('/executions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));

    const [records, total] = await Promise.all([
      SandboxExecution.find({ userId })
        .select('-securityEvents -stdout -stderr')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SandboxExecution.countDocuments({ userId }),
    ]);

    res.json({
      success: true,
      data: {
        list: records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 查询执行详情
router.get('/executions/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const record = await SandboxExecution.findOne({
      executionId: req.params.id,
      userId,
    }).lean();

    if (!record) {
      return res.status(404).json({ success: false, error: '执行记录不存在' });
    }

    res.json({ success: true, data: record });
  } catch (err) {
    sendError(res, err);
  }
});

// 管理员查看任意用户的执行记录（用于安全审计）
router.get('/admin/executions', requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '20'), 10) || 20));
    const statusFilter = req.query.status as string | undefined;
    const userIdFilter = req.query.userId as string | undefined;

    const filter: any = {};
    if (statusFilter && ['success', 'error', 'timeout', 'denied', 'resource_exhausted'].includes(statusFilter)) {
      filter.status = statusFilter;
    }
    if (userIdFilter) {
      filter.userId = userIdFilter;
    }

    const [records, total] = await Promise.all([
      SandboxExecution.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SandboxExecution.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: {
        list: records,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;