import { Router, Request, Response } from 'express';
import { createAIClient, aiModelManager } from '../config/ai-models';
import { aiAgentService } from '../services/ai-agent';
import { callCloudbaseChat } from './aibak-chat';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { enforceQuota, quotaIncrement, enforceCostValve, quotaCostRecord } from '../middleware/subscription';
import { estimateCostFen } from '../services/cost-control.service';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';


const router = Router();

// 根路由：AI 服务端点索引
router.get('/', (_req: Request, res: Response) => {
  res.json({
    success: true,
    name: 'ai-service',
    endpoints: [
      'POST /api/ai/chat - AI 对话',
      'GET  /api/ai/models - 可用模型列表',
      'GET  /api/ai/test/:provider - 测试模型连接',
      'POST /api/ai/session - 创建对话会话',
      'GET  /api/ai/session/:sessionId - 获取会话详情',
    ]
  });
});


// 聊天接口（使用 Agent 服务；chat provider 不可用时回退 CloudBase 免费模型，保证可用）
router.post('/chat', optionalAuth, enforceCostValve(), enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const { message, sessionId, config, model, provider } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    let currentSessionId = sessionId;
    const userId = req.user?.id || 'anonymous';

    // If no sessionId from client or session not found on server, create new server session
    if (!currentSessionId || !aiAgentService.getSession(currentSessionId)) {
      currentSessionId = await aiAgentService.createSession(userId);
    }

    // 发送消息（model/provider 允许前端实时切换模型，直连统一网关）
    let reply: string;
    let usage: any = undefined;
    try {
      const result = await aiAgentService.sendMessage(currentSessionId, message, config, {
        model: model || undefined,
        provider: provider || undefined,
      });
      reply = result.reply;
      usage = result.usage;
    } catch (gwErr) {
      // 兜底：外部 chat provider 未配置/不可用时，走 CloudBase 小程序成长计划免费模型
      // 弃用模型错误直接返回给前端，不静默降级
      const gwMsg = (gwErr as Error)?.message || "";
      if (gwMsg.includes("DEPRECATED_MODEL") || gwMsg.includes("deprecated")) {
        return res.status(400).json({ error: gwMsg, code: "DEPRECATED_MODEL" });
      }
      
      logger.warn('ai.chat', `Gateway failed, falling back to CloudBase free model: ${(gwErr as Error)?.message}`);
      const cfMessages = [
        { role: 'system', content: config?.systemPrompt || 'You are a helpful AI assistant.' },
        { role: 'user', content: message },
      ];
      reply = await callCloudbaseChat(cfMessages, 'hy3');
    }

    // 登录用户：累加用量 + 记录 AI 成本（驱动成本预警阀门）
    if (req.user?.id) {
      await quotaIncrement(req.user.id, 'ai_chat');
      const u = usage || {};
      const costFen = estimateCostFen(Number(u.prompt_tokens) || 0, Number(u.completion_tokens) || 0);
      await quotaCostRecord(req.user.id, costFen);
    }

    res.json({
      success: true,
      sessionId: currentSessionId,
      message: reply,
      usage,
      provider: usage ? undefined : 'cloudbase-free'
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
  if (process.env.NODE_ENV === 'production' && provider === 'mock') {
    return res.status(400).json({
      success: false,
      error: '生产环境禁止使用 Mock AI Provider',
      code: 'AI_MOCK_DISABLED',
    });
  }
  
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
