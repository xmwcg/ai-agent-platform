import { Router, Request, Response } from 'express';
import { ragService } from '../services/rag';
import { embeddingService } from '../services/embedding';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { optionalAuth, requireAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';

const router = Router();

// 批量嵌入输入校验（documentIds 必须为字符串数组）
const batchEmbedSchema: ValidationSchema = {
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
router.post('/chat', optionalAuth, enforceQuota('rag_query'), async (req: AuthRequest, res: Response) => {
  try {
    const { question, sessionId, userId = 'default-user' } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const result = await ragService.ragChat(sessionId, question, userId);
    if (req.user?.id) await quotaIncrement(req.user.id, 'rag_query');

    res.json({
      success: true,
      sessionId: result.sessionId,
      answer: result.answer,
      sources: result.sources
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 为文档生成嵌入向量（需登录）
router.post('/embed/document/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    await embeddingService.embedDocument(id);

    res.json({
      success: true,
      message: `Document ${id} embedded successfully`
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 批量嵌入文档（需登录）
router.post('/embed/documents', requireAuth, validate(batchEmbedSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { documentIds } = req.body;

    const result = await embeddingService.embedDocuments(documentIds);

    res.json({
      success: true,
      embedded: result.success,
      failed: result.failed
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 嵌入整个知识库（需登录）
router.post('/embed/knowledge-base', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const result = await ragService.embedKnowledgeBase();

    res.json({
      success: true,
      embedded: result.success,
      failed: result.failed,
      message: `Embedded ${result.success} documents, ${result.failed} failed`
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 搜索相似文档
router.post('/search', optionalAuth, enforceQuota('rag_query'), async (req: AuthRequest, res: Response) => {
  try {
    const { query, limit = 5, minSimilarity = 0.7 } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const results = await embeddingService.searchSimilarDocuments(query, {
      limit,
      minSimilarity
    });
    if (req.user?.id) await quotaIncrement(req.user.id, 'rag_query');

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
  } catch (error) {
    sendError(res, error);
  }
});

// 获取 RAG 状态（统计信息，需登录）
router.get('/status', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const [totalDocs, embeddedDocs] = await Promise.all([
      KnowledgeDocument.countDocuments(),
      KnowledgeDocument.countDocuments({ embedding: { $exists: true, $ne: [] } })
    ]);

    res.json({
      success: true,
      statistics: {
        totalDocuments: totalDocs,
        embeddedDocuments: embeddedDocs,
        embeddingProgress: totalDocs > 0 ? (embeddedDocs / totalDocs * 100).toFixed(2) + '%' : '0%'
      }
    });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
