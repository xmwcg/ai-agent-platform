import { Router, Request, Response } from 'express';
import { translationService } from '../services/translation.service';
import { planGeneratorService } from '../services/plan-generator.service';
import { fileConvertService, getSupportedConversionList } from '../services/file-convert.service';
import { mediaGenService, MediaTaskType, MediaProviderName, listMediaProviders } from '../services/media-gen.service';
import { optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';

const router = Router();

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
    const { type, prompt, imageBase64, negativePrompt, duration, size, style } = req.body;
    if (!MEDIA_TYPES.includes(type)) {
      return res.status(400).json({ success: false, error: '不支持的媒体类型' });
    }
    const result = await mediaGenService.generate({ type, prompt, imageBase64, negativePrompt, duration, size, style });
    if (req.user?.id) await quotaIncrement(req.user.id, 'media_gen');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

router.get('/media/types', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: [
      { type: 'image2image', label: '图生图', desc: '基于参考图生成风格化图像' },
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
    if (!['mock', 'hunyuan', 'keling', 'jimeng'].includes(provider)) {
      return res.status(400).json({ success: false, error: '不支持的厂商' });
    }
    const result = await mediaGenService.queryTask(provider, taskId);
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// ============ 演示用：下载转换结果占位 ============
router.get('/convert/download', (req: Request, res: Response) => {
  const file = (req.query.file as string) || 'result';
  // 返回最小占位文件（生产环境返回真实转换产物）
  res.setHeader('Content-Disposition', `attachment; filename="${file}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.send(Buffer.from(`Converted file placeholder for ${file}. Production will return real output.`));
});

export default router;
