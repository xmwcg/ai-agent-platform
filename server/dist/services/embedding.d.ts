import { IKnowledgeDocument } from '../models/KnowledgeDocument';
import { FilterQuery } from 'mongoose';
type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';
interface EmbeddingConfig {
    model: EmbeddingModel;
    dimensions?: number;
    batchSize: number;
}
declare class EmbeddingService {
    private config;
    constructor(config?: Partial<EmbeddingConfig>);
    generateEmbedding(text: string): Promise<number[]>;
    generateEmbeddings(texts: string[]): Promise<number[][]>;
    calculateSimilarity(vecA: number[], vecB: number[]): number;
    embedDocument(documentId: string): Promise<void>;
    embedDocuments(documentIds: string[]): Promise<{
        success: number;
        failed: number;
    }>;
    searchSimilarDocuments(query: string, options?: {
        limit?: number;
        minSimilarity?: number;
        filter?: FilterQuery<IKnowledgeDocument>;
    }): Promise<Array<{
        document: IKnowledgeDocument;
        similarity: number;
    }>>;
}
export declare const embeddingService: EmbeddingService;
export default EmbeddingService;
//# sourceMappingURL=embedding.d.ts.map