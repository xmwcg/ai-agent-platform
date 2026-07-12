import { Router, Response } from 'express';
import axios from 'axios';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// CloudBase ai-chat 云函数 HTTP 地址（消耗小程序成长计划免费额度）
const CLOUDBASE_CHAT_URL = process.env.CLOUDBASE_CHAT_URL ||
  'https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat';

// 图像生成云函数（文生图 / 图生图），默认由 chat 云函数 URL 推导同名 ai-image 函数
const CLOUDBASE_IMAGE_URL = process.env.CLOUDBASE_IMAGE_URL ||
  CLOUDBASE_CHAT_URL.replace(/\/ai-chat$/, '/ai-image');

// 免费额度下支持的 4 个模型（2 文本 + 2 图像）
const AIBAK_MODELS = {
  text: ['hy3', 'hy3-preview'],
  image: ['HY-Image-3.0-Plus-4090-Tob-v1.0', 'HY-Image-v3.0-I2I-ToB-v1.0.1'],
};

const SYSTEM_PROMPT = '你是 aibak.site (Reasonix AI) 平台的 AI 助手。请用中文清晰简洁地回答问题。写代码时请使用 markdown 代码块。';

/**
 * POST /api/aibak/chat
 * 代理调用 CloudBase ai-chat 云函数，优先消耗小程序成长计划赠送的免费额度
 */
router.post('/chat', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, messages: inputMessages, model = 'hy3', stream = false, history } = req.body;

    // 构建消息数组
    let chatMessages: Array<{ role: string; content: string }> = [];

    if (inputMessages && Array.isArray(inputMessages) && inputMessages.length > 0) {
      // 前端直接传了完整的 messages 数组（含历史）
      chatMessages = [...inputMessages];
      // 如果第一个不是 system，自动插入
      if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
        chatMessages.unshift({ role: 'system', content: SYSTEM_PROMPT });
      }
    } else if (message) {
      // 简化的单条消息模式
      chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []),
        { role: 'user', content: message },
      ];
    } else {
      return res.status(400).json({ success: false, error: 'message 或 messages 必填' });
    }

    logger.info('aibak-chat', `调用云函数 ai-chat, model=${model}, msgs=${chatMessages.length}`);

    const startTime = Date.now();
    const response = await axios.post(CLOUDBASE_CHAT_URL, {
      messages: chatMessages,
      model,
      stream: false, // 后端统一用非流式，避免代理复杂性
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 60000,
    });

    const elapsed = Date.now() - startTime;

    if (response.data?.success) {
      const usage = response.data.usage || {};
      logger.info('aibak-chat', `✅ 成功, ${elapsed}ms, tokens=${usage.total_tokens || 'N/A'}`);

      res.json({
        success: true,
        text: response.data.text,
        usage,
        model,
        provider: 'cloudbase-free',
        elapsedMs: elapsed,
      });
    } else {
      logger.warn('aibak-chat', `❌ 云函数返回失败: ${response.data?.error || '未知'}`);
      res.status(502).json({
        success: false,
        error: response.data?.error || 'AI 服务返回异常',
        code: response.data?.code || 'CLOUDBASE_ERROR',
      });
    }
  } catch (error: any) {
    // 区分超时、网络错误、云函数内部错误
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error('aibak-chat', '⏱ CloudBase 云函数超时 (60s)');
      return res.status(504).json({ success: false, error: 'AI 响应超时，请稍后重试', code: 'TIMEOUT' });
    }

    if (error.response) {
      // 云函数返回了 HTTP 错误
      logger.error('aibak-chat', `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      return res.status(502).json({
        success: false,
        error: error.response.data?.error || `AI 服务异常 (${error.response.status})`,
        code: error.response.data?.code || 'UPSTREAM_ERROR',
      });
    }

    logger.error('aibak-chat', `网络错误: ${error.message}`);
    res.status(502).json({ success: false, error: 'AI 服务暂不可用', code: 'NETWORK_ERROR' });
  }
});

/**
 * GET /api/aibak/status
 * 检查 CloudBase AI 云函数是否可连通
 */
/**
 * POST /api/aibak/image
 * 代理调用 CloudBase 图像生成云函数（ai-image），消耗小程序成长计划赠送的免费额度
 * 支持：文生图 HY-Image-3.0-Plus-4090-Tob-v1.0 / 图生图 HY-Image-v3.0-I2I-ToB-v1.0.1
 */
router.post('/image', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { model, prompt, size = '1024x1024', imageBase64, imageUrl } = req.body;

    if (!model || !prompt) {
      return res.status(400).json({ success: false, error: 'model 与 prompt 必填' });
    }

    const isImage2Image = model.includes('I2I');
    if (isImage2Image && !imageBase64 && !imageUrl) {
      return res.status(400).json({ success: false, error: '图生图需要上传参考图（imageBase64 或 imageUrl）' });
    }

    const body: Record<string, any> = { model, prompt, size };
    // 图生图：垫图（base64 需去掉 data URL 前缀）
    if (imageBase64) {
      body.images = [String(imageBase64).replace(/^data:.*;base64,/, '')];
    } else if (imageUrl) {
      body.image_urls = [imageUrl];
    }

    logger.info('aibak-image', `调用云函数 ai-image, model=${model}`);
    const startTime = Date.now();

    const response = await axios.post(CLOUDBASE_IMAGE_URL, body, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 120000, // 图像生成（尤其 thinking 模式）可能较长
    });

    const elapsed = Date.now() - startTime;

    if (response.data?.success) {
      const images = response.data.data || response.data.images || [];
      logger.info('aibak-image', `✅ 成功, ${elapsed}ms, imgs=${images.length}`);
      res.json({
        success: true,
        images,
        model,
        provider: 'cloudbase-free',
        elapsedMs: elapsed,
      });
    } else {
      logger.warn('aibak-image', `❌ 云函数返回失败: ${response.data?.error || '未知'}`);
      res.status(502).json({
        success: false,
        error: response.data?.error || '图像生成失败',
        code: response.data?.code || 'CLOUDBASE_IMAGE_ERROR',
      });
    }
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error('aibak-image', '⏱ CloudBase 图像云函数超时 (120s)');
      return res.status(504).json({ success: false, error: '图像生成超时，请稍后重试', code: 'TIMEOUT' });
    }
    if (error.response) {
      logger.error('aibak-image', `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      return res.status(502).json({
        success: false,
        error: error.response.data?.error || `图像服务异常 (${error.response.status})`,
        code: error.response.data?.code || 'UPSTREAM_ERROR',
      });
    }
    logger.error('aibak-image', `网络错误: ${error.message}`);
    res.status(502).json({ success: false, error: '图像服务暂不可用', code: 'NETWORK_ERROR' });
  }
});

router.get('/status', async (_req, res: Response) => {
  const models = [...AIBAK_MODELS.text, ...AIBAK_MODELS.image];
  try {
    const response = await axios.post(CLOUDBASE_CHAT_URL, {
      messages: [{ role: 'user', content: 'ping' }],
      model: 'hy3',
      stream: false,
    }, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });

    res.json({
      success: true,
      connected: response.data?.success === true,
      models,
      textModels: AIBAK_MODELS.text,
      imageModels: AIBAK_MODELS.image,
      imageEnabled: !!CLOUDBASE_IMAGE_URL,
      provider: 'cloudbase-free',
      quotaSource: '小程序成长计划免费额度',
    });
  } catch (error: any) {
    res.json({
      success: false,
      connected: false,
      error: error.message,
      models,
      textModels: AIBAK_MODELS.text,
      imageModels: AIBAK_MODELS.image,
      imageEnabled: !!CLOUDBASE_IMAGE_URL,
      provider: 'cloudbase-free',
      quotaSource: '小程序成长计划免费额度',
    });
  }
});

export default router;
