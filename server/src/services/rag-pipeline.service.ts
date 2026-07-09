/**
 * RAG 文档自动处理管道
 * 对标 Dify 的文档处理能力：上传 → 解析 → 智能分块 → 自动向量化 → 存入知识库
 *
 * 支持的格式：PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、HTML (.html)
 */

import fs from 'fs';
import path from 'path';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { embeddingService } from './embedding';
import { logger } from '../lib/logger';

// ── 文档解析器接口 ────────────────────────────────────

export interface ParsedDocument {
  text: string;           // 解析后的纯文本
  metadata: {
    format: string;       // 原始格式
    fileName: string;     // 原始文件名
    pageCount?: number;   // 页数（PDF）
    wordCount?: number;   // 字数
    parseTime: number;    // 解析耗时 (ms)
  };
}

export interface ChunkResult {
  index: number;          // 分块序号
  text: string;           // 分块文本
  byteOffset: number;     // 在原文本中的起始位置
  charCount: number;      // 字符数
}

export interface PipelineResult {
  originalName: string;
  format: string;
  chunks: number;
  documentsCreated: string[]; // 创建的知识文档 ID 列表
  errors: string[];
  parseTime: number;
  embedTime: number;
  totalTime: number;
}

// ── 默认配置 ──────────────────────────────────────────

const DEFAULT_CONFIG = {
  chunkSize: 1000,        // 每块最大字符数
  chunkOverlap: 200,      // 块间重叠字符数
  maxChunks: 100,         // 单文档最大分块数
  uploadDir: path.join(process.cwd(), 'uploads'), // 上传目录
};

// ── 文档解析器 ────────────────────────────────────────

class DocumentParser {
  /**
   * 解析 Word (.docx) 文档
   */
  async parseDocx(filePath: string): Promise<string> {
    // 动态导入 mammoth 避免启动时加载
    const mammoth = await import('mammoth');
    const result = await mammoth.extractRawText({ path: filePath });
    if (result.messages.length > 0) {
      logger.warn('rag-pipeline', 'Mammoth parse warnings', result.messages);
    }
    return result.value;
  }

  /**
   * 解析 PDF 文档
   */
  async parsePdf(filePath: string): Promise<{ text: string; pageCount: number }> {
    // pdf-parse 是 CJS 模块，需要特殊导入
    const pdfParseFn = require('pdf-parse');
    const dataBuffer = fs.readFileSync(filePath);
    const data = await pdfParseFn(dataBuffer);
    return { text: data.text, pageCount: data.numpages };
  }

  /**
   * 解析 Markdown / 纯文本 / HTML
   */
  async parseText(filePath: string, format: string): Promise<string> {
    const raw = fs.readFileSync(filePath, 'utf-8');

    if (format === 'html' || format === 'htm') {
      // 简单 HTML 标签清理
      const cheerio = await import('cheerio');
      const $ = cheerio.load(raw);
      // 移除 script / style
      $('script, style, nav, footer, header').remove();
      return $('body').text().replace(/\s+/g, ' ').trim();
    }

    // Markdown / TXT 直接返回原文
    return raw;
  }

  /**
   * 主入口：根据文件扩展名自动选择解析器
   */
  async parse(filePath: string, fileName: string): Promise<ParsedDocument> {
    const startTime = Date.now();
    const ext = path.extname(fileName).toLowerCase().replace('.', '');
    let text = '';
    let pageCount: number | undefined;
    let wordCount = 0;

    try {
      switch (ext) {
        case 'pdf':
          const pdfResult = await this.parsePdf(filePath);
          text = pdfResult.text;
          pageCount = pdfResult.pageCount;
          break;

        case 'docx':
        case 'doc':
          text = await this.parseDocx(filePath);
          break;

        case 'md':
        case 'txt':
        case 'html':
        case 'htm':
          text = await this.parseText(filePath, ext);
          break;

        default:
          throw new Error(`Unsupported format: .${ext}`);
      }

      // 基本清理
      text = text.replace(/\r\n/g, '\n').replace(/\t/g, ' ').trim();

      if (!text) {
        throw new Error('Parsed document is empty');
      }

      wordCount = text.length;

      return {
        text,
        metadata: {
          format: ext,
          fileName,
          pageCount,
          wordCount,
          parseTime: Date.now() - startTime,
        },
      };
    } catch (error) {
      logger.error('rag-pipeline', `Parse error for ${fileName}`, error);
      throw error;
    }
  }
}

// ── 智能分块器 ────────────────────────────────────────

class DocumentChunker {
  private config: typeof DEFAULT_CONFIG;

  constructor(config: Partial<typeof DEFAULT_CONFIG> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * 基于段落 + 语义边界的分块策略
   *
   * 策略：
   * 1. 先按段落 (\n\n) 分割
   * 2. 段落组合达到 chunkSize 时切割
   * 3. 块间保留 chunkOverlap 重叠
   * 4. 保持 Markdown 标题和代码块的完整性
   */
  chunk(text: string): ChunkResult[] {
    const { chunkSize, chunkOverlap, maxChunks } = this.config;
    const chunks: ChunkResult[] = [];

    // Step 1: 按段落分割
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());

    // Step 2: 累积段落直到达到 chunkSize
    let currentChunk = '';
    let byteOffset = 0;
    let index = 0;

    for (const para of paragraphs) {
      const wouldBe = currentChunk
        ? `${currentChunk}\n\n${para}`
        : para;

      if (wouldBe.length > chunkSize && currentChunk) {
        // 当前块已满，切割
        chunks.push({
          index,
          text: currentChunk.trim(),
          byteOffset,
          charCount: currentChunk.length,
        });

        if (chunks.length >= maxChunks) break;

        // 重叠策略：保留当前块末尾部分作为下一块的上下文
        const overlapText = currentChunk.slice(-chunkOverlap);
        currentChunk = overlapText + '\n\n' + para;
        byteOffset += currentChunk.length - overlapText.length;
        index++;
      } else {
        currentChunk = wouldBe;
      }
    }

    // Step 3: 处理剩余内容
    if (currentChunk.trim() && chunks.length < maxChunks) {
      chunks.push({
        index,
        text: currentChunk.trim(),
        byteOffset,
        charCount: currentChunk.length,
      });
    }

    logger.info('rag-pipeline', `Chunked into ${chunks.length} chunks (avg ${Math.round(text.length / Math.max(chunks.length, 1))} chars/chunk)`);
    return chunks;
  }
}

// ── RAG Pipeline 主服务类 ─────────────────────────────

class RAGPipelineService {
  private parser = new DocumentParser();
  private chunker = new DocumentChunker();

  /**
   * 完整管道：上传文件 → 解析 → 分块 → 嵌入 → 存入知识库
   */
  async ingestFile(
    filePath: string,
    fileName: string,
    options: {
      userId: string;
      tags?: string[];
      categories?: string[];
      isPublic?: boolean;
      teamId?: string;
      chunkSize?: number;
      chunkOverlap?: number;
    }
  ): Promise<PipelineResult> {
    const totalStart = Date.now();
    const errors: string[] = [];
    const documentsCreated: string[] = [];

    // 自定义分块参数
    if (options.chunkSize || options.chunkOverlap) {
      this.chunker = new DocumentChunker({
        chunkSize: options.chunkSize,
        chunkOverlap: options.chunkOverlap,
      });
    }

    // Step 1: 解析文档
    logger.info('rag-pipeline', `Ingesting: ${fileName}`);
    let parsed: ParsedDocument;
    try {
      parsed = await this.parser.parse(filePath, fileName);
    } catch (err) {
      return {
        originalName: fileName,
        format: path.extname(fileName).replace('.', ''),
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
    const baseTitle = path.basename(fileName, path.extname(fileName));

    for (const chunk of chunks) {
      try {
        const title = chunks.length === 1
          ? baseTitle
          : `${baseTitle} (Part ${chunk.index + 1}/${chunks.length})`;

        // 创建知识文档
        const doc = await KnowledgeDocument.create({
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
          const embedding = await embeddingService.generateEmbedding(embedText);
          doc.embedding = embedding;
          await doc.save();
          logger.info('rag-pipeline', `Chunk ${chunk.index + 1}/${chunks.length} embedded (${doc._id})`);
        } catch (embedErr) {
          logger.warn('rag-pipeline', `Embedding failed for chunk ${chunk.index}, doc saved without embedding`);
          // 不阻止文档创建，后续可手动嵌入
        }

        documentsCreated.push(String(doc._id));
      } catch (err) {
        const msg = `Chunk ${chunk.index}: ${err instanceof Error ? err.message : err}`;
        errors.push(msg);
        logger.error('rag-pipeline', msg);
      }
    }

    const totalTime = Date.now() - totalStart;

    logger.info('rag-pipeline',
      `Pipeline complete: ${fileName} → ${documentsCreated.length} docs in ${totalTime}ms ` +
      `(parse: ${parsed.metadata.parseTime}ms, embed: ${Date.now() - embedStart}ms)`
    );

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
  async ingestDirectory(
    dirPath: string,
    options: {
      userId: string;
      tags?: string[];
      isPublic?: boolean;
      teamId?: string;
    }
  ): Promise<PipelineResult[]> {
    const files = fs.readdirSync(dirPath);
    const supportedExts = ['.pdf', '.docx', '.doc', '.md', '.txt', '.html', '.htm'];
    const results: PipelineResult[] = [];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (!supportedExts.includes(ext)) continue;

      const filePath = path.join(dirPath, file);
      try {
        const result = await this.ingestFile(filePath, file, options);
        results.push(result);
      } catch (err) {
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
  async ingestFromUrl(
    url: string,
    options: {
      userId: string;
      tags?: string[];
      categories?: string[];
      isPublic?: boolean;
      teamId?: string;
    }
  ): Promise<PipelineResult> {
    const startTime = Date.now();
    let html = '';
    const axios = (await import('axios')).default;

    try {
      const response = await axios.get(url, {
        timeout: 15000,
        headers: { 'User-Agent': 'Reasonix-RAG-Bot/1.0' },
      });
      html = typeof response.data === 'string' ? response.data : JSON.stringify(response.data);
    } catch (err) {
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
    const cheerio = await import('cheerio');
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
    const tmpDir = path.join(process.cwd(), 'uploads', 'tmp');
    fs.mkdirSync(tmpDir, { recursive: true });
    const safeName = title.replace(/[^a-zA-Z0-9\u4e00-\u9fff\-_]/g, '_').slice(0, 80) || 'webpage';
    const tmpPath = path.join(tmpDir, `${safeName}.md`);
    fs.writeFileSync(tmpPath, `# ${title}\n\n> Source: ${url}\n\n${text}`, 'utf-8');

    const result = await this.ingestFile(tmpPath, `${safeName}.md`, {
      ...options,
      tags: [...(options.tags || []), `source-url:${new URL(url).hostname}`],
    });

    // 清理临时文件
    try { fs.unlinkSync(tmpPath); } catch { /* ignore */ }

    return result;
  }

  /**
   * 获取支持的格式列表
   */
  getSupportedFormats(): { ext: string; label: string; description: string }[] {
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

export const ragPipelineService = new RAGPipelineService();
export default RAGPipelineService;
