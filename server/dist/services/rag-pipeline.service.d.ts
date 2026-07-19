/**
 * RAG 文档自动处理管道
 * 对标 Dify 的文档处理能力：上传 → 解析 → 智能分块 → 自动向量化 → 存入知识库
 *
 * 支持的格式：PDF、Word (.docx)、Markdown (.md)、纯文本 (.txt)、HTML (.html)
 *
 * 该文件仅保留编排层；类型定义见 rag-pipeline.types.ts，
 * 文档解析见 rag-pipeline.parser.ts，分块见 rag-pipeline.chunker.ts。
 */
import { PipelineResult } from './rag-pipeline.types';
declare class RAGPipelineService {
    private parser;
    private chunker;
    /**
     * 完整管道：上传文件 → 解析 → 分块 → 嵌入 → 存入知识库
     */
    ingestFile(filePath: string, fileName: string, options: {
        userId: string;
        tags?: string[];
        categories?: string[];
        isPublic?: boolean;
        teamId?: string;
        chunkSize?: number;
        chunkOverlap?: number;
    }): Promise<PipelineResult>;
    /**
     * 批量导入文件夹中的所有支持文档
     */
    ingestDirectory(dirPath: string, options: {
        userId: string;
        tags?: string[];
        isPublic?: boolean;
        teamId?: string;
    }): Promise<PipelineResult[]>;
    /**
     * 从 URL 爬取网页内容并导入
     */
    ingestFromUrl(url: string, options: {
        userId: string;
        tags?: string[];
        categories?: string[];
        isPublic?: boolean;
        teamId?: string;
    }): Promise<PipelineResult>;
    /**
     * 获取支持的格式列表
     */
    getSupportedFormats(): {
        ext: string;
        label: string;
        description: string;
    }[];
}
export declare const ragPipelineService: RAGPipelineService;
export default RAGPipelineService;
//# sourceMappingURL=rag-pipeline.service.d.ts.map