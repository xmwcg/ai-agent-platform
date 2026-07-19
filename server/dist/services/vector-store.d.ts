export type VectorStoreKind = 'memory' | 'qdrant' | 'pinecone';
export interface VectorCandidate {
    id: string;
    vector: number[];
    payload?: Record<string, unknown>;
}
export interface RankedHit {
    id: string;
    similarity: number;
    payload?: Record<string, unknown>;
}
export interface VectorSearchOptions {
    topK?: number;
    minSimilarity?: number;
}
/** 纯函数：余弦相似度（与 OpenAI embeddings 约定一致，向量已归一化时即点积） */
export declare function cosineSimilarity(vecA: number[], vecB: number[]): number;
/** 纯函数：在候选向量中按余弦相似度排序并过滤，返回 TopK */
export declare function rankByCosine(queryVec: number[], candidates: VectorCandidate[], options?: VectorSearchOptions): RankedHit[];
/** 纯函数：根据环境变量推导向量库类型，默认 memory */
export declare function selectVectorStoreKind(env?: Record<string, string | undefined>): VectorStoreKind;
export interface VectorStoreProvider {
    kind: VectorStoreKind;
    isConfigured(): boolean;
    /** 在候选集（memory）或远程库（qdrant/pinecone）中检索 TopK */
    search(queryVec: number[], options?: VectorSearchOptions, candidates?: VectorCandidate[]): Promise<RankedHit[]>;
    /** 写入向量（远程库使用；memory 模式为 no-op） */
    upsert(points: VectorCandidate[], payloads?: Record<string, unknown>[]): Promise<void>;
}
export declare function getVectorStore(env?: Record<string, string | undefined>): VectorStoreProvider;
export default getVectorStore;
//# sourceMappingURL=vector-store.d.ts.map