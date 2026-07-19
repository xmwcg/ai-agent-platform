/** RAG 检索结果的来源文档（已收敛 document: any 为强类型） */
export interface RAGSource {
    id: string;
    title: string;
    similarity: number;
    snippet: string;
}
export interface RAGConfig {
    maxDocuments: number;
    minSimilarity: number;
    includeContent: boolean;
    systemPromptTemplate?: string;
}
declare class RAGService {
    private config;
    constructor(config?: Partial<RAGConfig>);
    ragChat(sessionId: string | undefined, question: string, userId?: string): Promise<{
        answer: string;
        sources: RAGSource[];
        sessionId: string;
    }>;
    private keywordSearch;
    private buildContext;
    private buildRAGPrompt;
    embedKnowledgeBase(): Promise<{
        success: number;
        failed: number;
    }>;
    embedNewDocuments(sinceMs?: number): Promise<{
        processed: number;
        success: number;
        failed: number;
    }>;
}
export declare const ragService: RAGService;
export default RAGService;
//# sourceMappingURL=rag.d.ts.map