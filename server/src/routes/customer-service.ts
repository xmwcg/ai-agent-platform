import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { CustomerService, CustomerServiceSession, CustomerServiceAuditLog, buildAuditEntry } from '../models/CustomerService';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { Team, ITeam, ITeamMember } from '../models/Team';
import { embeddingService } from '../services/embedding';
import { aiModelManager } from '../config/ai-models';
import { route } from '../gateway/ai-gateway.service';
import { logger } from '../lib/logger';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { canAccessResource } from '../middleware/resourceAccess';
import { TeamRole } from '../models/Team';
import { sendError } from '../lib/http-error';
import { ICustomerService, ICustomerServiceSession } from '../models/CustomerService';

const router = Router();

function genEmbedCode(): string {
  return crypto.randomBytes(12).toString('hex');
}

/** 转人工判定（纯函数，便于单测）：
 *  - handoffEnabled 为 false 时恒不转人工（合规兜底）
 *  - 显式请求 或 命中通用触发词（人工/转人工/客服热线/联系客服/真人）
 *  - 命中机器人自定义行业触发词（如诊所「胸痛」、律所「起诉」、工厂「起火」）
 */
export function shouldEscalate(
  message: string,
  cs: { handoffEnabled: boolean; escalationTriggers?: string[] },
  explicit = false
): boolean {
  if (!cs.handoffEnabled) return false;
  if (explicit) return true;
  if (/人工|转人工|客服热线|联系客服|真人/.test(message)) return true;
  const triggers = cs.escalationTriggers || [];
  if (triggers.length > 0) {
    const re = new RegExp(
      triggers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
    );
    return re.test(message);
  }
  return false;
}


/** 当前用户在客服资源上的团队角色（owner 直接命中，否则查团队） */
async function resolveCsMemberRole(cs: ICustomerService, userId?: string): Promise<TeamRole | null> {
  if (!userId || !cs.teamId) return null;
  const team = await Team.findById(cs.teamId).lean();
  if (!team) return null;
  const member = (team.members as ITeamMember[]).find((m) => m.userId === userId);
  return (member?.role as TeamRole) || null;
}

/** 我的客服列表（含我所在团队共享的 bot） */
router.get('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const teams = await Team.find({ 'members.userId': req.user!.id }).lean();
    const teamIds = teams.map((t) => String(t._id));
    const list = await CustomerService.find({
      $or: [{ ownerId: req.user!.id }, ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : [])],
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: list });
  } catch (err) {
    sendError(res, err);
  }
});

/** 创建客服（绑定知识库，支持归属团队） */
router.post('/', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      name, description, knowledgeBaseIds, systemPrompt, provider, model,
      welcomeMessage, fallbackMessage, teamId,
    } = req.body;
    if (!name) return res.status(400).json({ success: false, error: '客服名称必填' });

    // 归属团队时校验：必须是该团队成员（>= member）
    if (teamId) {
      const team = await Team.findById(teamId).lean();
      const member = team?.members?.find((m: ITeamMember) => m.userId === req.user!.id);
      if (!member || !canAccessResource({ userId: req.user!.id, memberRole: member.role, minRole: 'member' })) {
        return res.status(403).json({ success: false, error: '你不是该团队成员，无法在此团队下创建客服' });
      }
    }

    const cs = await CustomerService.create({
      name,
      description,
      knowledgeBaseIds: knowledgeBaseIds || [],
      systemPrompt: systemPrompt || undefined,
      provider: provider || aiModelManager.getDefaultProvider()?.name.toLowerCase() || 'openai',
      csModel: model || aiModelManager.getDefaultProvider()?.defaultModel || 'gpt-4o',
      welcomeMessage,
      fallbackMessage,
      ownerId: req.user!.id,
      teamId: teamId || undefined,
      embedCode: genEmbedCode(),
    });
    res.json({ success: true, data: cs });
  } catch (err) {
    sendError(res, err);
  }
});

/** 更新（作者或团队成员 >= member） */
router.put('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权修改该客服' });
    }
    const updated = await CustomerService.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
    res.json({ success: true, data: updated });
  } catch (err) {
    sendError(res, err);
  }
});

/** 删除（作者或团队成员 >= member） */
router.delete('/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权删除该客服' });
    }
    await cs.deleteOne();
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 生成嵌入代码（供用户嵌入自己的网站） */
router.get('/:id/embed-script', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const script = `<!-- AI 智能客服嵌入代码 -->\n<script src="${base}/widget/customer-service.js" data-embed="${cs.embedCode}"></script>`;
    res.json({ success: true, data: { embedCode: cs.embedCode, script } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 检索命中（文档 + 相似度分数），与 embeddingService.searchSimilarDocuments 返回结构一致 */
export type ScoredDoc = {
  document: { _id?: { toString(): string }; id?: string; title?: string; content?: string };
  similarity: number;
};

/** 可追溯来源条目 */
export interface SourceRef {
  docId: string | undefined;
  title: string | undefined;
  confidence: number;
  snippet: string;
}

/** 从检索结果提取可追溯来源（答案引用，差异化亮点：回答可信、可溯源） */
export function extractSources(scoped: ScoredDoc[]): SourceRef[] {
  return scoped.map((r) => ({
    docId: r.document?._id?.toString?.() || r.document?.id,
    title: r.document?.title,
    confidence: Number((r.similarity || 0).toFixed(3)),
    snippet: (r.document?.content || '').substring(0, 150) + (r.document?.content?.length > 150 ? '...' : ''),
  }));
}

/** 公开：访客对话接口（嵌入网站调用，使用 embedCode 而非鉴权） */
router.post('/chat/:embedCode', optionalAuth, enforceQuota('cs_query'), async (req: AuthRequest, res: Response) => {
  try {
    const { message, visitorId, sessionId, escalate } = req.body;
    if (!message) return res.status(400).json({ success: false, error: '消息不能为空' });

    const cs = await CustomerService.findOne({ embedCode: req.params.embedCode, enabled: true });
    if (!cs) return res.status(404).json({ success: false, error: '客服不存在或未启用' });

    // 1. RAG 检索 + 来源提取（可追溯）
    let context = '';
    let sources: SourceRef[] = [];
    if (cs.knowledgeBaseIds.length > 0) {
      const docs = await KnowledgeDocument.find({ _id: { $in: cs.knowledgeBaseIds } });
      if (docs.length > 0) {
        const searchResults = await embeddingService
          .searchSimilarDocuments(message, { limit: 5, minSimilarity: 0.6 })
          .catch(() => [] as ScoredDoc[]);
        const scoped = (searchResults as ScoredDoc[])
          .filter((r) => cs.knowledgeBaseIds.includes(r.document._id!.toString()))
          .slice(0, 5);
        const used: ScoredDoc[] = scoped.length > 0
          ? scoped
          : docs.slice(0, 3).map((d: { _id: { toString(): string }; title: string; content: string }) => ({ document: d, similarity: 1 }));
        sources = extractSources(used);
        context = used
          .map((r, i: number) => `【文档${i + 1}】${r.document.title}\n${r.document.content.substring(0, 800)}`)
          .join('\n\n');
      }
    }

    // 2. 转人工判断（命中通用触发词 / 行业触发词 / 显式请求）
    const escalated = shouldEscalate(message, cs, escalate === true);
    let answer: string;
    if (escalated) {
      answer = cs.handoffPrompt;
    } else {
      // 3. 调用大模型生成回复（RAG 增强，统一走 AI 网关，支持国内/自定义模型）
      const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
      if (mockMode) {
        answer = context
          ? `（Mock）根据知识库内容，关于「${message}」：${sources[0]?.snippet || '请参考相关文档。'}`
          : cs.fallbackMessage;
      } else {
        // csModel 存储完整网关模型串（如 deepseek/deepseek-chat 或 mc_<id>/glm-4）
        const fullModel = cs.csModel.includes('/') ? cs.csModel : `${cs.provider}/${cs.csModel}`;
        const sys = context ? `${cs.systemPrompt}\n\n参考知识库：\n${context}` : cs.systemPrompt;
        try {
          const result = await route({
            model: fullModel,
            messages: [
              { role: 'system', content: sys },
              { role: 'user', content: message },
            ],
            temperature: 0.5,
          });
          answer = result.reply || cs.fallbackMessage;
        } catch (e: any) {
          logger.error('customer-service', `模型调用失败（${fullModel}）：${e?.message ?? e}`);
          answer = cs.fallbackMessage;
        }
      }
    }

    // 4. 记录会话
    let sess = sessionId ? await CustomerServiceSession.findOne({ _id: sessionId }) : null;
    if (!sess) {
      sess = await CustomerServiceSession.create({
        serviceId: cs._id.toString(),
        visitorId: visitorId || `anon_${Date.now()}`,
        messages: [],
      });
    }
    sess.messages.push({ role: 'user', content: message, timestamp: Date.now() });
    sess.messages.push({ role: 'assistant', content: answer, timestamp: Date.now() });
    if (escalated) sess.escalated = true;
    await sess.save();
    await CustomerService.findByIdAndUpdate(cs._id, { $inc: { conversationCount: 1 } });
    if (req.user?.id) await quotaIncrement(req.user.id, 'cs_query');

    // 5. 合规审计日志：每条问答完整留痕（问题/答案/来源/转人工），金融医疗政务刚需
    await CustomerServiceAuditLog.create(
      buildAuditEntry({
        botId: cs._id.toString(),
        botName: cs.name,
        sessionId: sess._id!.toString(),
        userId: req.user?.id,
        visitorId: sess.visitorId,
        question: message,
        answer,
        sources,
        escalated,
      })
    );

    res.json({
      success: true,
      data: {
        reply: answer,
        sessionId: sess._id,
        sources, // 答案出处，可追溯
        escalated, // 是否已转人工
        welcomeMessage: cs.welcomeMessage,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 会话满意度评价 / 备注（客服质量闭环） */
router.post('/chat/:embedCode/feedback', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { sessionId, satisfaction, comment, escalated } = req.body as {
      sessionId?: string;
      satisfaction?: number;
      comment?: string;
      escalated?: boolean;
    };
    if (!sessionId) return res.status(400).json({ success: false, error: 'sessionId 必填' });
    const update: Partial<ICustomerServiceSession> = {};
    if (typeof satisfaction === 'number') update.satisfaction = satisfaction;
    if (typeof comment === 'string') update.comment = comment;
    if (typeof escalated === 'boolean') update.escalated = escalated;
    const sess = await CustomerServiceSession.findOneAndUpdate({ _id: sessionId }, update, { new: true });
    if (!sess) return res.status(404).json({ success: false, error: '会话不存在' });
    // 满意度回填到审计日志（按会话匹配最新一条），形成「问答→评价」完整闭环
    if (typeof satisfaction === 'number') {
      await CustomerServiceAuditLog.findOneAndUpdate(
        { sessionId },
        { $set: { satisfaction } },
        { new: true, sort: { createdAt: -1 } }
      ).catch(() => null);
    }
    res.json({ success: true, data: { satisfaction: sess.satisfaction, comment: sess.comment, escalated: sess.escalated } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 会话历史（后台查看，作者或团队成员 >= member） */
router.get('/:id/sessions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权查看该客服会话' });
    }
    const sessions = await CustomerServiceSession.find({ serviceId: cs._id.toString() })
      .sort({ updatedAt: -1 })
      .limit(50)
      .lean();
    res.json({ success: true, data: sessions });
  } catch (err) {
    sendError(res, err);
  }
});

/** 合规审计日志查询（作者或团队成员 >= member） */
router.get('/:id/audit-logs', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权查看该客服审计日志' });
    }
    const filter: Record<string, unknown> = { botId: cs._id.toString() };
    const { from, to, escalatedOnly, minSatisfaction } = req.query as Record<string, string>;
    if (from || to) {
      const range: Record<string, Date> = {};
      if (from) range.$gte = new Date(from);
      if (to) range.$lte = new Date(to);
      filter.createdAt = range;
    }
    if (escalatedOnly === 'true') filter.escalated = true;
    if (minSatisfaction) filter.satisfaction = { $gte: Number(minSatisfaction) };
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
    const [items, total] = await Promise.all([
      CustomerServiceAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
      CustomerServiceAuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, data: { items, total, page, pageSize } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 合规导出（JSON / CSV）—— 满足审计留痕与监管调取 */
router.get('/:id/audit-logs/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权导出该客服审计日志' });
    }
    const items = (await CustomerServiceAuditLog.find({ botId: cs._id.toString() })
      .sort({ createdAt: -1 })
      .lean()) as Array<Record<string, unknown>>;
    const fmt = String(req.query.format || 'json').toLowerCase();
    if (fmt === 'csv') {
      const header = ['时间', '访客', '问题', '答案', '来源文档', '平均相似度', '是否转人工', '满意度'];
      const rows = items.map((it: any) => [
        it.createdAt,
        it.visitorId,
        it.question,
        it.answer,
        (it.sources || []).map((s: any) => s.title).join(' | '),
        it.similarityAvg,
        it.escalated ? '是' : '否',
        it.satisfaction ?? '',
      ]);
      const csv = [header, ...rows]
        .map((r: unknown[]) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
        .join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="audit-${cs._id}.csv"`);
      return res.status(200).send('﻿' + csv);
    }
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-${cs._id}.json"`);
    return res.status(200).json({ success: true, data: items });
  } catch (err) {
    sendError(res, err);
  }
});

/** 合规统计概览：总量 / 转人工率 / 平均满意度 / 高频来源 */
router.get('/:id/audit-stats', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const cs = await CustomerService.findById(req.params.id);
    if (!cs) return res.status(404).json({ success: false, error: '不存在' });
    const memberRole = await resolveCsMemberRole(cs, req.user!.id);
    if (!canAccessResource({ userId: req.user!.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
      return res.status(403).json({ success: false, error: '无权查看该客服统计' });
    }
    const botId = cs._id.toString();
    const [total, escalated, rated, topSourcesAgg, satAgg] = await Promise.all([
      CustomerServiceAuditLog.countDocuments({ botId }),
      CustomerServiceAuditLog.countDocuments({ botId, escalated: true }),
      CustomerServiceAuditLog.countDocuments({ botId, satisfaction: { $exists: true, $ne: null } }),
      CustomerServiceAuditLog.aggregate([
        { $match: { botId } },
        { $unwind: '$sources' },
        { $group: { _id: '$sources.title', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      CustomerServiceAuditLog.aggregate([
        { $match: { botId, satisfaction: { $exists: true, $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$satisfaction' } } },
      ]),
    ]);
    res.json({
      success: true,
      data: {
        total,
        escalated,
        escalatedRate: total ? Number((escalated / total).toFixed(3)) : 0,
        rated,
        avgSatisfaction: satAgg.length ? Number((satAgg[0] as any).avg.toFixed(2)) : null,
        topSources: (topSourcesAgg as any[]).map((t) => ({ title: t._id, count: t.count })),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
