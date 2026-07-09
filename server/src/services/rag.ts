import { embeddingService } from './embedding';
import { aiAgentService } from './ai-agent';
import { KnowledgeDocument, IKnowledgeDocument } from '../models/KnowledgeDocument';
import { logger } from '../lib/logger';

/** RAG 检索结果的来源文档（已收敛 document: any 为强类型） */
export interface RAGSource {
  id: string;
  title: string;
  similarity: number;
  snippet: string;
}

// RAG 配置
export interface RAGConfig {
  maxDocuments: number; // 最多检索文档数
  minSimilarity: number; // 最小相似度
  includeContent: boolean; // 是否在上下文中包含完整内容
  systemPromptTemplate?: string; // 自定义系统提示词模板
}

// 默认 RAG 配置
const defaultRAGConfig: RAGConfig = {
  maxDocuments: 5,
  minSimilarity: 0.7,
  includeContent: true,
  systemPromptTemplate: `You are a knowledgeable assistant. Use the following context to answer the user's question. If the context doesn't contain the answer, say you don't know based on the provided information.

Context:
{{CONTEXT}}

User Question: {{QUESTION}}`
};

// RAG 服务类
class RAGService {
  private config: RAGConfig;

  constructor(config?: Partial<RAGConfig>) {
    this.config = { ...defaultRAGConfig, ...config };
  }

  // RAG 对话：检索 + 生成
  async ragChat(
    sessionId: string | undefined,
    question: string,
    userId: string = 'default-user'
  ): Promise<{ answer: string; sources: RAGSource[]; sessionId: string }> {
    try {
      // 1. 检索相关文档
      logger.info('rag', `Searching for: "${question}"`);
      const searchResults = await embeddingService.searchSimilarDocuments(question, {
        limit: this.config.maxDocuments,
        minSimilarity: this.config.minSimilarity
      });

      if (searchResults.length === 0) {
        logger.warn('rag', 'No relevant documents found');
        // 如果没有相关文档，使用普通对话
        if (!sessionId) {
          sessionId = await aiAgentService.createSession(userId);
        }
        const result = await aiAgentService.sendMessage(sessionId, question);
        return {
          answer: result.reply + '\n\n(No relevant documents found in knowledge base)',
          sources: [],
          sessionId
        };
      }

      logger.info('rag', `Found ${searchResults.length} relevant documents`);

      // 2. 构建上下文
      const context = this.buildContext(searchResults);

      // 3. 构建 RAG 提示词
      const ragPrompt = this.buildRAGPrompt(question, context);

      // 4. 创建或获取会话
      if (!sessionId) {
        sessionId = await aiAgentService.createSession(userId);
      }

      // 5. 发送消息（使用 RAG 增强的提示词）
      const result = await aiAgentService.sendMessage(sessionId, ragPrompt, {
        systemPrompt: this.config.systemPromptTemplate?.replace('{{CONTEXT}}', context).replace('{{QUESTION}}', question)
      });

      // 6. 返回结果（包含来源文档）
      const sources = searchResults.map(r => ({
        id: String(r.document._id),
        title: r.document.title,
        similarity: r.similarity,
        snippet: r.document.content.substring(0, 200) + '...'
      }));

      return {
        answer: result.reply,
        sources,
        sessionId
      };
    } catch (error) {
      logger.error('rag', 'RAG chat error', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // 构建上下文（从检索结果）
  private buildContext(searchResults: Array<{ document: IKnowledgeDocument; similarity: number }>): string {
    let context = '';

    searchResults.forEach((result, index) => {
      const { document, similarity } = result;
      
      context += `\n--- Document ${index + 1}: ${document.title} (Similarity: ${similarity.toFixed(3)}) ---\n`;
      
      if (this.config.includeContent) {
        // 包含完整内容（截取前 1000 字符）
        context += document.content.substring(0, 1000);
        if (document.content.length > 1000) {
          context += '\n...(content truncated)';
        }
      } else {
        // 只包含摘要
        context += document.summary || document.content.substring(0, 200) + '...';
      }
      
      context += '\n';
    });

    return context;
  }

  // 构建 RAG 提示词
  private buildRAGPrompt(question: string, context: string): string {
    return `Based on the following context, please answer: ${question}\n\nContext:\n${context}`;
  }

  // 为知识库中的所有文档生成嵌入向量
  async embedKnowledgeBase(): Promise<{ success: number; failed: number }> {
    try {
      const documents = await KnowledgeDocument.find({ embedding: { $exists: false } });
      logger.info('rag', `Found ${documents.length} documents without embeddings`);

      const documentIds = documents.map(doc => doc._id.toString());
      const result = await embeddingService.embedDocuments(documentIds);

      logger.info('rag', `Embedded ${result.success} documents, ${result.failed} failed`);
      return result;
    } catch (error) {
      logger.error('rag', 'Embed knowledge base error', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // 增量嵌入新文档
  async embedNewDocuments(): Promise<void> {
    // TODO: 监听文档创建事件，自动生成嵌入
    logger.debug('rag', 'Incremental embedding not implemented yet');
  }
}

// 导出单例
export const ragService = new RAGService();

// 导出类（用于测试或自定义配置）
export default RAGService;
