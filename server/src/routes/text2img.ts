import { Router, Request, Response } from 'express';
import { mediaGenService } from '../services/media-gen.service';
import { MediaTask } from '../models/MediaTask';
import { storeImage, isHttpUrl, getObjectStorage } from '../lib/object-storage';
import { optionalAuth } from '../middleware/auth';
import {
  enforceQuota,
  enforceCostValve,
  quotaIncrement,
  quotaCostRecord,
} from '../middleware/subscription';
import { redisClient } from '../config/database';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// ─── 成本与限额常量（集中管理，便于一键调整）─────────────
/** 单次最多生成张数（封顶，避免一次请求刷爆成本） */
const TEXT2IMG_MAX_N = 2;
/** 允许的分辨率白名单（其余归一为默认档） */
const TEXT2IMG_ALLOWED_SIZES = ['768x768', '1024x1024'];
const TEXT2IMG_DEFAULT_SIZE = '1024x1024';
/** 预估混元文生图单价（分/张），仅用于成本阀门计量，不向用户收费 */
const TEXT2IMG_COST_FEN_PER_IMAGE = 8;
/** 匿名用户每日真实生成次数上限，超出后自动转 Mock（免垫付） */
const ANON_DAILY_LIMIT = 3;

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

/** 取客户端 IP（兼容反代场景） */
function getClientIp(req: Request): string {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string') return xff.split(',')[0].trim();
  return req.ip || 'unknown';
}

/**
 * 文生图：真实异步生成
 * 提交请求 → 交由 media-gen 多厂商框架（混元 TC3 / Mock 兜底）→ 返回 taskId（异步任务）
 * 前端轮询 GET /query/:taskId 获取结果；结果图片落对象存储（OSS）后返回稳定 URL。
 */
router.post(
  '/generate',
  optionalAuth,
  enforceQuota('media_gen'), // 登录用户：当日次数配额前置拦截（超额 402）
  enforceCostValve(), // 登录用户：当日垫付成本预算前置拦截
  async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, size, n, style, provider } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt 不能为空' });
      }

      const userId = (req as any).user?.id;

      // —— 服务端成本封顶：数量与分辨率 ——
      const safeN = Math.min(Math.max(Number(n) || 1, 1), TEXT2IMG_MAX_N);
      const safeSize = TEXT2IMG_ALLOWED_SIZES.includes(size) ? size : TEXT2IMG_DEFAULT_SIZE;

      // —— 匿名用户每日限次真实生成，超出转 Mock（免垫付）——
      let anonRealLeft: number | undefined;
      let effectiveProvider = provider || undefined;
      let anonKey: string | undefined;
      let anonUsed = 0;
      if (!userId) {
        const ip = getClientIp(req);
        anonKey = `anon_t2i:${ip}:${todayKey()}`;
        try {
          anonUsed = Number(await redisClient.get(anonKey)) || 0;
        } catch {/* 忽略：计数异常不阻断 */ }
        if (anonUsed >= ANON_DAILY_LIMIT) {
          effectiveProvider = 'mock'; // 限额用尽，强制演示模式
        }
      }

      const result = await mediaGenService.generate({
        type: 'text2img',
        prompt: prompt.trim(),
        ...(negativePrompt ? { negativePrompt } : {}),
        size: safeSize,
        n: safeN,
        ...(style ? { style } : {}),
        ...(effectiveProvider ? { provider: effectiveProvider as any } : {}),
      });

      // 把 userId 关联回任务，便于按用户隔离历史
      if (userId && result.taskId) {
        await MediaTask.findOneAndUpdate(
          { taskId: result.taskId },
          { $set: { userId } },
          { new: true }
        ).catch(() => {/* 可忽略：任务可能尚未落库 */});
      }

      // 仅真实（混元）生成才计费/计配额；Mock 演示不花平台钱
      const isReal = result.provider !== 'mock';
      if (isReal) {
        const fen = TEXT2IMG_COST_FEN_PER_IMAGE * safeN;
        if (userId) {
          quotaIncrement(userId, 'media_gen').catch(() => {/* 配额失败不阻断 */});
          quotaCostRecord(userId, fen).catch(() => {/* 成本记录失败不阻断 */});
        } else if (anonKey) {
          // 匿名真实生成：累加当日计数（用于限次）
          try {
            await redisClient.incr(anonKey);
            await redisClient.expire(anonKey, 86400);
          } catch {/* 忽略 */ }
        }
      }

      // 匿名用户当日剩余真实次数（已包含本次）
      if (!userId) {
        anonRealLeft = Math.max(ANON_DAILY_LIMIT - (anonUsed + (isReal ? 1 : 0)), 0);
      }

      // 同步返回任务句柄，前端据此轮询
      res.json({
        success: true,
        data: {
          taskId: result.taskId,
          status: result.status,
          provider: result.provider,
          note: result.note,
          // 提示匿名用户当日剩余真实生成次数（已受限额保护）
          anonRealLeft,
        },
      });
    } catch (err) {
      logger.error('text2img', '生成失败', err);
      sendError(res, err);
    }
  }
);

/**
 * 查询异步任务结果（轮询）。
 * 完成后把结果图片存入对象存储（OSS），返回稳定可访问 URL（多图一并返回 images）。
 */
router.get('/query/:taskId', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = await MediaTask.findOne({ taskId }).lean();
    if (!task) {
      return res.status(404).json({ success: false, error: '任务不存在或已过期' });
    }

    const result = await mediaGenService.queryTask(task.provider as any, taskId);

    // 已完成 → 落对象存储，返回稳定 URL
    if (result.status === 'completed') {
      let finalUrl = result.outputUrl;
      const storedImages: string[] = [];

      // 主图
      if (finalUrl && isHttpUrl(finalUrl)) {
        try {
          finalUrl = await storeImage({ url: finalUrl }, { prefix: 'text2img' });
        } catch (e: any) {
          logger.warn('text2img', `主图落 OSS 失败，回退原 URL: ${e.message}`);
        }
      }
      // 多图
      if (result.images && result.images.length) {
        for (const img of result.images) {
          if (isHttpUrl(img)) {
            try {
              storedImages.push(await storeImage({ url: img }, { prefix: 'text2img' }));
            } catch {
              storedImages.push(img);
            }
          } else {
            storedImages.push(img);
          }
        }
      }

      // 持久化最终 URL（OSS 之后的稳定地址）
      await MediaTask.findOneAndUpdate(
        { taskId },
        { $set: { outputUrl: finalUrl, status: 'completed', images: storedImages.length ? storedImages : undefined } }
      ).catch(() => {/* 忽略 */});

      return res.json({
        success: true,
        data: {
          taskId,
          status: 'completed',
          type: result.type,
          outputUrl: finalUrl,
          images: storedImages.length ? storedImages : (finalUrl ? [finalUrl] : []),
          provider: result.provider,
          note: result.note,
        },
      });
    }

    // 处理中
    res.json({
      success: true,
      data: {
        taskId,
        status: 'processing',
        type: result.type,
        provider: result.provider,
        note: result.note,
      },
    });
  } catch (err) {
    logger.error('text2img', '查询失败', err);
    sendError(res, err);
  }
});

/**
 * 生成历史（真实持久化，MongoDB；不可用时返回空列表兜底）。
 * 登录用户只看到自己的任务；匿名用户返回最近公开任务。
 */
router.get('/history', optionalAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    const filter: Record<string, any> = { type: 'text2img' };
    if (userId) filter.userId = userId;

    let rows: any[] = [];
    try {
      if (MediaTask.db.readyState === 1) {
        rows = await MediaTask.find(filter)
          .sort({ createdAt: -1 })
          .limit(50)
          .lean();
      }
    } catch (e: any) {
      logger.warn('text2img', `历史查询失败: ${e.message}`);
    }

    res.json({
      success: true,
      data: rows.map((r) => ({
        taskId: r.taskId,
        prompt: r.prompt,
        outputUrl: r.outputUrl,
        images: (r as any).images || (r.outputUrl ? [r.outputUrl] : []),
        status: r.status,
        provider: r.provider,
        createdAt: r.createdAt,
      })),
    });
  } catch (err) {
    logger.error('text2img', '历史查询失败', err);
    sendError(res, err);
  }
});

/** 诊断：当前使用的对象存储后端（便于排查 OSS 配置） */
router.get('/storage-info', optionalAuth, async (_req: Request, res: Response) => {
  const storage = getObjectStorage();
  res.json({ success: true, data: { storage: storage.name, configured: storage.isConfigured() } });
});

export default router;
