import fs from 'fs';
import path from 'path';
import { logger } from '../lib/logger';
import { ParsedDocument } from './rag-pipeline.types';

// ── 文档解析器 ────────────────────────────────────────

export class DocumentParser {
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
