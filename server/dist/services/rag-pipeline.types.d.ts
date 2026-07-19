export interface ParsedDocument {
    text: string;
    metadata: {
        format: string;
        fileName: string;
        pageCount?: number;
        wordCount?: number;
        parseTime: number;
    };
}
export interface ChunkResult {
    index: number;
    text: string;
    byteOffset: number;
    charCount: number;
}
export interface PipelineResult {
    originalName: string;
    format: string;
    chunks: number;
    documentsCreated: string[];
    errors: string[];
    parseTime: number;
    embedTime: number;
    totalTime: number;
}
export declare const DEFAULT_CONFIG: {
    chunkSize: number;
    chunkOverlap: number;
    maxChunks: number;
    uploadDir: string;
};
//# sourceMappingURL=rag-pipeline.types.d.ts.map