import path from 'path';

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

export const DEFAULT_CONFIG = {
  chunkSize: 1000,        // 每块最大字符数
  chunkOverlap: 200,      // 块间重叠字符数
  maxChunks: 100,         // 单文档最大分块数
  uploadDir: path.join(process.cwd(), 'uploads'), // 上传目录
};
