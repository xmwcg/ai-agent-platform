import { createAIClient } from '../config/ai-models';
import { KnowledgeDocument, IKnowledgeDocument } from '../models/KnowledgeDocument';
import { FilterQuery } from 'mongoose';
import { logger } from '../lib/logger';

// 向量维度（根据模型而定）
const EMBEDDING_DIMENSION = 1536; // OpenAI text-embedding-3-small

// 支持的嵌入模型
type EmbeddingModel = 'text-embedding-3-small' | 'text-embedding-3-large' | 'text-embedding-ada-002';

// 嵌入服务配置
interface EmbeddingConfig {
  model: EmbeddingModel;
  dimensions?: number;
  batchSize: number;
}

// 默认配置
const defaultConfig: EmbeddingConfig = {
  model: 'text-embedding-3-small',
  dimensions: EMBEDDING_DIMENSION,
  batchSize: 100
};

// 向量嵌入服务类
class EmbeddingService {
  private config: EmbeddingConfig;

  constructor(config?: Partial<EmbeddingConfig>) {
    this.config = { ...defaultConfig, ...config };
  }

  // 生成文本嵌入向量
  async generateEmbedding(text: string): Promise<number[]> {
    try {
      const client = createAIClient();
      
      const response = await client.embeddings.create({
        model: this.config.model,
        input: text.slice(0, 8000), // 限制输入长度
        dimensions: this.config.dimensions
      });

      return response.data[0].embedding;
    } catch (error) {
      logger.error('embedding', 'Generate embedding error', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // 批量生成嵌入向量
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    
    // 分批处理
    for (let i = 0; i < texts.length; i += this.config.batchSize) {
      const batch = texts.slice(i, i + this.config.batchSize);
      
      try {
        const client = createAIClient();
        const response = await client.embeddings.create({
          model: this.config.model,
          input: batch.map(text => text.slice(0, 8000)),
          dimensions: this.config.dimensions
        });

        embeddings.push(...response.data.map(item => item.embedding));
      } catch (error) {
        logger.error('embedding', `Batch embedding error (batch ${i / this.config.batchSize})`, error instanceof Error ? error.message : error);
        // 继续处理下一批
      }
    }

    return embeddings;
  }

  // 计算余弦相似度
  calculateSimilarity(vecA: number[], vecB: number[]): number {
    if (vecA.length !== vecB.length) {
      throw new Error('Vectors must have the same dimension');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  // 为文档生成嵌入向量并保存
  async embedDocument(documentId: string): Promise<void> {
    try {
      const doc = await KnowledgeDocument.findById(documentId);
      if (!doc) {
        throw new Error(`Document ${documentId} not found`);
      }

      // 使用标题 + 内容生成嵌入
      const text = `${doc.title}\n\n${doc.content}`;
      const embedding = await this.generateEmbedding(text);

      // 保存嵌入向量
      doc.embedding = embedding;
      await doc.save();

      logger.info('embedding', `Document ${documentId} embedded successfully`);
    } catch (error) {
      logger.error('embedding', `Embed document ${documentId} error`, error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // 批量嵌入文档
  async embedDocuments(documentIds: string[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const id of documentIds) {
      try {
        await this.embedDocument(id);
        success++;
      } catch (error) {
        failed++;
      }
    }

    return { success, failed };
  }

  // 搜索相似文档
  async searchSimilarDocuments(
    query: string,
    options: {
      limit?: number;
      minSimilarity?: number;
      filter?: FilterQuery<IKnowledgeDocument>;
    } = {}
  ): Promise<Array<{ document: IKnowledgeDocument; similarity: number }>> {
    const { limit = 5, minSimilarity = 0.7, filter = {} } = options;

    try {
      // 生成查询向量
      const queryEmbedding = await this.generateEmbedding(query);

      // 获取所有有嵌入向量的文档
      const documents = await KnowledgeDocument.find({
        ...filter,
        embedding: { $exists: true, $ne: [] }
      }).select('+embedding');

      // 计算相似度
      const results = documents.map(doc => {
        const similarity = this.calculateSimilarity(queryEmbedding, doc.embedding);
        return { document: doc, similarity };
      });

      // 过滤和排序
      return results
        .filter(r => r.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);
    } catch (error) {
      logger.error('embedding', 'Search similar documents error', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

// 导出单例
export const embeddingService = new EmbeddingService();

// 导出类（用于测试或自定义配置）
export default EmbeddingService;
