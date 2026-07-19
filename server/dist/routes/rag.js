"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const rag_1 = require("../services/rag");
const embedding_1 = require("../services/embedding");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const http_error_1 = require("../lib/http-error");
const validation_1 = require("../lib/validation");
const router = (0, express_1.Router)();
// 批量嵌入输入校验（documentIds 必须为字符串数组）
const batchEmbedSchema = {
    documentIds: { required: true, type: 'stringArray', minLength: 1 },
};
// RAG 对话接口
router.get("/", (_req, res) => {
    res.json({
        success: true,
        data: {
            capabilities: [
                { type: "chat", label: "知识对话", path: "/api/rag/chat", method: "POST", desc: "基于知识库进行RAG对话" },
                { type: "search", label: "知识搜索", path: "/api/rag/search", method: "POST", desc: "向量搜索知识内容" },
                { type: "status", label: "索引状态", path: "/api/rag/status", desc: "查看RAG系统状态" },
            ],
        },
    });
});
router.post('/chat', auth_1.optionalAuth, (0, subscription_1.enforceQuota)('rag_query'), async (req, res) => {
    try {
        const { question, sessionId, userId = 'default-user' } = req.body;
        if (!question) {
            return res.status(400).json({ error: 'Question is required' });
        }
        const result = await rag_1.ragService.ragChat(sessionId, question, userId);
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_query');
        res.json({
            success: true,
            sessionId: result.sessionId,
            answer: result.answer,
            sources: result.sources
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 为文档生成嵌入向量（需登录）
router.post('/embed/document/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        await embedding_1.embeddingService.embedDocument(id);
        res.json({
            success: true,
            message: `Document ${id} embedded successfully`
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 批量嵌入文档（需登录）
router.post('/embed/documents', auth_1.requireAuth, (0, validation_1.validate)(batchEmbedSchema), async (req, res) => {
    try {
        const { documentIds } = req.body;
        const result = await embedding_1.embeddingService.embedDocuments(documentIds);
        res.json({
            success: true,
            embedded: result.success,
            failed: result.failed
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 嵌入整个知识库（需登录）
router.post('/embed/knowledge-base', auth_1.requireAuth, async (req, res) => {
    try {
        const result = await rag_1.ragService.embedKnowledgeBase();
        res.json({
            success: true,
            embedded: result.success,
            failed: result.failed,
            message: `Embedded ${result.success} documents, ${result.failed} failed`
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 搜索相似文档
router.post('/search', auth_1.optionalAuth, (0, subscription_1.enforceQuota)('rag_query'), async (req, res) => {
    try {
        const { query, limit = 5, minSimilarity = 0.7 } = req.body;
        if (!query) {
            return res.status(400).json({ error: 'Query is required' });
        }
        const results = await embedding_1.embeddingService.searchSimilarDocuments(query, {
            limit,
            minSimilarity
        });
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_query');
        res.json({
            success: true,
            query,
            results: results.map(r => ({
                id: r.document._id,
                title: r.document.title,
                similarity: r.similarity,
                snippet: r.document.content.substring(0, 200) + '...'
            }))
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
// 获取 RAG 状态（统计信息，需登录）
router.get('/status', auth_1.requireAuth, async (req, res) => {
    try {
        const [totalDocs, embeddedDocs] = await Promise.all([
            KnowledgeDocument_1.KnowledgeDocument.countDocuments(),
            KnowledgeDocument_1.KnowledgeDocument.countDocuments({ embedding: { $exists: true, $ne: [] } })
        ]);
        res.json({
            success: true,
            statistics: {
                totalDocuments: totalDocs,
                embeddedDocuments: embeddedDocs,
                embeddingProgress: totalDocs > 0 ? (embeddedDocs / totalDocs * 100).toFixed(2) + '%' : '0%'
            }
        });
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=rag.js.map