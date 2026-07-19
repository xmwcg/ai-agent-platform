"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCustomerServiceMockModeEnabled = isCustomerServiceMockModeEnabled;
exports.shouldEscalate = shouldEscalate;
exports.extractSources = extractSources;
const express_1 = require("express");
const crypto_1 = __importDefault(require("crypto"));
const CustomerService_1 = require("../models/CustomerService");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const Team_1 = require("../models/Team");
const embedding_1 = require("../services/embedding");
const ai_models_1 = require("../config/ai-models");
const ai_gateway_service_1 = require("../gateway/ai-gateway.service");
const logger_1 = require("../lib/logger");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const resourceAccess_1 = require("../middleware/resourceAccess");
const http_error_1 = require("../lib/http-error");
const router = (0, express_1.Router)();
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
function isCustomerServiceMockModeEnabled() {
    return !isProduction() && process.env.ENABLE_MOCK_MODE === 'true';
}
function genEmbedCode() {
    return crypto_1.default.randomBytes(12).toString('hex');
}
/** 转人工判定（纯函数，便于单测）：
 *  - handoffEnabled 为 false 时恒不转人工（合规兜底）
 *  - 显式请求 或 命中通用触发词（人工/转人工/客服热线/联系客服/真人）
 *  - 命中机器人自定义行业触发词（如诊所「胸痛」、律所「起诉」、工厂「起火」）
 */
function shouldEscalate(message, cs, explicit = false) {
    if (!cs.handoffEnabled)
        return false;
    if (explicit)
        return true;
    if (/人工|转人工|客服热线|联系客服|真人/.test(message))
        return true;
    const triggers = cs.escalationTriggers || [];
    if (triggers.length > 0) {
        const re = new RegExp(triggers.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'));
        return re.test(message);
    }
    return false;
}
/** 当前用户在客服资源上的团队角色（owner 直接命中，否则查团队） */
async function resolveCsMemberRole(cs, userId) {
    if (!userId || !cs.teamId)
        return null;
    const team = await Team_1.Team.findById(cs.teamId).lean();
    if (!team)
        return null;
    const member = team.members.find((m) => m.userId === userId);
    return member?.role || null;
}
/** 我的客服列表（含我所在团队共享的 bot） */
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        const teams = await Team_1.Team.find({ 'members.userId': req.user.id }).lean();
        const teamIds = teams.map((t) => String(t._id));
        const list = await CustomerService_1.CustomerService.find({
            $or: [{ ownerId: req.user.id }, ...(teamIds.length ? [{ teamId: { $in: teamIds } }] : [])],
        })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: list });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 创建客服（绑定知识库，支持归属团队） */
router.post('/', auth_1.requireAuth, async (req, res) => {
    try {
        const { name, description, knowledgeBaseIds, systemPrompt, provider, model, welcomeMessage, fallbackMessage, teamId, } = req.body;
        if (!name)
            return res.status(400).json({ success: false, error: '客服名称必填' });
        // 归属团队时校验：必须是该团队成员（>= member）
        if (teamId) {
            const team = await Team_1.Team.findById(teamId).lean();
            const member = team?.members?.find((m) => m.userId === req.user.id);
            if (!member || !(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, memberRole: member.role, minRole: 'member' })) {
                return res.status(403).json({ success: false, error: '你不是该团队成员，无法在此团队下创建客服' });
            }
        }
        const cs = await CustomerService_1.CustomerService.create({
            name,
            description,
            knowledgeBaseIds: knowledgeBaseIds || [],
            systemPrompt: systemPrompt || undefined,
            provider: provider || ai_models_1.aiModelManager.getDefaultProvider()?.name.toLowerCase() || 'openai',
            csModel: model || ai_models_1.aiModelManager.getDefaultProvider()?.defaultModel || 'gpt-4o',
            welcomeMessage,
            fallbackMessage,
            ownerId: req.user.id,
            teamId: teamId || undefined,
            embedCode: genEmbedCode(),
        });
        res.json({ success: true, data: cs });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 更新（作者或团队成员 >= member） */
router.put('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权修改该客服' });
        }
        const updated = await CustomerService_1.CustomerService.findOneAndUpdate({ _id: req.params.id }, req.body, { new: true });
        res.json({ success: true, data: updated });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 删除（作者或团队成员 >= member） */
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权删除该客服' });
        }
        await cs.deleteOne();
        res.json({ success: true });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 生成嵌入代码（供用户嵌入自己的网站） */
router.get('/:id/embed-script', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findOne({ _id: req.params.id, ownerId: req.user.id });
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const base = process.env.PUBLIC_BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const script = `<!-- AI 智能客服嵌入代码 -->\n<script src="${base}/widget/customer-service.js" data-embed="${cs.embedCode}"></script>`;
        res.json({ success: true, data: { embedCode: cs.embedCode, script } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 从检索结果提取可追溯来源（答案引用，差异化亮点：回答可信、可溯源） */
function extractSources(scoped) {
    return scoped.map((r) => ({
        docId: r.document?._id?.toString?.() || r.document?.id,
        title: r.document?.title,
        confidence: Number((r.similarity || 0).toFixed(3)),
        snippet: (r.document?.content || '').substring(0, 150) + (r.document?.content?.length > 150 ? '...' : ''),
    }));
}
/** 公开：访客对话接口（嵌入网站调用，使用 embedCode 而非鉴权） */
router.post('/chat/:embedCode', auth_1.optionalAuth, (0, subscription_1.enforceQuota)('cs_query'), async (req, res) => {
    try {
        const { message, visitorId, sessionId, escalate } = req.body;
        if (!message)
            return res.status(400).json({ success: false, error: '消息不能为空' });
        const cs = await CustomerService_1.CustomerService.findOne({ embedCode: req.params.embedCode, enabled: true });
        if (!cs)
            return res.status(404).json({ success: false, error: '客服不存在或未启用' });
        // 1. RAG 检索 + 来源提取（可追溯）
        let context = '';
        let sources = [];
        if (cs.knowledgeBaseIds.length > 0) {
            const docs = await KnowledgeDocument_1.KnowledgeDocument.find({ _id: { $in: cs.knowledgeBaseIds } });
            if (docs.length > 0) {
                const searchResults = await embedding_1.embeddingService
                    .searchSimilarDocuments(message, { limit: 5, minSimilarity: 0.6 })
                    .catch(() => []);
                const scoped = searchResults
                    .filter((r) => cs.knowledgeBaseIds.includes(r.document._id.toString()))
                    .slice(0, 5);
                const used = scoped.length > 0
                    ? scoped
                    : docs.slice(0, 3).map((d) => ({ document: d, similarity: 1 }));
                sources = extractSources(used);
                context = used
                    .map((r, i) => `【文档${i + 1}】${r.document.title}\n${r.document.content.substring(0, 800)}`)
                    .join('\n\n');
            }
        }
        // 2. 转人工判断（命中通用触发词 / 行业触发词 / 显式请求）
        const escalated = shouldEscalate(message, cs, escalate === true);
        let answer;
        if (escalated) {
            answer = cs.handoffPrompt;
        }
        else {
            // 3. 调用大模型生成回复（RAG 增强，统一走 AI 网关，支持国内/自定义模型）
            const mockMode = isCustomerServiceMockModeEnabled();
            if (mockMode) {
                answer = context
                    ? `（Mock）根据知识库内容，关于「${message}」：${sources[0]?.snippet || '请参考相关文档。'}`
                    : cs.fallbackMessage;
            }
            else {
                // csModel 存储完整网关模型串（如 deepseek/deepseek-chat 或 mc_<id>/glm-4）
                const fullModel = cs.csModel.includes('/') ? cs.csModel : `${cs.provider}/${cs.csModel}`;
                const sys = context ? `${cs.systemPrompt}\n\n参考知识库：\n${context}` : cs.systemPrompt;
                try {
                    const result = await (0, ai_gateway_service_1.route)({
                        model: fullModel,
                        messages: [
                            { role: 'system', content: sys },
                            { role: 'user', content: message },
                        ],
                        temperature: 0.5,
                    });
                    const reply = result.reply?.trim();
                    if (!reply) {
                        throw new Error('AI Provider returned an empty reply');
                    }
                    answer = reply;
                }
                catch (e) {
                    logger_1.logger.error('customer-service', `模型调用失败（${fullModel}）：${e?.message ?? e}`);
                    if (isProduction()) {
                        throw new http_error_1.AppError(503, '智能客服暂时不可用，请稍后重试或转人工客服', 'CUSTOMER_SERVICE_AI_UNAVAILABLE', e instanceof Error ? e.message : String(e));
                    }
                    answer = cs.fallbackMessage;
                }
            }
        }
        // 4. 记录会话
        let sess = sessionId ? await CustomerService_1.CustomerServiceSession.findOne({ _id: sessionId }) : null;
        if (!sess) {
            sess = await CustomerService_1.CustomerServiceSession.create({
                serviceId: cs._id.toString(),
                visitorId: visitorId || `anon_${Date.now()}`,
                messages: [],
            });
        }
        sess.messages.push({ role: 'user', content: message, timestamp: Date.now() });
        sess.messages.push({ role: 'assistant', content: answer, timestamp: Date.now() });
        if (escalated)
            sess.escalated = true;
        await sess.save();
        await CustomerService_1.CustomerService.findByIdAndUpdate(cs._id, { $inc: { conversationCount: 1 } });
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'cs_query');
        // 5. 合规审计日志：每条问答完整留痕（问题/答案/来源/转人工），金融医疗政务刚需
        await CustomerService_1.CustomerServiceAuditLog.create((0, CustomerService_1.buildAuditEntry)({
            botId: cs._id.toString(),
            botName: cs.name,
            sessionId: sess._id.toString(),
            userId: req.user?.id,
            visitorId: sess.visitorId,
            question: message,
            answer,
            sources,
            escalated,
        }));
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
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 会话满意度评价 / 备注（客服质量闭环） */
router.post('/chat/:embedCode/feedback', auth_1.optionalAuth, async (req, res) => {
    try {
        const { sessionId, satisfaction, comment, escalated } = req.body;
        if (!sessionId)
            return res.status(400).json({ success: false, error: 'sessionId 必填' });
        const update = {};
        if (typeof satisfaction === 'number')
            update.satisfaction = satisfaction;
        if (typeof comment === 'string')
            update.comment = comment;
        if (typeof escalated === 'boolean')
            update.escalated = escalated;
        const sess = await CustomerService_1.CustomerServiceSession.findOneAndUpdate({ _id: sessionId }, update, { new: true });
        if (!sess)
            return res.status(404).json({ success: false, error: '会话不存在' });
        // 满意度回填到审计日志（按会话匹配最新一条），形成「问答→评价」完整闭环
        if (typeof satisfaction === 'number') {
            await CustomerService_1.CustomerServiceAuditLog.findOneAndUpdate({ sessionId }, { $set: { satisfaction } }, { new: true, sort: { createdAt: -1 } }).catch(() => null);
        }
        res.json({ success: true, data: { satisfaction: sess.satisfaction, comment: sess.comment, escalated: sess.escalated } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 会话历史（后台查看，作者或团队成员 >= member） */
router.get('/:id/sessions', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权查看该客服会话' });
        }
        const sessions = await CustomerService_1.CustomerServiceSession.find({ serviceId: cs._id.toString() })
            .sort({ updatedAt: -1 })
            .limit(50)
            .lean();
        res.json({ success: true, data: sessions });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 合规审计日志查询（作者或团队成员 >= member） */
router.get('/:id/audit-logs', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权查看该客服审计日志' });
        }
        const filter = { botId: cs._id.toString() };
        const { from, to, escalatedOnly, minSatisfaction } = req.query;
        if (from || to) {
            const range = {};
            if (from)
                range.$gte = new Date(from);
            if (to)
                range.$lte = new Date(to);
            filter.createdAt = range;
        }
        if (escalatedOnly === 'true')
            filter.escalated = true;
        if (minSatisfaction)
            filter.satisfaction = { $gte: Number(minSatisfaction) };
        const page = Math.max(1, Number(req.query.page) || 1);
        const pageSize = Math.min(200, Number(req.query.pageSize) || 50);
        const [items, total] = await Promise.all([
            CustomerService_1.CustomerServiceAuditLog.find(filter).sort({ createdAt: -1 }).skip((page - 1) * pageSize).limit(pageSize).lean(),
            CustomerService_1.CustomerServiceAuditLog.countDocuments(filter),
        ]);
        res.json({ success: true, data: { items, total, page, pageSize } });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 合规导出（JSON / CSV）—— 满足审计留痕与监管调取 */
router.get('/:id/audit-logs/export', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权导出该客服审计日志' });
        }
        const items = (await CustomerService_1.CustomerServiceAuditLog.find({ botId: cs._id.toString() })
            .sort({ createdAt: -1 })
            .lean());
        const fmt = String(req.query.format || 'json').toLowerCase();
        if (fmt === 'csv') {
            const header = ['时间', '访客', '问题', '答案', '来源文档', '平均相似度', '是否转人工', '满意度'];
            const rows = items.map((it) => [
                it.createdAt,
                it.visitorId,
                it.question,
                it.answer,
                (it.sources || []).map((s) => s.title).join(' | '),
                it.similarityAvg,
                it.escalated ? '是' : '否',
                it.satisfaction ?? '',
            ]);
            const csv = [header, ...rows]
                .map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(','))
                .join('\n');
            res.setHeader('Content-Type', 'text/csv; charset=utf-8');
            res.setHeader('Content-Disposition', `attachment; filename="audit-${cs._id}.csv"`);
            return res.status(200).send('﻿' + csv);
        }
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="audit-${cs._id}.json"`);
        return res.status(200).json({ success: true, data: items });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 合规统计概览：总量 / 转人工率 / 平均满意度 / 高频来源 */
router.get('/:id/audit-stats', auth_1.requireAuth, async (req, res) => {
    try {
        const cs = await CustomerService_1.CustomerService.findById(req.params.id);
        if (!cs)
            return res.status(404).json({ success: false, error: '不存在' });
        const memberRole = await resolveCsMemberRole(cs, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, ownerId: cs.ownerId, memberRole, minRole: 'member' })) {
            return res.status(403).json({ success: false, error: '无权查看该客服统计' });
        }
        const botId = cs._id.toString();
        const [total, escalated, rated, topSourcesAgg, satAgg] = await Promise.all([
            CustomerService_1.CustomerServiceAuditLog.countDocuments({ botId }),
            CustomerService_1.CustomerServiceAuditLog.countDocuments({ botId, escalated: true }),
            CustomerService_1.CustomerServiceAuditLog.countDocuments({ botId, satisfaction: { $exists: true, $ne: null } }),
            CustomerService_1.CustomerServiceAuditLog.aggregate([
                { $match: { botId } },
                { $unwind: '$sources' },
                { $group: { _id: '$sources.title', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),
            CustomerService_1.CustomerServiceAuditLog.aggregate([
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
                avgSatisfaction: satAgg.length ? Number(satAgg[0].avg.toFixed(2)) : null,
                topSources: topSourcesAgg.map((t) => ({ title: t._id, count: t.count })),
            },
        });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
exports.default = router;
//# sourceMappingURL=customer-service.js.map