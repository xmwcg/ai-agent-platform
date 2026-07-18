import { embeddingService } from './embedding';
import { aiAgentService } from './ai-agent';
import { callCloudbaseChat } from '../routes/aibak-chat';
import { KnowledgeDocument, IKnowledgeDocument } from '../models/KnowledgeDocument';
import { logger } from '../lib/logger';
import { measure } from '../lib/trace';

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
      // 1. 检索相关文档（向量检索失败则回退关键词检索，保证知识库问答始终可用）
      logger.info('rag', `Searching for: "${question}"`);
      let searchResults: Array<{ document: IKnowledgeDocument; similarity: number }> = [];
      try {
        searchResults = await embeddingService.searchSimilarDocuments(question, {
          limit: this.config.maxDocuments,
          minSimilarity: this.config.minSimilarity
        });
      } catch (embedErr) {
        logger.warn('rag', `Embedding search failed, falling back to keyword search: ${(embedErr as Error)?.message}`);
        searchResults = await this.keywordSearch(question, this.config.maxDocuments);
      }

      if (searchResults.length === 0) {
        logger.warn('rag', 'No relevant documents found');
        // 如果没有相关文档，使用普通对话
        if (!sessionId) {
          sessionId = await aiAgentService.createSession(userId);
        }
        const result = await aiAgentService.sendMessage(sessionId, question);
        return {
          answer: result.reply + '\n\n(知识库中未找到相关文档)',
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

      // 5. 发送消息（使用 RAG 增强的提示词）；chat provider 不可用时回退 CloudBase 免费模型
      let reply: string;
      try {
        const result = await measure(
          'rag.generateAnswer',
          () =>
            aiAgentService.sendMessage(sessionId, ragPrompt, {
              systemPrompt: this.config.systemPromptTemplate
                ?.replace('{{CONTEXT}}', context)
                .replace('{{QUESTION}}', question)
            }),
          { userId, input: { question, sourceCount: searchResults.length } }
        );
        reply = result.reply;
      } catch (genErr) {
        logger.warn('rag', `Primary chat provider failed, falling back to CloudBase free model: ${(genErr as Error)?.message}`);
        reply = await callCloudbaseChat(
          [
            { role: 'system', content: this.config.systemPromptTemplate
              ?.replace('{{CONTEXT}}', context)
              .replace('{{QUESTION}}', question) || '你是一个知识库助手，请基于上下文回答。' },
            { role: 'user', content: question },
          ],
          'hy3'
        );
      }

      // 6. 返回结果（包含来源文档）
      const sources = searchResults.map(r => ({
        id: String(r.document._id),
        title: r.document.title,
        similarity: r.similarity,
        snippet: r.document.content.substring(0, 200) + '...'
      }));

      return {
        answer: reply,
        sources,
        sessionId
      };
    } catch (error) {
      logger.error('rag', 'RAG chat error', error instanceof Error ? error.message : error);
      throw error;
    }
  }

  // 关键词回退检索：当向量嵌入服务不可用（如未配置 embedding endpoint）时，
  // 基于标题/正文/标签/分类的文本匹配返回相关文档，保证知识库问答不崩溃。
  private async keywordSearch(
    query: string,
    limit: number
  ): Promise<Array<{ document: IKnowledgeDocument; similarity: number }>> {
    const terms = query.split(/\s+/).map(t => t.trim()).filter(t => t.length > 1);
    const or: Record<string, any>[] = [
      { title: { $regex: query, $options: 'i' } },
      { content: { $regex: query, $options: 'i' } },
    ];
    if (terms.length) {
      or.push({ tags: { $in: terms } }, { categories: { $in: terms } });
    }
    const docs = await KnowledgeDocument.find({ $or: or })
      .limit(limit)
      .lean();
    return docs.map(d => ({ document: d as unknown as IKnowledgeDocument, similarity: 0.72 }));
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

  // 增量嵌入新文档：嵌入所有「尚未生成向量」的文档（自然即新增/历史漏嵌文档）。
  // 当传入 sinceMs 时，仅处理该时间点之后创建的文档，实现真正的增量；
  // 否则兜底处理全部缺失向量的文档，保证知识库问答始终可用。
  async embedNewDocuments(sinceMs?: number): Promise<{ processed: number; success: number; failed: number }> {
    try {
      const filter: Record<string, any> = { embedding: { $exists: false } };
      if (sinceMs && sinceMs > 0) {
        filter.createdAt = { $gte: new Date(sinceMs) };
      }
      const documents = await KnowledgeDocument.find(filter);
      if (documents.length === 0) {
        logger.info('rag', '增量嵌入：当前没有需要生成向量的新文档');
        return { processed: 0, success: 0, failed: 0 };
      }
      logger.info('rag', `增量嵌入：发现 ${documents.length} 篇待嵌入文档`);
      const result = await embeddingService.embedDocuments(documents.map((d) => d._id.toString()));
      logger.info('rag', `增量嵌入完成：成功 ${result.success}，失败 ${result.failed}`);
      return { processed: documents.length, success: result.success, failed: result.failed };
    } catch (error) {
      logger.error('rag', '增量嵌入失败', error instanceof Error ? error.message : error);
      throw error;
    }
  }
}

// 导出单例
export const ragService = new RAGService();

// 导出类（用于测试或自定义配置）
export default RAGService;
