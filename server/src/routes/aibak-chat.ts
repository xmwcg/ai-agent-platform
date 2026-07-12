import { Router, Response } from 'express';
import axios from 'axios';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// CloudBase ai-chat 云函数 HTTP 地址（消耗小程序成长计划免费额度）
const CLOUDBASE_CHAT_URL = process.env.CLOUDBASE_CHAT_URL ||
  'https://jymkjtools-study-d6eipek12446b18-1450366372.ap-shanghai.app.tcloudbase.com/ai-chat';

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
router.get('/status', async (_req, res: Response) => {
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
      models: ['hy3', 'hy3-preview'],
      provider: 'cloudbase-free',
      quotaSource: '小程序成长计划免费额度',
    });
  } catch (error: any) {
    res.json({
      success: false,
      connected: false,
      error: error.message,
      models: ['hy3', 'hy3-preview'],
      provider: 'cloudbase-free',
      quotaSource: '小程序成长计划免费额度',
    });
  }
});

export default router;
