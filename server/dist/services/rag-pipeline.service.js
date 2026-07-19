"use strict";
/**
 * RAG 文档自动处理管道
 * 对标 Dify 的文档处理能力：上传 → 解析 → 智能分块 → 自动向量化 → 存入知识库
 *
 * 支持的格式：PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、HTML (.html)
 *
 * 该文件仅保留编排层；类型定义见 rag-pipeline.types.ts，
 * 文档解析见 rag-pipeline.parser.ts，分块见 rag-pipeline.chunker.ts。
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ragPipelineService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const embedding_1 = require("./embedding");
const logger_1 = require("../lib/logger");
const rag_pipeline_parser_1 = require("./rag-pipeline.parser");
const rag_pipeline_chunker_1 = require("./rag-pipeline.chunker");
// ── RAG Pipeline 主服务类 ─────────────────────────────
class RAGPipelineService {
    constructor() {
        this.parser = new rag_pipeline_parser_1.DocumentParser();
        this.chunker = new rag_pipeline_chunker_1.DocumentChunker();
    }
    /**
     * 完整管道：上传文件 → 解析 → 分块 → 嵌入 → 存入知识库
     */
    async ingestFile(filePath, fileName, options) {
        const totalStart = Date.now();
        const errors = [];
        const documentsCreated = [];
        // 自定义分块参数
        if (options.chunkSize || options.chunkOverlap) {
            this.chunker = new rag_pipeline_chunker_1.DocumentChunker({
                chunkSize: options.chunkSize,
                chunkOverlap: options.chunkOverlap,
            });
        }
        // Step 1: 解析文档
        logger_1.logger.info('rag-pipeline', `Ingesting: ${fileName}`);
        let parsed;
        try {
            parsed = await this.parser.parse(filePath, fileName);
        }
        catch (err) {
            return {
                originalName: fileName,
                format: path_1.default.extname(fileName).replace('.', ''),
                chunks: 0,
                documentsCreated: [],
                errors: [`Parse failed: ${err instanceof Error ? err.message : err}`],
                parseTime: Date.now() - totalStart,
                embedTime: 0,
                totalTime: Date.now() - totalStart,
            };
        }
        // Step 2: 智能分块
        const chunks = this.chunker.chunk(parsed.text);
        if (chunks.length === 0) {
            return {
                originalName: fileName,
                format: parsed.metadata.format,
                chunks: 0,
                documentsCreated: [],
                errors: ['No content chunks produced'],
                parseTime: parsed.metadata.parseTime,
                embedTime: 0,
                totalTime: Date.now() - totalStart,
            };
        }
        // Step 3: 逐块创建知识文档 + 嵌入
        const embedStart = Date.now();
        const baseTitle = path_1.default.basename(fileName, path_1.default.extname(fileName));
        for (const chunk of chunks) {
            try {
                const title = chunks.length === 1
                    ? baseTitle
                    : `${baseTitle} (Part ${chunk.index + 1}/${chunks.length})`;
                // 创建知识文档
                const doc = await KnowledgeDocument_1.KnowledgeDocument.create({
                    title,
                    content: chunk.text,
                    author: options.userId,
                    tags: [
                        ...(options.tags || []),
                        'auto-ingested',
                        `source:${parsed.metadata.format}`,
                        `chunk:${chunk.index + 1}`,
                    ],
                    categories: options.categories || ['imported'],
                    isPublic: options.isPublic ?? false,
                    teamId: options.teamId,
                });
                // 自动生成嵌入向量
                try {
                    const embedText = `${title}\n\n${chunk.text}`;
                    const embedding = await embedding_1.embeddingService.generateEmbedding(embedText);
                    doc.embedding = embedding;
                    await doc.save();
                    logger_1.logger.info('rag-pipeline', `Chunk ${chunk.index + 1}/${chunks.length} embedded (${doc._id})`);
                }
                catch (embedErr) {
                    logger_1.logger.warn('rag-pipeline', `Embedding failed for chunk ${chunk.index}, doc saved without embedding`);
                    // 不阻止文档创建，后续可手动嵌入
                }
                documentsCreated.push(String(doc._id));
            }
            catch (err) {
                const msg = `Chunk ${chunk.index}: ${err instanceof Error ? err.message : err}`;
                errors.push(msg);
                logger_1.logger.error('rag-pipeline', msg);
            }
        }
        const totalTime = Date.now() - totalStart;
        logger_1.logger.info('rag-pipeline', `Pipeline complete: ${fileName} → ${documentsCreated.length} docs in ${totalTime}ms ` +
            `(parse: ${parsed.metadata.parseTime}ms, embed: ${Date.now() - embedStart}ms)`);
        return {
            originalName: fileName,
            format: parsed.metadata.format,
            chunks: chunks.length,
            documentsCreated,
            errors,
            parseTime: parsed.metadata.parseTime,
            embedTime: Date.now() - embedStart,
            totalTime,
        };
    }
    /**
     * 批量导入文件夹中的所有支持文档
     */
    async ingestDirectory(dirPath, options) {
        const files = fs_1.default.readdirSync(dirPath);
        const supportedExts = ['.pdf', '.docx', '.doc', '.md', '.txt', '.html', '.htm'];
        const results = [];
        for (const file of files) {
            const ext = path_1.default.extname(file).toLowerCase();
            if (!supportedExts.includes(ext))
                continue;
            const filePath = path_1.default.join(dirPath, file);
            try {
                const result = await this.ingestFile(filePath, file, options);
                results.push(result);
            }
            catch (err) {
                results.push({
                    originalName: file,
                    format: ext.replace('.', ''),
                    chunks: 0,
                    documentsCreated: [],
                    errors: [err instanceof Error ? err.message : String(err)],
                    parseTime: 0,
                    embedTime: 0,
                    totalTime: 0,
                });
            }
        }
        return results;
    }
    /**
     * 从 URL 爬取网页内容并导入
     */
    async ingestFromUrl(url, options) {
        const startTime = Date.now();
        let html = '';
        const axios = (await Promise.resolve().then(() => __importStar(require('axios')))).default;
        try {
            const response = await axios.get(url, {
                timeout: 15000,
                headers: { 'User-Agent': 'Reasonix-RAG-Bot/1.0' },
            });
            html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
        }
        catch (err) {
            return {
                originalName: url,
                format: 'url',
                chunks: 0,
                documentsCreated: [],
                errors: [`Fetch failed: ${err instanceof Error ? err.message : err}`],
                parseTime: Date.now() - startTime,
                embedTime: 0,
                totalTime: Date.now() - startTime,
            };
        }
        // 解析 HTML
        const cheerio = await Promise.resolve().then(() => __importStar(require('cheerio')));
        const $ = cheerio.load(html);
        $('script, style, nav, footer, header, iframe, noscript').remove();
        const title = $('title').text().trim() || new URL(url).hostname;
        const text = $('body').text().replace(/\s+/g, ' ').trim();
        if (!text || text.length < 50) {
            return {
                originalName: url,
                format: 'url',
                chunks: 0,
                documentsCreated: [],
                errors: ['Page content too short or empty'],
                parseTime: Date.now() - startTime,
                embedTime: 0,
                totalTime: Date.now() - startTime,
            };
        }
        // 写入临时文件然后走标准管道
        const tmpDir = path_1.default.join(process.cwd(), 'uploads', 'tmp');
        fs_1.default.mkdirSync(tmpDir, { recursive: true });
        const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff\-_]/g, '_').slice(0, 80) || 'webpage';
        const tmpPath = path_1.default.join(tmpDir, `${safeName}.md`);
        fs_1.default.writeFileSync(tmpPath, `# ${title}\n\n> Source: ${url}\n\n${text}`, 'utf-8');
        const result = await this.ingestFile(tmpPath, `${safeName}.md`, {
            ...options,
            tags: [...(options.tags || []), `source-url:${new URL(url).hostname}`],
        });
        // 清理临时文件
        try {
            fs_1.default.unlinkSync(tmpPath);
        }
        catch { /* ignore */ }
        return result;
    }
    /**
     * 获取支持的格式列表
     */
    getSupportedFormats() {
        return [
            { ext: 'pdf', label: 'PDF', description: 'PDF 文档 (自动提取文本)' },
            { ext: 'docx', label: 'Word', description: 'Word 文档 (.docx)' },
            { ext: 'md', label: 'Markdown', description: 'Markdown 格式文档' },
            { ext: 'txt', label: '纯文本', description: '纯文本文件 (.txt)' },
            { ext: 'html', label: '网页', description: 'HTML 网页文件' },
            { ext: 'url', label: 'URL 导入', description: '直接从网址导入网页内容' },
        ];
    }
}
// ── 导出 ─────────────────────────────────────────────
exports.ragPipelineService = new RAGPipelineService();
exports.default = RAGPipelineService;
//# sourceMappingURL=rag-pipeline.service.js.map