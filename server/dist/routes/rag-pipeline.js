"use strict";
/**
 * RAG Pipeline 路由
 * 提供文档上传 → 自动解析 → 智能分块 → 向量化的一站式 API
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const upload_limit_1 = require("../middleware/upload-limit");
const rag_pipeline_service_1 = require("../services/rag-pipeline.service");
const embedding_1 = require("../services/embedding");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const http_error_1 = require("../lib/http-error");
const validation_1 = require("../lib/validation");
const router = (0, express_1.Router)();
// ── 上传限制（统一中间件，集中文件大小/类型/数量护栏，防超大文件撑爆磁盘/算力）──
const upload = (0, upload_limit_1.createUploader)({
    dir: 'rag',
    maxSize: 20 * 1024 * 1024, // 20MB
    allowedExts: ['.pdf', '.docx', '.doc', '.md', '.txt', '.html', '.htm'],
    maxCount: 10,
});
// ── 校验 Schema ─────────────────────────────────────────
const ingestUrlSchema = {
    url: { required: true, type: 'string' },
};
const batchEmbedSchema = {
    documentIds: { required: true, type: 'stringArray', minLength: 1 },
};
// ── 路由 ───────────────────────────────────────────────
/**
 * POST /api/rag/pipeline/upload
 * 上传文档 → 自动解析 → 分块 → 向量化 → 存入知识库
 * 对标 Dify 的一键文档导入
 */
router.post('/pipeline/upload', auth_1.requireAuth, (0, subscription_1.enforceQuota)('rag_upload'), upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        const { tags, categories, isPublic: isPublicStr, teamId } = req.body;
        const isPublic = isPublicStr === 'true' || isPublicStr === undefined;
        const result = await rag_pipeline_service_1.ragPipelineService.ingestFile(req.file.path, req.file.originalname, {
            userId: req.user?.id || 'anonymous',
            tags: tags ? (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags) : undefined,
            categories: categories ? (typeof categories === 'string' ? categories.split(',').map((c) => c.trim()) : categories) : undefined,
            isPublic,
            teamId,
        });
        // 更新配额
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_upload');
        // 清理上传的临时文件
        try {
            fs_1.default.unlinkSync(req.file.path);
        }
        catch (e) { /* ignore */ }
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
    }
    catch (error) {
        // 清理上传文件
        if (req.file) {
            try {
                fs_1.default.unlinkSync(req.file.path);
            }
            catch { /* ignore */ }
        }
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * POST /api/rag/pipeline/upload-batch
 * 批量上传多个文档
 */
router.post('/pipeline/upload-batch', auth_1.requireAuth, (0, subscription_1.enforceQuota)('rag_upload'), upload.array('files', 10), async (req, res) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        const { tags, categories, isPublic: isPublicStr, teamId } = req.body;
        const isPublic = isPublicStr === 'true' || isPublicStr === undefined;
        const results = [];
        for (const file of files) {
            try {
                const result = await rag_pipeline_service_1.ragPipelineService.ingestFile(file.path, file.originalname, {
                    userId: req.user?.id || 'anonymous',
                    tags: tags
                        ? (typeof tags === 'string' ? tags.split(',').map((t) => t.trim()) : tags)
                        : undefined,
                    categories: categories
                        ? (typeof categories === 'string' ? categories.split(',').map((c) => c.trim()) : categories)
                        : undefined,
                    isPublic,
                    teamId,
                });
                results.push(result);
                try {
                    fs_1.default.unlinkSync(file.path);
                }
                catch { /* ignore */ }
            }
            catch (err) {
                results.push({
                    originalName: file.originalname,
                    format: path_1.default.extname(file.originalname).replace('.', ''),
                    chunks: 0,
                    documentsCreated: [],
                    errors: [err instanceof Error ? err.message : String(err)],
                    parseTime: 0,
                    embedTime: 0,
                    totalTime: 0,
                });
            }
        }
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_upload');
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
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * POST /api/rag/pipeline/ingest-url
 * 从 URL 导入网页内容
 */
router.post('/pipeline/ingest-url', auth_1.requireAuth, (0, subscription_1.enforceQuota)('rag_upload'), (0, validation_1.validate)(ingestUrlSchema), async (req, res) => {
    try {
        const { url, tags, categories, isPublic, teamId } = req.body;
        const result = await rag_pipeline_service_1.ragPipelineService.ingestFromUrl(url, {
            userId: req.user?.id || 'anonymous',
            tags: tags || [],
            categories: categories || [],
            isPublic: isPublic ?? true,
            teamId,
        });
        if (req.user?.id)
            await (0, subscription_1.quotaIncrement)(req.user.id, 'rag_upload');
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
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
/**
 * GET /api/rag/pipeline/formats
 * 返回支持的文档格式列表
 */
router.get('/pipeline/formats', (_req, res) => {
    res.json({
        success: true,
        formats: rag_pipeline_service_1.ragPipelineService.getSupportedFormats(),
    });
});
/**
 * POST /api/rag/pipeline/re-embed
 * 重新为知识库中未嵌入的文档生成向量（可选指定文档 ID 列表）
 */
router.post('/pipeline/re-embed', auth_1.requireAuth, async (req, res) => {
    try {
        const { documentIds } = req.body;
        let query = { embedding: { $exists: false } };
        if (documentIds && Array.isArray(documentIds)) {
            query = { _id: { $in: documentIds } };
        }
        const docs = await KnowledgeDocument_1.KnowledgeDocument.find(query);
        let success = 0;
        let failed = 0;
        const errors = [];
        for (const doc of docs) {
            try {
                await embedding_1.embeddingService.embedDocument(String(doc._id));
                success++;
            }
            catch (err) {
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
    }
    catch (error) {
        (0, http_error_1.sendError)(res, error);
    }
});
exports.default = router;
//# sourceMappingURL=rag-pipeline.js.map