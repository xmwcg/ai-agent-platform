"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.embeddingService = void 0;
const ai_models_1 = require("../config/ai-models");
const KnowledgeDocument_1 = require("../models/KnowledgeDocument");
const logger_1 = require("../lib/logger");
const vector_store_1 = require("./vector-store");
// 向量维度（根据模型而定）
const EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small
// 默认配置
const defaultConfig = {
    model: 'text-embedding-3-small',
    dimensions: EMBEDDING_DIMENSION,
    batchSize: 100
};
// 向量嵌入服务类
class EmbeddingService {
    constructor(config) {
        this.config = { ...defaultConfig, ...config };
    }
    // 生成文本嵌入向量
    async generateEmbedding(text) {
        try {
            const client = (0, ai_models_1.createAIClient)();
            const response = await client.embeddings.create({
                model: this.config.model,
                input: text.slice(0, 8000), // 限制输入长度
                dimensions: this.config.dimensions
            });
            return response.data[0].embedding;
        }
        catch (error) {
            logger_1.logger.error('embedding', 'Generate embedding error', error instanceof Error ? error.message : error);
            throw error;
        }
    }
    // 批量生成嵌入向量
    async generateEmbeddings(texts) {
        const embeddings = [];
        // 分批处理
        for (let i = 0; i < texts.length; i += this.config.batchSize) {
            const batch = texts.slice(i, i + this.config.batchSize);
            try {
                const client = (0, ai_models_1.createAIClient)();
                const response = await client.embeddings.create({
                    model: this.config.model,
                    input: batch.map(text => text.slice(0, 8000)),
                    dimensions: this.config.dimensions
                });
                embeddings.push(...response.data.map(item => item.embedding));
            }
            catch (error) {
                logger_1.logger.error('embedding', `Batch embedding error (batch ${i / this.config.batchSize})`, error instanceof Error ? error.message : error);
                // 继续处理下一批
            }
        }
        return embeddings;
    }
    // 计算余弦相似度（委托给可单测的纯函数）
    calculateSimilarity(vecA, vecB) {
        return (0, vector_store_1.cosineSimilarity)(vecA, vecB);
    }
    // 为文档生成嵌入向量并保存
    async embedDocument(documentId) {
        try {
            const doc = await KnowledgeDocument_1.KnowledgeDocument.findById(documentId);
            if (!doc) {
                throw new Error(`Document ${documentId} not found`);
            }
            // 使用标题 + 内容生成嵌入
            const text = `${doc.title}\n\n${doc.content}`;
            const embedding = await this.generateEmbedding(text);
            // 保存嵌入向量
            doc.embedding = embedding;
            await doc.save();
            logger_1.logger.info('embedding', `Document ${documentId} embedded successfully`);
        }
        catch (error) {
            logger_1.logger.error('embedding', `Embed document ${documentId} error`, error instanceof Error ? error.message : error);
            throw error;
        }
    }
    // 批量嵌入文档
    async embedDocuments(documentIds) {
        let success = 0;
        let failed = 0;
        for (const id of documentIds) {
            try {
                await this.embedDocument(id);
                success++;
            }
            catch (error) {
                failed++;
            }
        }
        return { success, failed };
    }
    // 搜索相似文档
    async searchSimilarDocuments(query, options = {}) {
        const { limit = 5, minSimilarity = 0.7, filter = {} } = options;
        try {
            // 生成查询向量
            const queryEmbedding = await this.generateEmbedding(query);
            const store = (0, vector_store_1.getVectorStore)();
            // memory 模式：复用 MongoDB 中的文档向量，进程内余弦排序（行为保持兼容）
            if (store.kind === 'memory') {
                const documents = await KnowledgeDocument_1.KnowledgeDocument.find({
                    ...filter,
                    embedding: { $exists: true, $ne: [] }
                }).select('+embedding');
                const candidates = documents.map((doc) => ({
                    id: String(doc._id),
                    vector: doc.embedding,
                    payload: { doc: doc.toObject() },
                }));
                const hits = (0, vector_store_1.rankByCosine)(queryEmbedding, candidates, { topK: limit, minSimilarity });
                return hits.map((h) => ({
                    document: h.payload.doc,
                    similarity: h.similarity,
                }));
            }
            // 专业向量库（qdrant / pinecone）：远程检索，payload 携带必要字段
            const hits = await store.search(queryEmbedding, { topK: limit, minSimilarity });
            return hits.map((h) => ({
                document: (h.payload?.doc ?? { _id: h.id, title: h.payload?.title ?? '(远程向量)', content: '' }),
                similarity: h.similarity,
            }));
        }
        catch (error) {
            logger_1.logger.error('embedding', 'Search similar documents error', error instanceof Error ? error.message : error);
            throw error;
        }
    }
}
// 导出单例
exports.embeddingService = new EmbeddingService();
// 导出类（用于测试或自定义配置）
exports.default = EmbeddingService;
//# sourceMappingURL=embedding.js.map