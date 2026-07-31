import { Router, Request, Response } from 'express';
import { translationService } from '../services/translation.service';
import { planGeneratorService } from '../services/plan-generator.service';
import { fileConvertService, getSupportedConversionList, getStoredConversion } from '../services/file-convert.service';
import { mediaGenService, MediaTaskType, MediaProviderName, listMediaProviders } from '../services/media-gen.service';
import path from 'path';
import fs from 'fs/promises';
import axios from 'axios';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, getQuotaUsage, quotaIncrement, resolveUserPlan } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { LOCAL_STORAGE_DIR } from '../lib/object-storage';
import { User } from '../models/User';
import { PLANS, planSatisfies } from '../config/billing';
import { TOOL_ENTITLEMENTS, getToolEntitlement } from '../config/tool-entitlements';
import { deductCredits, grantCredits, InsufficientCreditsError } from '../services/credit-ledger.service';

const router = Router();

// ─── 根路由：返回工具箱能力和入口 ───
router.get('/', (_req, res) => {
  res.json({
    success: true,
    data: {
      capabilities: [
        { type: 'translate', label: '翻译', path: '/api/tools/translate', desc: '支持多语言翻译与语言检测' },
        { type: 'plan', label: '方案生成', path: '/api/tools/plan', desc: '根据主题和需求生成专业方案' },
        { type: 'convert', label: '文件转换', path: '/api/tools/convert', desc: '多格式文件转换（文本/代码/表格）' },
        { type: 'media', label: '媒体生成', path: '/api/tools/media', desc: '文生图、图生图、文生视频、图生视频' },
      ],
    },
  });
});

// 工具箱权益目录：公开返回能力说明，登录后补充套餐、余额与当日额度。
router.get('/entitlements', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const plan = req.user ? (await resolveUserPlan(req.user.id)).plan : 'free';
    const user = req.user ? await User.findById(req.user.id).select('credits').lean() : null;
    const credits = Number(user?.credits || 0);
    const quota = req.user ? await getQuotaUsage(req.user.id).catch(() => null) : null;

    const tools = Object.values(TOOL_ENTITLEMENTS).map((tool) => {
      const planAllowed = planSatisfies(plan, tool.requiredPlan);
      const creditAllowed = tool.creditCost > 0 && credits >= tool.creditCost;
      return {
        ...tool,
        allowed: planAllowed || creditAllowed,
        accessMode: planAllowed ? 'plan' : creditAllowed ? 'credits' : 'upgrade',
        reason: planAllowed
          ? `${PLANS[plan].name}已解锁`
          : creditAllowed
            ? `可使用 ${tool.creditCost} 积分按次体验`
            : `需要${PLANS[tool.requiredPlan].name}或至少${tool.creditCost}积分`,
        upgradeUrl: '/pricing',
        creditsUrl: '/points-center',
      };
    });

    res.json({
      success: true,
      data: {
        plan,
        planName: PLANS[plan].name,
        credits,
        quota: quota?.ai_chat || { used: 0, limit: PLANS[plan].limits.ai_chat },
        tools,
      },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// ============ 翻译 ============
router.get('/translate/languages', (req: Request, res: Response) => {
  res.json({ success: true, data: translationService.getSupportedLanguages() });
});

router.post('/translate', optionalAuth, enforceQuota('translate'), async (req: AuthRequest, res: Response) => {
  try {
    const { text, targetLang, sourceLang } = req.body;
    if (!text || !targetLang) {
      return res.status(400).json({ success: false, error: '文本与目标语言必填' });
    }
    const result = await translationService.translate(text, targetLang, sourceLang);
    if (req.user?.id) await quotaIncrement(req.user.id, 'translate');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// ============ 方案生成 ============
router.post('/plan', optionalAuth, enforceQuota('plan_generate'), async (req: AuthRequest, res: Response) => {
  try {
    const { topic, type, audience, length, requirements } = req.body;
    if (!topic) return res.status(400).json({ success: false, error: '方案主题必填' });
    const result = await planGeneratorService.generate({ topic, type, audience, length, requirements });
    if (req.user?.id) await quotaIncrement(req.user.id, 'plan_generate');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// ============ 文件转换 ============
router.get('/convert/formats', (req: Request, res: Response) => {
  res.json({ success: true, data: getSupportedConversionList() });
});

router.post('/convert', optionalAuth, enforceQuota('file_convert'), async (req: AuthRequest, res: Response) => {
  try {
    const { fileName, sourceFormat, targetFormat, content } = req.body;
    if (!fileName || !sourceFormat || !targetFormat) {
      return res.status(400).json({ success: false, error: '缺少必要字段' });
    }
    const result = await fileConvertService.convert(fileName, sourceFormat, targetFormat, content);
    if (req.user?.id) await quotaIncrement(req.user.id, 'file_convert');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// ============ 媒体生成（图生图 / 文生视频 / 图生视频） ============
const MEDIA_TYPES: MediaTaskType[] = ['image2image', 'text2video', 'image2video'];
router.post('/media', optionalAuth, enforceQuota('media_gen'), async (req: AuthRequest, res: Response) => {
  try {
    const { type, prompt, imageBase64, negativePrompt, duration, size, frameRate, style, provider } = req.body;
    if (!MEDIA_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: '不支持的媒体类型' });
    }
    const mediaTool = getToolEntitlement('media');
    const plan = req.user ? (await resolveUserPlan(req.user.id)).plan : 'free';
    const requestKey = String(req.headers['x-request-id'] || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    let chargedCredits = 0;

    if (mediaTool && !planSatisfies(plan, mediaTool.requiredPlan)) {
      if (!req.user?.id) {
        return res.status(401).json({ success: false, error: '请先登录后使用内容生产工具', code: 'TOOL_LOGIN_REQUIRED', upgradeUrl: '/pricing', creditsUrl: '/points-center' });
      }
      try {
        await deductCredits({
          userId: req.user.id,
          amount: mediaTool.creditCost,
          idempotencyKey: `tool:${req.user.id}:media:${requestKey}`,
          businessType: 'tool_usage',
          businessId: `media:${requestKey}`,
          description: '内容生产按次体验',
          resource: 'tool:media',
        });
        chargedCredits = mediaTool.creditCost;
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return res.status(402).json({ success: false, error: '积分余额不足', code: 'TOOL_CREDITS_REQUIRED', requiredCredits: mediaTool.creditCost, upgradeUrl: '/pricing', creditsUrl: '/points-center' });
        }
        throw error;
      }
    }

    try {
      const result = await mediaGenService.generate({ type, prompt, imageBase64, negativePrompt, duration, size, frameRate, style, provider });
      if (req.user?.id) await quotaIncrement(req.user.id, 'media_gen');
      res.json({ success: true, data: result, toolId: 'media', creditsCharged: chargedCredits });
    } catch (error) {
      if (chargedCredits && req.user?.id) {
        await grantCredits({
          userId: req.user.id,
          amount: chargedCredits,
          sourceType: 'refund',
          transactionType: 'refund',
          idempotencyKey: `tool-refund:${req.user.id}:media:${requestKey}`,
          businessType: 'tool_usage_refund',
          businessId: `media:${requestKey}`,
          description: '内容生产失败，自动退回积分',
          resource: 'tool:media',
        });
      }
      throw error;
    }
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/media/types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { type: 'text2img', label: '文生图', desc: '根据文本描述生成图像（HY-Image 免费额度）' },
      { type: 'image2image', label: '图生图', desc: '基于参考图生成风格化图像（HY-Image 免费额度）' },
      { type: 'text2video', label: '文生视频', desc: '根据文本描述生成短视频' },
      { type: 'image2video', label: '图生视频', desc: '将静态图转化为动态视频' },
    ],
  });
});

// 厂商配置状态（前端据此提示用户配置密钥）
router.get('/media/providers', (_req: Request, res: Response) => {
  res.json({ success: true, data: listMediaProviders() });
});

// 异步任务状态轮询（视频/图像生成提交后调用）
router.get('/media/task/:provider/:taskId', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const provider = req.params.provider as MediaProviderName;
    const { taskId } = req.params;
    if (!['mock', 'hunyuan', 'keling', 'jimeng', 'moneyprinterturbo', 'agnes'].includes(provider)) {
      return res.status(400).json({ success: false, error: '不支持的厂商' });
    }
    if (process.env.NODE_ENV === 'production' && provider === 'mock') {
      return res.status(400).json({
        success: false,
        error: '生产环境禁止查询 Mock 媒体任务',
        code: 'MEDIA_MOCK_DISABLED',
      });
    }
    const result = await mediaGenService.queryTask(provider, taskId);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 同域流播放 / 下载代理：把视频模型（如 Agnes）的成片以「同源」URL 对外提供。
 *
 * 痛点：Agnes 成片原始 URL 位于 platform-outputs.agnes-ai.space 等跨域域名，
 * 浏览器对跨域 <a download> 会忽略 download 属性（点击只跳转不保存），且 <video> 跨域播放受 CORS 限制，
 * 表现为「生成了视频但文件无法下载 - 没有文件」。
 * 该端点始终经本服务器取流并以同源地址返回，确保 <video> 可播放、下载按钮可保存。
 *
 * - 本地已落盘（outputUrl 以 / 开头）→ 直接 sendFile（高效、可缓存）；
 * - 原始跨域 URL → 服务端拉取后流式回传（inline 或 attachment）。
 */
async function resolveMediaStream(req: Request, res: Response, asAttachment: boolean): Promise<void> {
  const provider = req.params.provider as MediaProviderName;
  const { taskId } = req.params;
  if (!['mock', 'hunyuan', 'keling', 'jimeng', 'moneyprinterturbo', 'agnes'].includes(provider)) {
    res.status(400).json({ success: false, error: '不支持的厂商' });
    return;
  }
  // 仅在生产放行非 mock，避免误用
  if (process.env.NODE_ENV === 'production' && provider === 'mock') {
    res.status(400).json({ success: false, error: '生产环境禁止访问 Mock 媒体' });
    return;
  }
  const result = await mediaGenService.queryTask(provider, taskId);
  const outputUrl: string = (result as any)?.outputUrl || '';
  if (!outputUrl) {
    res.status(404).json({ success: false, error: '成片尚未就绪或不存在' });
    return;
  }
  const fileName = `${taskId}.mp4`;
  // 本地已落盘：直接以静态文件返回（同源、可缓存、最快）
  if (outputUrl.startsWith('/')) {
    const rel = outputUrl.replace(/^\/generated\/?/, '').replace(/^\/+/, '');
    const filePath = path.join(LOCAL_STORAGE_DIR, rel);
    try {
      await fs.access(filePath);
      if (asAttachment) {
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      }
      res.setHeader('Content-Type', 'video/mp4');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.sendFile(filePath);
      return;
    } catch {
      // 落盘文件缺失（极端情况）→ 继续走上游拉取兜底
    }
  }
  // 跨域原始 URL：服务端拉取后流式回传（同源）
  const upstream = outputUrl;
  const upstreamResp = await axios.get(upstream, {
    responseType: 'stream',
    timeout: 120000,
    headers: { 'User-Agent': 'AIBAK-Platform' },
  });
  const upstreamCtype = String(upstreamResp.headers['content-type'] || 'video/mp4');
  res.setHeader('Content-Type', upstreamCtype);
  res.setHeader('Cache-Control', 'public, max-age=86400');
  if (asAttachment) {
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  }
  (upstreamResp.data as NodeJS.ReadableStream).pipe(res);
}

// 同域流播放（供 <video src> 使用，避免跨域 CORS/防盗链导致无法播放）
router.get('/media/stream/:provider/:taskId', optionalAuth, (req: AuthRequest, res: Response) => {
  resolveMediaStream(req, res, false).catch((err) => sendError(res, err));
});

// 同域下载（供「下载成片」按钮，download 属性在同源下生效，可真正保存文件）
router.get('/media/download/:provider/:taskId', optionalAuth, (req: AuthRequest, res: Response) => {
  resolveMediaStream(req, res, true).catch((err) => sendError(res, err));
});

// ============ 下载真实转换产物 ============
router.get('/convert/download', async (req: Request, res: Response) => {
  const id = req.query.id as string;
  const fallbackName = (req.query.name as string) || 'result';
  const item = id ? await getStoredConversion(id) : undefined;
  if (!item) {
    return res.status(404).json({ success: false, error: '转换产物不存在或已过期（10 分钟有效期）' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(item.name)}"`);
  res.setHeader('Content-Type', item.ctype || 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(Buffer.from(item.content, 'utf8'));
});

export default router;
