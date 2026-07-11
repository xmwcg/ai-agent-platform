import { Router, Request, Response } from 'express';
import { mediaGenService } from '../services/media-gen.service';
import { listMediaProviders } from '../services/media-gen.service';
import { MediaTask } from '../models/MediaTask';
import { storeImage, isHttpUrl, getObjectStorage } from '../lib/object-storage';
import { optionalAuth } from '../middleware/auth';
import {
  enforceQuota,
  enforceCostValve,
  quotaIncrement,
  quotaCostRecord,
} from '../middleware/subscription';
import { text2imgLimiter } from '../middleware/rate-limit';
import { redisClient } from '../config/database';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { NextFunction } from 'express';
import { MediaUserKey, MediaByokProvider } from '../models/MediaUserKey';
import { encryptSecret, decryptSecret } from '../lib/crypto';
import { MediaCredentials } from '../services/media-gen.service';

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
 * BYOK 解析中间件：登录用户若配置并启用了媒体厂商的自带 Key，本次生成走用户凭据（平台零垫付）。
 * - 命中后挂 req.byok = { provider, credentials }，并标记 req.byokBypass 让配额/成本阀门放行。
 * - 用户未显式指定 provider 时，自动选用其第一个启用的 BYOK key 对应厂商。
 * - 前端传 useByok:false 可强制走平台额度；无 BYOK key 时自动回落平台垫付（不影响既有逻辑）。
 */
async function resolveByok(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userId = (req as any).user?.id;
  if (!userId) return next(); // 匿名不支持 BYOK
  const body = (req as any).body || {};
  if (body.useByok === false) return next(); // 用户主动选择平台额度
  const preferred = (body.provider as MediaByokProvider) || undefined;
  try {
    const filter: Record<string, any> = { userId, enabled: true };
    if (preferred) filter.provider = preferred;
    const keyDoc = await MediaUserKey.findOne(filter).lean();
    if (!keyDoc) return next(); // 无对应 BYOK key，走平台垫付
    const credentials: MediaCredentials = {
      secretId: keyDoc.secretIdEnc ? decryptSecret(keyDoc.secretIdEnc) : undefined,
      secretKey: decryptSecret(keyDoc.secretKeyEnc),
    };
    (req as any).byok = { provider: keyDoc.provider, credentials };
    (req as any).byokBypass = true;
    // 未指定 provider 时，自动用 BYOK key 对应厂商
    if (!preferred) body.provider = keyDoc.provider;
  } catch (e: any) {
    logger.warn('text2img', `BYOK 解析失败，回落平台垫付: ${e.message}`);
  }
  next();
}

/**
 * 文生图：真实异步生成
 * 提交请求 → 交由 media-gen 多厂商框架（混元 TC3 / Mock 兜底）→ 返回 taskId（异步任务）
 * 前端轮询 GET /query/:taskId 获取结果；结果图片落对象存储（OSS）后返回稳定 URL。
 */
router.post(
  '/generate',
  text2imgLimiter, // 防刷第三层：生成调用频率闸门（与匿名限次、登录配额互补）
  optionalAuth,
  resolveByok, // BYOK：命中用户自带 Key → 标记零垫付，放行后续配额/成本闸门
  enforceQuota('media_gen'), // 登录用户：当日次数配额前置拦截（超额 402，BYOK 时 bypass）
  enforceCostValve(), // 登录用户：当日垫付成本预算前置拦截（BYOK 时 bypass）
  async (req: Request, res: Response) => {
    try {
      const { prompt, negativePrompt, size, n, style, provider } = req.body;

      if (!prompt || !prompt.trim()) {
        return res.status(400).json({ success: false, error: 'Prompt 不能为空' });
      }

      const userId = (req as any).user?.id;
      // BYOK：登录用户若配置自带媒体 Key，本次走用户凭据（平台零垫付）。
      // resolveByok 中间件已将其挂到 req.byok，并标记 req.byokBypass 放行配额/成本阀门。
      const byok = (req as any).byok as { provider: string; credentials: MediaCredentials } | undefined;

      // —— 服务端成本封顶：数量与分辨率 ——
      const safeN = Math.min(Math.max(Number(n) || 1, 1), TEXT2IMG_MAX_N);
      const safeSize = TEXT2IMG_ALLOWED_SIZES.includes(size) ? size : TEXT2IMG_DEFAULT_SIZE;

      // —— 匿名用户每日限次真实生成，超出转 Mock（免垫付）——
      let anonRealLeft: number | undefined;
      let effectiveProvider = (byok?.provider as any) || provider || undefined;
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
        ...(byok?.credentials ? { credentials: byok.credentials } : {}),
      });

      // 把 userId 关联回任务，便于按用户隔离历史
      if (userId && result.taskId) {
        await MediaTask.findOneAndUpdate(
          { taskId: result.taskId },
          { $set: { userId } },
          { new: true }
        ).catch(() => {/* 可忽略：任务可能尚未落库 */});
      }

      // BYOK：把用户凭据加密存入任务，供异步轮询 queryTask 使用（明文不落库，DB 泄露也无法还原）
      if (byok && result.taskId) {
        await MediaTask.findOneAndUpdate(
          { taskId: result.taskId },
          { $set: { byokEnc: encryptSecret(JSON.stringify(byok.credentials)) } }
        ).catch(() => {/* 忽略 */});
      }

      // 仅真实（混元）生成、且非 BYOK 才计费/计配额；BYOK 用用户自己的 Key，平台零垫付
      const isReal = result.provider !== 'mock';
      if (isReal && !byok) {
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
          // BYOK：本次使用用户自带 Key，平台零成本、不计配额/垫付
          byok: !!byok,
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

    // BYOK 任务：从任务中解密用户凭据并注入轮询请求（明文不常驻，用完即弃）
    let byokCredentials: MediaCredentials | undefined;
    if ((task as any).byokEnc) {
      try {
        byokCredentials = JSON.parse(decryptSecret((task as any).byokEnc));
      } catch (e: any) {
        logger.warn('text2img', `BYOK 凭据解密失败，回落平台凭据: ${e.message}`);
      }
    }
    const result = await mediaGenService.queryTask(task.provider as any, taskId, byokCredentials);

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

/** 诊断：各媒体生成厂商配置状态（便于排查 Key 缺失） */
router.get('/providers', optionalAuth, async (_req: Request, res: Response) => {
  const providers = listMediaProviders();
  const configured = providers.filter(p => p.configured).map(p => p.name);
  res.json({
    success: true,
    data: {
      providers,
      summary: configured.length ? `已配置厂商: ${configured.join(', ')}` : '无厂商配置，自动回退 Mock 模式',
      mockFallback: configured.length === 0,
    },
  });
});

export default router;
