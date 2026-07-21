import { Router, Response } from 'express';
import axios from 'axios';
import { randomBytes } from 'crypto';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';
import {
  callCloudbaseChat,
  callKnowledgeGatewayChat,
  isKnowledgeGatewayAvailable,
  getKnowledgeGatewayInfo,
  AIBAK_MODELS,
} from '../services/cloudbase-ai.service';
import { putAsset, getAsset, deleteAsset } from '../services/asset-store';

const router = Router();

// 图像生成云函数（文生图 / 图生图），默认由 chat 云函数 URL 推导同名 ai-image 函数
const CLOUDBASE_CHAT_URL = process.env.CLOUDBASE_CHAT_URL ||
  'https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat';
// 图像生成云函数（文生图 / 图生图），默认由 chat 云函数 URL 推导同名 ai-image 函数
// （jymkjtools-study 免费额度，供首页 AI 客服 / 免费体验使用，不在本次 jymkj-knowlage 改动范围内）
const CLOUDBASE_IMAGE_URL = process.env.CLOUDBASE_IMAGE_URL ||
  CLOUDBASE_CHAT_URL.replace(/\/ai-chat$/, '/ai-image');

// 图生图参考图临时托管：CloudBase 图像网关对请求体大小有限制，base64 直传会 413，
// 因此后端把参考图存入可插拔资产存储并暴露公网 URL（经 nginx /api 反代），
// 让函数通过 image_urls 回源拉取；后端支持 COS / 本地磁盘 / 内存，多实例可达。
const AIBAK_PUBLIC_ORIGIN = process.env.AIBAK_PUBLIC_ORIGIN || 'https://aibak.site';

/** 把 dataURL 存入资产存储，返回公网可访问的 URL（供 CloudBase 函数 image_urls 拉取） */
async function storeRef(dataUrl: string): Promise<{ id: string; url: string } | null> {
  const m = /^data:([^;]+);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  const ctype = m[1] || 'image/png';
  const buf = Buffer.from(m[2], 'base64');
  if (!buf.length) return null;
  const id = randomBytes(12).toString('hex');
  await putAsset(id, buf, ctype);
  // 5 分钟后自动清理，避免存储膨胀
  setTimeout(() => { deleteAsset(id).catch(() => {}); }, 5 * 60 * 1000).unref();
  return { id, url: `${AIBAK_PUBLIC_ORIGIN}/api/aibak/refs/${id}` };
}

const SYSTEM_PROMPT = '你是 aibak.site (Reasonix AI) 平台的 AI 助手。请用中文清晰简洁地回答问题。写代码时请使用 markdown 代码块。';

/**
 * 调用 CloudBase ai-chat 云函数（小程序成长计划免费额度）生成文本。
 * 已抽离至 services/cloudbase-ai.service，此处仅做再导出以兼容既有引用。
 */
export { callCloudbaseChat };

/**
 * POST /api/aibak/chat
 * 左侧 AI 对话入口：优先 jymkj-knowlage 网关直调，回退 jymkjtools-study 云函数代理
 */
router.post('/chat', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { message, messages: inputMessages, model = 'hy3', stream = false, history } = req.body;

    // 构建消息数组
    let chatMessages: Array<{ role: string; content: string }> = [];

    if (inputMessages && Array.isArray(inputMessages) && inputMessages.length > 0) {
      chatMessages = [...inputMessages];
      if (chatMessages.length === 0 || chatMessages[0].role !== 'system') {
        chatMessages.unshift({ role: 'system', content: SYSTEM_PROMPT });
      }
    } else if (message) {
      chatMessages = [
        { role: 'system', content: SYSTEM_PROMPT },
        ...(history || []),
        { role: 'user', content: message },
      ];
    } else {
      return res.status(400).json({ success: false, error: 'message 或 messages 必填' });
    }

    const startTime = Date.now();
    let text: string;
    let provider = 'cloudbase-free';

    // ── 通道1：jymkj-knowlage OpenAI 兼容网关（直调，不经过云函数） ──
    if (isKnowledgeGatewayAvailable()) {
      try {
        logger.info('aibak-chat', `🧠 jymkj-knowlage 网关, model=${model}`);
        text = await callKnowledgeGatewayChat(chatMessages, model);
        provider = 'jymkj-knowlage-gateway';
        logger.info('aibak-chat', `✅ jymkj-knowlage 网关成功, ${Date.now() - startTime}ms`);
      } catch (gatewayErr: any) {
        logger.warn('aibak-chat', `⚠️ jymkj-knowlage 网关失败: ${gatewayErr.message}, 回退 jymkjtools-study 云函数`);
        // ── 通道2：回退到 jymkjtools-study 云函数代理 ──
        try {
          text = await callCloudbaseChat(chatMessages, model);
          provider = 'jymkjtools-study-proxy';
        } catch (cfErr: any) {
          logger.error('aibak-chat', `❌ 双通道均失败: ${cfErr.message}`);
          return res.status(502).json({
            success: false,
            error: cfErr.message || 'AI 服务返回异常',
            code: 'DUAL_CHANNEL_ERROR',
          });
        }
      }
    } else {
      // ── 通道2：jymkj-knowlage 网关未配置，直接用云函数 ──
      logger.info('aibak-chat', `调用 jymkjtools-study 云函数, model=${model}`);
      try {
        text = await callCloudbaseChat(chatMessages, model);
        provider = 'jymkjtools-study-proxy';
      } catch (err: any) {
        logger.warn('aibak-chat', `❌ 云函数返回失败: ${err?.message || '未知'}`);
        return res.status(502).json({
          success: false,
          error: err?.message || 'AI 服务返回异常',
          code: 'CLOUDBASE_ERROR',
        });
      }
    }

    const elapsed = Date.now() - startTime;
    res.json({
      success: true,
      text,
      model,
      provider,
      elapsedMs: elapsed,
    });
  } catch (error: any) {
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      logger.error('aibak-chat', '⏱ AI 响应超时 (60s)');
      return res.status(504).json({ success: false, error: 'AI 响应超时，请稍后重试', code: 'TIMEOUT' });
    }
    if (error.response) {
      logger.error('aibak-chat', `HTTP ${error.response.status}: ${JSON.stringify(error.response.data)}`);
      return res.status(502).json({
        success: false,
        error: error.response.data?.error || `AI 服务异常 (${error.response.status})`,
        code: error.response.data?.code || 'UPSTREAM_ERROR',
      });
    }
    logger.error('aibak-chat', `未知错误: ${error.message}`);
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
    // 图生图：base64 直传会触发网关 413，改为托管后走 image_urls（函数回源拉取）
    let refId: string | undefined;
    if (isImage2Image && imageBase64) {
      const ref = await storeRef(String(imageBase64));
      if (ref) { body.image_urls = [ref.url]; refId = ref.id; }
    } else if (imageUrl) {
      body.image_urls = [imageUrl];
    }

    logger.info('aibak-image', `调用云函数 ai-image, model=${model}`);
    const startTime = Date.now();

    let response: any;
    try {
      response = await axios.post(CLOUDBASE_IMAGE_URL, body, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 170000, // 图像生成（尤其 thinking 模式）可能较长，需小于云函数 180s 超时
      });
    } finally {
      // 函数已在 generateImage 内同步拉取参考图，调用结束即可释放资产
      if (refId) { await deleteAsset(refId).catch(() => {}); }
    }

    const elapsed = Date.now() - startTime;

    if (response.data?.success) {
      // 兼容云函数两种返回：data:[{url,revised_prompt}] 或 单值 url
      const images =
        response.data.data ||
        response.data.images ||
        (response.data.url ? [{ url: response.data.url, revised_prompt: response.data.revisedPrompt || response.data.revised_prompt }] : []) ||
        [];
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

// 图生图参考图公网回源：CloudBase 函数通过 image_urls 拉取（需经 nginx /api 反代）
router.get('/refs/:id', async (_req, res: Response) => {
  const item = await getAsset(_req.params.id);
  if (!item) return res.status(404).send('not found');
  res.set('Content-Type', item.ctype);
  res.set('Cache-Control', 'no-store');
  res.send(item.buf);
});

router.get('/status', async (_req, res: Response) => {
  const models = [...AIBAK_MODELS.text, ...AIBAK_MODELS.image];
  const gatewayInfo = getKnowledgeGatewayInfo();

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
      // jymkj-knowlage 网关状态
      knowledgeGateway: {
        available: gatewayInfo.available,
        url: gatewayInfo.url,
        models: gatewayInfo.models,
        env: gatewayInfo.env,
      },
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
      knowledgeGateway: {
        available: gatewayInfo.available,
        url: gatewayInfo.url,
        models: gatewayInfo.models,
        env: gatewayInfo.env,
      },
    });
  }
});

export default router;
