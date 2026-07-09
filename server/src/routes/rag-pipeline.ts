/**
 * RAG Pipeline 路由
 * 提供文档上传 → 自动解析 → 智能分块 → 向量化的一站式 API
 */

import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ragPipelineService } from '../services/rag-pipeline.service';
import { ragService } from '../services/rag';
import { embeddingService } from '../services/embedding';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import { logger } from '../lib/logger';

const router = Router();

// ── Multer 配置 ────────────────────────────────────────

const uploadDir = path.join(process.cwd(), 'uploads', 'rag');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9\u4e00-\u9fff\-_.]/g, '_');
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${safeName}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedExts = ['.pdf', '.docx', '.doc', '.md', '.txt', '.html', '.htm'];
  const ext = path.extname(file.originalname).toLowerCase();
  if (allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported format: ${ext}. Supported: ${allowedExts.join(', ')}`));
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
});

// ── 校验 Schema ─────────────────────────────────────────

const ingestUrlSchema: ValidationSchema = {
  url: { required: true, type: 'string' },
};

const batchEmbedSchema: ValidationSchema = {
  documentIds: { required: true, type: 'stringArray', minLength: 1 },
};

// ── 路由 ───────────────────────────────────────────────

/**
 * POST /api/rag/pipeline/upload
 * 上传文档 → 自动解析 → 分块 → 向量化 → 存入知识库
 * 对标 Dify 的一键文档导入
 */
router.post(
  '/pipeline/upload',
  requireAuth, enforceQuota('rag_upload'),
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { tags, categories, isPublic: isPublicStr, teamId } = req.body;
      const isPublic = isPublicStr === 'true' || isPublicStr === undefined;

      const result = await ragPipelineService.ingestFile(
        req.file.path,
        req.file.originalname,
        {
          userId: req.user?.id || 'anonymous',
          tags: tags ? (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : tags) : undefined,
          categories: categories ? (typeof categories === 'string' ? categories.split(',').map((c: string) => c.trim()) : categories) : undefined,
          isPublic,
          teamId,
        }
      );

      // 更新配额
      if (req.user?.id) await quotaIncrement(req.user.id, 'rag_upload');

      // 清理上传的临时文件
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }

      res.json({
        success: result.errors.length === 0,
        file: {
          name: result.originalName,
          format: result.format,
        },
        pipeline: {
          chunks: result.chunks,
          documentsCreated: result.documentsCreated.length,
          documentIds: result.documentsCreated,
        },
        timing: {
          parseMs: result.parseTime,
          embedMs: result.embedTime,
          totalMs: result.totalTime,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      // 清理上传文件
      if (req.file) {
        try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
      }
      sendError(res, error);
    }
  }
);

/**
 * POST /api/rag/pipeline/upload-batch
 * 批量上传多个文档
 */
router.post(
  '/pipeline/upload-batch',
  requireAuth, enforceQuota('rag_upload'),
  upload.array('files', 10),
  async (req: AuthRequest, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        return res.status(400).json({ error: 'No files uploaded' });
      }

      const { tags, categories, isPublic: isPublicStr, teamId } = req.body;
      const isPublic = isPublicStr === 'true' || isPublicStr === undefined;

      const results = [];
      for (const file of files) {
        try {
          const result = await ragPipelineService.ingestFile(
            file.path,
            file.originalname,
            {
              userId: req.user?.id || 'anonymous',
              tags: tags
                ? (typeof tags === 'string' ? tags.split(',').map((t: string) => t.trim()) : tags)
                : undefined,
              categories: categories
                ? (typeof categories === 'string' ? categories.split(',').map((c: string) => c.trim()) : categories)
                : undefined,
              isPublic,
              teamId,
            }
          );
          results.push(result);
          try { fs.unlinkSync(file.path); } catch { /* ignore */ }
        } catch (err) {
          results.push({
            originalName: file.originalname,
            format: path.extname(file.originalname).replace('.', ''),
            chunks: 0,
            documentsCreated: [],
            errors: [err instanceof Error ? err.message : String(err)],
            parseTime: 0,
            embedTime: 0,
            totalTime: 0,
          });
        }
      }

      if (req.user?.id) await quotaIncrement(req.user.id, 'rag_upload');

      const totalDocs = results.reduce((sum, r) => sum + r.documentsCreated.length, 0);
      const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

      res.json({
        success: totalErrors === 0,
        files: results.length,
        totalDocumentsCreated: totalDocs,
        totalErrors,
        results: results.map(r => ({
          file: r.originalName,
          format: r.format,
          chunks: r.chunks,
          docsCreated: r.documentsCreated.length,
          errors: r.errors.length > 0 ? r.errors : undefined,
        })),
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * POST /api/rag/pipeline/ingest-url
 * 从 URL 导入网页内容
 */
router.post(
  '/pipeline/ingest-url',
  requireAuth, enforceQuota('rag_upload'),
  validate(ingestUrlSchema),
  async (req: AuthRequest, res: Response) => {
    try {
      const { url, tags, categories, isPublic, teamId } = req.body;

      const result = await ragPipelineService.ingestFromUrl(url, {
        userId: req.user?.id || 'anonymous',
        tags: tags || [],
        categories: categories || [],
        isPublic: isPublic ?? true,
        teamId,
      });

      if (req.user?.id) await quotaIncrement(req.user.id, 'rag_upload');

      res.json({
        success: result.errors.length === 0,
        url,
        pipeline: {
          chunks: result.chunks,
          documentsCreated: result.documentsCreated.length,
          documentIds: result.documentsCreated,
        },
        timing: {
          parseMs: result.parseTime,
          embedMs: result.embedTime,
          totalMs: result.totalTime,
        },
        errors: result.errors.length > 0 ? result.errors : undefined,
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

/**
 * GET /api/rag/pipeline/formats
 * 返回支持的文档格式列表
 */
router.get('/pipeline/formats', (_req, res: Response) => {
  res.json({
    success: true,
    formats: ragPipelineService.getSupportedFormats(),
  });
});

/**
 * POST /api/rag/pipeline/re-embed
 * 重新为知识库中未嵌入的文档生成向量（可选指定文档 ID 列表）
 */
router.post(
  '/pipeline/re-embed',
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentIds } = req.body;

      let query: any = { embedding: { $exists: false } };
      if (documentIds && Array.isArray(documentIds)) {
        query = { _id: { $in: documentIds } };
      }

      const docs = await KnowledgeDocument.find(query);

      let success = 0;
      let failed = 0;
      const errors: string[] = [];

      for (const doc of docs) {
        try {
          await embeddingService.embedDocument(String(doc._id));
          success++;
        } catch (err) {
          failed++;
          errors.push(`${doc._id}: ${err instanceof Error ? err.message : err}`);
        }
      }

      res.json({
        success: true,
        total: docs.length,
        embedded: success,
        failed,
        errors: errors.length > 0 ? errors.slice(0, 10) : undefined, // 最多返回前十个错误
      });
    } catch (error) {
      sendError(res, error);
    }
  }
);

export default router;
