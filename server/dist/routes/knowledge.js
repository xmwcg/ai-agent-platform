"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const mongoose_1 = require("mongoose");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const Team_1 = require("../models/Team");
const auth_1 = require("../middleware/auth");
const resourceAccess_1 = require("../middleware/resourceAccess");
const kb_access_1 = require("../middleware/kb-access");
const knowledge_categories_1 = require("../config/knowledge-categories");
const http_error_1 = require("../lib/http-error");
const logger_1 = require("../lib/logger");
const encoding_1 = require("../utils/encoding");
const rag_1 = require("../services/rag");
const router = (0, express_1.Router)();
/** 解析当前用户对某文档的访问（owner / 团队成员），用于读写守卫 */
async function resolveDocMemberRole(doc, userId) {
    if (!userId || !doc.teamId)
        return null;
    const team = await Team_1.Team.findById(doc.teamId).lean();
    if (!team)
        return null;
    const member = team.members.find((m) => m.userId === userId);
    return member?.role || null;
}
// 创建知识文档（支持归属团队，团队资源级隔离）
router.post('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const { title, content, tags, categories, isPublic, teamId, categoryTree, price, requiredPlan, creditsCost, freePreviewPages } = req.body;
        if (!title || !content) {
            return res.status(400).json({ error: 'Title and content are required' });
        }
        if (teamId && !/^[a-fA-F0-9]{24}$/.test(teamId)) {
            return res.status(400).json({ error: 'teamId 不是合法的团队 ID' });
        }
        if (!req.user?.id) {
            return res.status(401).json({ error: '请先登录后再创建文档' });
        }
        // 归属团队时校验：必须是该团队成员（>= member）
        if (teamId) {
            const team = await Team_1.Team.findById(teamId).lean();
            const member = team?.members?.find((m) => m.userId === req.user.id);
            if (!member || !(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, memberRole: member.role, minRole: 'member' })) {
                return res.status(403).json({ error: '你不是该团队成员，无法在此团队下创建文档' });
            }
        }
        const doc = new KnowledgeDocument_1.KnowledgeDocument({
            title,
            content,
            tags: tags || [],
            categories: categories || [],
            categoryTree: categoryTree || undefined,
            price: price !== undefined ? price : undefined,
            requiredPlan: requiredPlan || 'free',
            creditsCost: creditsCost !== undefined ? creditsCost : undefined,
            freePreviewPages: freePreviewPages !== undefined ? freePreviewPages : undefined,
            isPublic: isPublic !== undefined ? isPublic : true,
            author: req.user.id,
            teamId: teamId || undefined,
        });
        await doc.save();
        // 新增文档后异步增量嵌入（不阻塞响应；失败仅告警，不影响创建结果）
        const docId = String(doc._id);
        rag_1.ragService.embedNewDocuments().catch((e) => logger_1.logger.warn('rag', `新建文档 ${docId} 后自动增量嵌入失败：${e instanceof Error ? e.message : e}`));
        res.status(201).json({
            success: true,
            data: doc
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取文档列表（支持分页、搜索、过滤）
router.get('/', auth_1.optionalAuth, async (req, res) => {
    try {
        const { page = '1', limit = '10', search, tags, categories, sortBy = 'createdAt', order = 'desc' } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // 构建查询：列表层先做资源隔离，避免私有知识标题/摘要/标签泄露。
        const accessConditions = [{ isPublic: true }];
        if (req.user?.id) {
            const teams = await Team_1.Team.find({
                $or: [{ ownerId: req.user.id }, { 'members.userId': req.user.id }],
            }).select('_id').lean();
            accessConditions.push({ author: req.user.id }, { teamId: { $in: teams.map((team) => team._id) } });
        }
        let query = { $or: accessConditions };
        // 全文搜索
        if (search) {
            query.$text = { $search: search };
        }
        // 标签过滤
        if (tags) {
            const tagArray = tags.split(',').map(t => t.trim());
            query.tags = { $in: tagArray };
        }
        // 分类过滤
        if (categories) {
            const categoryArray = categories.split(',').map(c => c.trim());
            query.categories = { $in: categoryArray };
        }
        // 业务分类树过滤（知识库 v2 固定业务分类）
        if (req.query.categoryTree) {
            const treeArray = req.query.categoryTree.split(',').map(c => c.trim());
            query.categoryTree = { $in: treeArray };
        }
        // 排序
        const sort = {};
        sort[sortBy] = order === 'asc' ? 1 : -1;
        // 执行查询
        const [docs, total] = await Promise.all([
            KnowledgeDocument_1.KnowledgeDocument.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .populate('author', 'username')
                .select('-embedding -htmlContent'), // 不返回向量和 HTML
            KnowledgeDocument_1.KnowledgeDocument.countDocuments(query)
        ]);
        // 附加访问级别标签（供前端展示 免费/专享/付费/积分 徽章）
        const enriched = docs.map((d) => {
            const obj = d.toObject ? d.toObject() : d;
            obj.access = (0, kb_access_1.resolveKbAccess)(obj, req.user).level;
            return obj;
        });
        res.json({
            success: true,
            data: enriched.map((r) => (0, encoding_1.fixDocEncoding)(r)),
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 显式解锁付费/积分文档（POST，避免 GET 副作用歧义，客户端点"解锁"按钮走此路由）
router.post('/:id/unlock', auth_1.requireAuth, async (req, res) => {
    try {
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: '文档不存在' });
        }
        const doc = await KnowledgeDocument_1.KnowledgeDocument.findById(req.params.id);
        if (!doc)
            return res.status(404).json({ error: '文档不存在' });
        if (!doc.isPublic) {
            const memberRole = await resolveDocMemberRole(doc, req.user?.id);
            const allowed = (0, resourceAccess_1.canAccessResource)({ userId: req.user?.id, author: doc.author, memberRole, minRole: 'viewer' });
            if (!allowed)
                return res.status(403).json({ error: '无权访问该文档' });
        }
        const verdict = (0, kb_access_1.resolveKbAccess)(doc, req.user);
        const { content, deducted } = await (0, kb_access_1.applyKbAccess)(doc, req.user, verdict);
        if (verdict.level !== 'full') {
            return res.status(402).json({
                success: false, error: verdict.level === 'plan_locked' ? '需要升级会员' : '积分不足',
                access: verdict.level,
            });
        }
        res.json({ success: true, data: { _id: doc._id, title: doc.title, content, htmlContent: doc.htmlContent, access: 'full', creditsDeducted: deducted } });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取单个文档详情（私有文档需鉴权；知识库 v2 接入会员/付费/试看/积分权限）
router.get('/:id', auth_1.optionalAuth, async (req, res) => {
    try {
        // 非法 id（非 ObjectId，如探针误打的 /health）直接 404，避免 Mongoose 转换抛 500
        if (!mongoose_1.Types.ObjectId.isValid(req.params.id)) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const doc = await KnowledgeDocument_1.KnowledgeDocument.findById(req.params.id)
            .populate('author', 'username')
            .populate('relatedDocs', 'title');
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        // 私有文档：校验当前用户访问权限（团队/作者）
        if (!doc.isPublic) {
            const memberRole = await resolveDocMemberRole(doc, req.user?.id);
            const allowed = (0, resourceAccess_1.canAccessResource)({
                userId: req.user?.id,
                author: doc.author,
                memberRole,
                minRole: 'viewer',
            });
            if (!allowed) {
                return res.status(403).json({ error: '无权访问该私有文档' });
            }
        }
        // 知识库 v2：会员 / 付费 / 试看 / 积分 权限判定
        const verdict = (0, kb_access_1.resolveKbAccess)(doc, req.user);
        const { content, deducted } = await (0, kb_access_1.applyKbAccess)(doc, req.user, verdict);
        // 增加浏览次数（仅已可见时计数）
        doc.viewCount += 1;
        await doc.save();
        // 构造下发对象：默认不含全文，按需附加
        const out = {
            _id: doc._id,
            title: doc.title,
            summary: doc.summary,
            tags: doc.tags,
            categories: doc.categories,
            categoryTree: doc.categoryTree,
            isPublic: doc.isPublic,
            requiredPlan: doc.requiredPlan,
            price: doc.price,
            creditsCost: doc.creditsCost,
            freePreviewPages: doc.freePreviewPages,
            viewCount: doc.viewCount,
            likeCount: doc.likeCount,
            author: doc.author,
            relatedDocs: doc.relatedDocs,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
            access: verdict.level,
        };
        if (verdict.level === 'full') {
            out.content = content;
            out.htmlContent = doc.htmlContent;
            if (deducted)
                out.creditsDeducted = deducted;
        }
        else if (verdict.level === 'preview' || verdict.level === 'credit_locked') {
            out.previewContent = content;
            if (verdict.level === 'credit_locked') {
                out.creditsNeeded = verdict.creditsNeeded;
                out.creditsHave = verdict.creditsHave;
            }
        }
        else if (verdict.level === 'plan_locked') {
            out.requiredPlan = verdict.requiredPlan;
        }
        res.json({ success: true, data: (0, encoding_1.fixDocEncoding)(out) });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 更新文档（作者或团队成员 >= member）
router.put('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const { title, content, tags, categories, isPublic } = req.body;
        const doc = await KnowledgeDocument_1.KnowledgeDocument.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const memberRole = await resolveDocMemberRole(doc, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, author: doc.author, memberRole, minRole: 'member' })) {
            return res.status(403).json({ error: '无权编辑该文档' });
        }
        // 更新字段
        if (title !== undefined)
            doc.title = title;
        if (content !== undefined)
            doc.content = content;
        if (tags !== undefined)
            doc.tags = tags;
        if (categories !== undefined)
            doc.categories = categories;
        if (isPublic !== undefined)
            doc.isPublic = isPublic;
        await doc.save();
        res.json({
            success: true,
            data: doc
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 删除文档（作者或团队成员 >= member）
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const doc = await KnowledgeDocument_1.KnowledgeDocument.findById(req.params.id);
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }
        const memberRole = await resolveDocMemberRole(doc, req.user.id);
        if (!(0, resourceAccess_1.canAccessResource)({ userId: req.user.id, author: doc.author, memberRole, minRole: 'member' })) {
            return res.status(403).json({ error: '无权删除该文档' });
        }
        await doc.deleteOne();
        res.json({
            success: true,
            message: 'Document deleted successfully'
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取所有标签和分类（用于过滤）
router.get('/meta/tags-and-categories', async (req, res) => {
    try {
        const [tags, categories] = await Promise.all([
            KnowledgeDocument_1.KnowledgeDocument.distinct('tags'),
            KnowledgeDocument_1.KnowledgeDocument.distinct('categories')
        ]);
        res.json({
            success: true,
            data: {
                tags: tags.filter(t => t), // 过滤空值
                categories: categories.filter(c => c)
            }
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 知识库 v2：固定业务分类树（参考飞书/乐享/IMA 设计）
router.get('/meta/category-tree', (_req, res) => {
    res.json({ success: true, data: knowledge_categories_1.KNOWLEDGE_CATEGORY_TREE });
});
exports.default = router;
//# sourceMappingURL=knowledge.js.map