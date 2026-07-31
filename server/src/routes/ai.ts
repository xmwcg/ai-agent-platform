import { Router, Request, Response } from 'express';
import { createAIClient, aiModelManager, getPreferredAgnesTextModel } from '../config/ai-models';
import { aiAgentService } from '../services/ai-agent';
import { route } from '../gateway/ai-gateway.service';
import { callCloudbaseChat } from './aibak-chat';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth';
import { enforceQuota, quotaIncrement, enforceCostValve, quotaCostRecord, enforceAnonymousFreeCap, resolveUserPlan } from '../middleware/subscription';
import { estimateCostFen } from '../services/cost-control.service';
import { deductCredits, grantCredits, InsufficientCreditsError } from '../services/credit-ledger.service';
import { getToolEntitlement } from '../config/tool-entitlements';
import { planSatisfies } from '../config/billing';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { AIUsageLog } from '../models/AIUsageLog';


const router = Router();

const PLATFORM_SYSTEM_PROMPT = `你是 NexMind by AIbak 平台内置 AI 助手。NexMind by AIbak 是一个全栈 AI 应用平台，提供 AI 对话、文生图/图生图、通用知识库、智能工具箱、课程学习、工作流、技能市场和智评通项目质量评估。回答用户询问平台本身时，优先基于这些已知事实，不要声称“没有 AIBAK 平台”；不确定的实时价格、余额、订单和模型状态不要编造，提示用户查看对应页面。`;

/**
 * 提示词优化元提示：将用户原始需求改写成「角色+任务+约束+输出格式」专业结构。
 * 免费增值能力：由平台免费模型执行，不消耗用户付费配额。
 */
const DIRECTION_LABELS: Record<string, string> = {
  detailed: '更详细（补充必要上下文与示例细节）',
  concise: '更简洁（精简到核心要点，去除冗余）',
  professional: '更专业（使用专业术语与正式表达）',
  creative: '更有创意（增加新角度、发散思维）',
  structured: '更结构化（分点组织、逻辑清晰、层次分明）',
  role_based: '角色扮演（为 AI 赋予明确的专业角色视角）',
};

function buildOptimizeMetaPrompt(prompt: string, direction: string): string {
  const dirLabel = DIRECTION_LABELS[direction] || DIRECTION_LABELS.detailed;
  return `你是一位顶级的提示词工程专家。请将用户的原始需求优化为高质量、可直接使用的提示词。

【优化方向】${dirLabel}

【输出要求】请严格按以下结构输出优化后的提示词（使用中文，结构清晰，可直接复制使用，不要包含任何额外解释或前后缀）：
# 角色
（AI 应扮演的专业角色，含专业背景与能力边界）

# 任务
（明确、单一的核心目标，说明要达成什么）

# 约束
（输出要求、限制条件、语气风格、需避免的内容）

# 输出格式
（具体的呈现形式，如表格 / 列表 / JSON / 分步骤 / 代码块等）

# 示例（可选）
（给出 1 个简短示例，帮助用户理解期望效果）

【原始需求】
"""
${prompt}
"""

只输出优化后的提示词本身。`;
}

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
router.post('/chat', optionalAuth, enforceAnonymousFreeCap('ai_chat'), enforceCostValve(), enforceQuota('ai_chat'), async (req: AuthRequest, res: Response) => {
  try {
    const { message, sessionId, config, model, provider, toolId } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const tool = getToolEntitlement(toolId);
    if (toolId && !tool) {
      return res.status(400).json({ error: '未知的工具标识', code: 'UNKNOWN_TOOL_ID' });
    }

    let currentSessionId = sessionId;
    const userId = req.user?.id || 'anonymous';

    // If no sessionId from client or session not found on server, create new server session
    if (!currentSessionId || !aiAgentService.getSession(currentSessionId)) {
      currentSessionId = await aiAgentService.createSession(userId);
    }

    // 会员等级路由：免费用户限定免费厂商池（防止兜底漏到付费批发通道产生成本）；
    // 付费用户（pro/max/team）走全量通道，可使用 GPT/批发高端模型。
    const userPlan = req.user?.id ? (await resolveUserPlan(req.user.id)).plan : 'free';
    const tier: 'free' | 'paid' = userPlan === 'free' ? 'free' : 'paid';
    const requestKey = String(req.headers['x-request-id'] || req.body.requestId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
    let chargedToolCredits = 0;

    // 专业工具：会员直接解锁；免费用户可用积分按次体验，未登录用户必须先登录。
    if (tool && !planSatisfies(userPlan, tool.requiredPlan)) {
      if (!req.user?.id) {
        return res.status(401).json({
          error: '请先登录后使用专业工具',
          code: 'TOOL_LOGIN_REQUIRED',
          toolId: tool.id,
          upgradeUrl: '/pricing',
          creditsUrl: '/points-center',
        });
      }
      try {
        await deductCredits({
          userId: req.user.id,
          amount: tool.creditCost,
          idempotencyKey: `tool:${req.user.id}:${tool.id}:${requestKey}`,
          businessType: 'tool_usage',
          businessId: `${tool.id}:${requestKey}`,
          description: `${tool.label}按次体验`,
          resource: `tool:${tool.id}`,
        });
        chargedToolCredits = tool.creditCost;
      } catch (error) {
        if (error instanceof InsufficientCreditsError) {
          return res.status(402).json({
            error: '积分余额不足',
            code: 'TOOL_CREDITS_REQUIRED',
            toolId: tool.id,
            requiredCredits: tool.creditCost,
            currentPlan: userPlan,
            upgradeUrl: '/pricing',
            creditsUrl: '/points-center',
          });
        }
        throw error;
      }
    }

    const refundToolCredits = async () => {
      if (!chargedToolCredits || !req.user?.id || !tool) return;
      await grantCredits({
        userId: req.user.id,
        amount: chargedToolCredits,
        sourceType: 'refund',
        transactionType: 'refund',
        idempotencyKey: `tool-refund:${req.user.id}:${tool.id}:${requestKey}`,
        businessType: 'tool_usage_refund',
        businessId: `${tool.id}:${requestKey}`,
        description: `${tool.label}生成失败，自动退回积分`,
        resource: `tool:${tool.id}`,
      });
      chargedToolCredits = 0;
    };

    // 发送消息（model/provider 允许前端实时切换模型，直连统一网关）
    let reply: string;
    let usage: any = undefined;
    let usedProvider: string | undefined;
    let usedModel: string | undefined;
    let didFallback = false;
    try {
      const result = await aiAgentService.sendMessage(currentSessionId, message, {
        ...(config || {}),
        systemPrompt: config?.systemPrompt || PLATFORM_SYSTEM_PROMPT,
      }, {
        model: model || undefined,
        provider: provider || undefined,
        tier,
      });
      reply = result.reply;
      usage = result.usage;
      usedProvider = result.provider;
      usedModel = result.model;
    } catch (gwErr) {
      // 兜底：外部 chat provider 未配置/不可用时，走 CloudBase 小程序成长计划免费模型
      // 弃用模型错误直接返回给前端，不静默降级
      const gwMsg = (gwErr as Error)?.message || "";
      if (gwMsg.includes("DEPRECATED_MODEL") || gwMsg.includes("deprecated")) {
        await refundToolCredits();
        return res.status(400).json({ error: gwMsg, code: "DEPRECATED_MODEL" });
      }
      
      logger.warn('ai.chat', `Gateway failed, falling back to CloudBase free model: ${(gwErr as Error)?.message}`);
      const cfMessages = [
        { role: 'system', content: config?.systemPrompt || PLATFORM_SYSTEM_PROMPT },
        { role: 'user', content: message },
      ];
      try {
        reply = await callCloudbaseChat(cfMessages, 'hy3');
        usedProvider = 'cloudbase';
        usedModel = 'hy3';
        didFallback = true;
      } catch (fallbackError) {
        await refundToolCredits();
        throw fallbackError;
      }
    }

    const u = usage || {};
    const promptTokens = Number(u.prompt_tokens) || 0;
    const completionTokens = Number(u.completion_tokens) || 0;
    const totalTokens = Number(u.total_tokens) || promptTokens + completionTokens;
    const costFen = estimateCostFen(promptTokens, completionTokens);

    // 登录用户：累加用量 + 记录 AI 成本（驱动成本预警阀门）
    if (req.user?.id) {
      await quotaIncrement(req.user.id, 'ai_chat');
      await quotaCostRecord(req.user.id, costFen);
    }

    // 只记录模型元数据和 token 数，不记录用户原文/回复，供监控大屏聚合。
    await AIUsageLog.create({
      userId: req.user?.id,
      sessionId: currentSessionId,
      requestId: requestKey,
      resource: 'ai_chat',
      toolId: tool?.id,
      provider: usedProvider || (provider ? String(provider) : 'unknown'),
      modelId: usedModel || (model ? String(model) : 'unknown'),
      promptTokens,
      completionTokens,
      totalTokens,
      creditsDeducted: chargedToolCredits,
      costFen,
      status: didFallback ? 'fallback' : 'success',
      fallback: didFallback,
    }).catch((logError) => logger.warn('ai.chat', `AI 用量日志写入失败: ${(logError as Error)?.message}`));

    res.json({
      success: true,
      sessionId: currentSessionId,
      message: reply,
      usage,
      provider: usedProvider || (usage ? undefined : 'cloudbase-free'),
      model: usedModel,
      toolId: tool?.id,
      creditsCharged: chargedToolCredits
    });

  } catch (error) {
    sendError(res, error);
  }
});

// 提示词优化（免费增值能力，使用平台免费模型，不消耗用户付费配额）
router.post('/prompt-optimize', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { prompt, direction } = req.body as { prompt?: string; direction?: string };
    if (!prompt || !prompt.trim()) {
      return res.status(400).json({ error: 'prompt is required' });
    }
    const meta = buildOptimizeMetaPrompt(prompt.trim(), direction || 'detailed');
    let optimized: string;
    try {
      const result = await route({
        model: getPreferredAgnesTextModel(),
        messages: [{ role: 'user', content: meta }],
        tier: 'free',
        publicOnly: true,
        timeoutMs: 15_000,
        totalTimeoutMs: 30_000,
      });
      optimized = result.reply;
    } catch (agnesErr) {
      logger.warn('ai.prompt-optimize', `Agnes 2.5 failed, fallback CloudBase: ${(agnesErr as Error)?.message}`);
      optimized = await callCloudbaseChat([{ role: 'user', content: meta }], 'hy3');
    }
    res.json({ success: true, optimized });
  } catch (error) {
    sendError(res, error);
  }
});

// 获取可用模型
router.get('/models', (req: Request, res: Response) => {
  // 即使云端误把 NODE_ENV 配成 development，公开生产域名也不能暴露 Mock 模型。
  const forwardedHost = String(req.headers['x-forwarded-host'] || '').split(',')[0].trim();
  const host = forwardedHost || req.hostname || '';
  const publicProductionHost = /(^|\.)aibak\.site$/i.test(host);
  const models = aiModelManager.getAvailableModels().filter((item) => !publicProductionHost || item.provider !== 'Mock AI');
  const providers = aiModelManager.getEnabledProviders()
    .filter((provider) => !publicProductionHost || provider.name !== 'Mock AI')
    .map(p => ({
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
