import { Router, Request, Response } from 'express';
import { mediaGenService } from '../services/media-gen.service';
import { MediaTask } from '../models/MediaTask';
import { storeImage, isHttpUrl, getObjectStorage } from '../lib/object-storage';
import { optionalAuth } from '../middleware/auth';
import { quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

/**
 * 文生图：真实异步生成
 * 提交请求 → 交由 media-gen 多厂商框架（混元 TC3 / Mock 兜底）→ 返回 taskId（异步任务）
 * 前端轮询 GET /query/:taskId 获取结果；结果图片落对象存储（OSS）后返回稳定 URL。
 */
router.post('/generate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { prompt, negativePrompt, size, n, style, provider } = req.body;

    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ success: false, error: 'Prompt 不能为空' });
    }

    const userId = (req as any).user?.id;
    const result = await mediaGenService.generate({
      type: 'text2img',
      prompt: prompt.trim(),
      ...(negativePrompt ? { negativePrompt } : {}),
      ...(size ? { size } : {}),
      ...(n ? { n: Number(n) || 1 } : {}),
      ...(style ? { style } : {}),
      ...(provider ? { provider } : {}),
    });

    // 把 userId 关联回任务，便于按用户隔离历史
    if (userId && result.taskId) {
      await MediaTask.findOneAndUpdate(
        { taskId: result.taskId },
        { $set: { userId } },
        { new: true }
      ).catch(() => {/* 可忽略：任务可能尚未落库 */});
    }

    // 登录用户记一笔 media_gen 配额（与媒体生成技能一致）
    if (userId) {
      quotaIncrement(userId, 'media_gen').catch(() => {/* 配额失败不阻断生成 */});
    }

    // 同步返回任务句柄，前端据此轮询
    res.json({
      success: true,
      data: {
        taskId: result.taskId,
        status: result.status,
        provider: result.provider,
        note: result.note,
      },
    });
  } catch (err) {
    logger.error('text2img', '生成失败', err);
    sendError(res, err);
  }
});

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
