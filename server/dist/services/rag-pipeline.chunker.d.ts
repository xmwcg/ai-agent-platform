import { ChunkResult, DEFAULT_CONFIG } from './rag-pipeline.types';
export declare class DocumentChunker {
    private config;
    constructor(config?: Partial<typeof DEFAULT_CONFIG>);
    /**
     * 基于段落 + 语义边界的分块策略
     *
     * 策略：
     * 1. 先按段落 (\n\n) 分割
     * 2. 段落组合达到 chunkSize 时切割
     * 3. 块间保留 chunkOverlap 重叠
     * 4. 保持 Markdown 标题和代码块的完整性
     */
    chunk(text: string): ChunkResult[];
}
//# sourceMappingURL=rag-pipeline.chunker.d.ts.map