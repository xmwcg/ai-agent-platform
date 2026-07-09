import { Router, Request, Response } from 'express';
import { createAIClient, aiModelManager } from '../config/ai-models';
import { aiAgentService } from '../services/ai-agent';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';

const router = Router();

// 聊天接口（使用 Agent 服务）
router.post('/chat', optionalAuth, enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const { message, sessionId, config, model, provider } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let currentSessionId = sessionId;

    if (!currentSessionId) {
      const userId = req.user?.id || 'anonymous';
      currentSessionId = await aiAgentService.createSession(userId);
    }

    // 发送消息（model/provider 允许前端实时切换模型，直连统一网关）
    const result = await aiAgentService.sendMessage(currentSessionId, message, config, {
      model: model || undefined,
      provider: provider || undefined,
    });

    // 登录用户累加用量
    if (req.user?.id) {
      await quotaIncrement(req.user.id, 'ai_chat');
    }

    res.json({
      success: true,
      sessionId: currentSessionId,
      message: result.reply,
      usage: result.usage
    });

  } catch (error) {
    sendError(res, error);
  }
});

// 获取可用模型
router.get('/models', (req: Request, res: Response) => {
  const models = aiModelManager.getAvailableModels();
  const providers = aiModelManager.getEnabledProviders().map(p => ({
    name: p.name,
    defaultModel: p.defaultModel
  }));

  res.json({
    success: true,
    models,
    providers,
    defaultProvider: aiModelManager.getDefaultProvider()?.name
  });
});

// 测试 Provider 连接
router.get('/test/:provider', async (req: Request, res: Response) => {
  const { provider } = req.params;
  
  try {
    const result = await aiModelManager.testConnection(provider as any);
    res.json({
      success: true,
      provider,
      connected: result
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 创建新会话
router.post('/session', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id || req.body.userId || 'anonymous';
    const { provider } = req.body;
    const sessionId = await aiAgentService.createSession(userId, provider);
    
    res.json({
      success: true,
      sessionId
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 获取会话历史（需登录 + 仅本人）
router.get('/session/:sessionId', requireAuth, (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const history = aiAgentService.getSessionHistory(sessionId);
    const session = aiAgentService.getSession(sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: '无权查看他人会话' });
    }

    res.json({
      success: true,
      sessionId,
      history,
      provider: session.provider,
      model: session.model
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 清空会话（需登录 + 仅本人）
router.delete('/session/:sessionId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = aiAgentService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: '无权操作他人会话' });
    }
    await aiAgentService.clearSession(sessionId);
    res.json({
      success: true,
      message: 'Session cleared'
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 删除会话（需登录 + 仅本人）
router.delete('/session/:sessionId/delete', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId } = req.params;
    const session = aiAgentService.getSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    if (session.userId !== req.user!.id) {
      return res.status(403).json({ error: '无权操作他人会话' });
    }
    await aiAgentService.deleteSession(sessionId);
    res.json({
      success: true,
      message: 'Session deleted'
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
