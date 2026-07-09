import { Router, Request, Response } from 'express';
import { text2ImgService } from '../services/text2img.service';
import { optionalAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// 文生图生成
router.post('/generate', optionalAuth, async (req: Request, res: Response) => {
  try {
    const { prompt, negativePrompt, size, n, style } = req.body;

    if (!prompt) {
      return res.status(400).json({ success: false, error: 'Prompt is required' });
    }

    // 检查 API Key（统一腾讯云 TC3 凭据）
    if (!process.env.HUNYUAN_SECRET_ID && !process.env.HUNYUAN_SECRET_KEY && !process.env.HUNYUAN_API_KEY) {
      // 模拟模式
      const result = await text2ImgService.generateMock({ prompt, size, n, style });
      return res.json({ success: true, data: result });
    }

    const result = await text2ImgService.generate({ prompt, negativePrompt, size, n, style });
    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('text2img', '生成失败', err);
    sendError(res, err);
  }
});

// 获取生成历史（模拟）
router.get('/history', optionalAuth, async (req: Request, res: Response) => {
  res.json({ success: true, data: [] });
});

export default router;
