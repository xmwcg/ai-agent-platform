/**
 * AI 网关路由（OmniRoute 风格统一入口）
 *   GET  /api/gateway/providers   列出网关 provider 及配置状态
 *   POST /api/gateway/chat        统一对话入口（前缀寻址 + fallback）
 */
import { Router } from 'express';
import { route, listGatewayProviders, listGatewayModels } from '../gateway/ai-gateway.service';
import { optionalAuth } from '../middleware/auth';

const router = Router();

router.get('/providers', (req, res) => {
  res.json({ ok: true, providers: listGatewayProviders() });
});

/** 全部可选模型（内置 + 第三方自定义），供前端模型选择器 */
router.get('/models', (req, res) => {
  res.json({ ok: true, data: listGatewayModels() });
});

router.post('/chat', optionalAuth, async (req, res) => {
  try {
    const { model, messages, temperature, maxTokens, provider } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ ok: false, error: 'messages 不能为空' });
    }
    const result = await route({ model, messages, temperature, maxTokens, provider });
    res.json({ ok: true, ...result });
  } catch (e: any) {
    res.status(502).json({ ok: false, error: e.message });
  }
});

export default router;
