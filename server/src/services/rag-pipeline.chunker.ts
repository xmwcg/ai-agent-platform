import { logger } from '../lib/logger';
import { ChunkResult, DEFAULT_CONFIG } from './rag-pipeline.types';

// ── 智能分块器 ────────────────────────────────────────

export class DocumentChunker {
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
