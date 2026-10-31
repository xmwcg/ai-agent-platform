import { createAIClient } from '../config/ai-models';
import { KnowledgeDocument } from '../models/KnowledgeDocument';
import { getVectorStore } from './vector-store';
import EmbeddingService from './embedding';

jest.mock('../config/ai-models', () => ({ createAIClient: jest.fn() }));
jest.mock('./vector-store', () => ({
  getVectorStore: jest.fn(),
  cosineSimilarity: jest.fn(),
  rankByCosine: jest.fn(),
}));

describe('remote RAG vector result authorization', () => {
  afterEach(() => jest.restoreAllMocks());

  it('reads only Mongo-authorized documents and ignores untrusted vector payload', async () => {
    const allowedId = '507f1f77bcf86cd799439011';
    const deniedId = '507f1f77bcf86cd799439012';
    (createAIClient as jest.Mock).mockReturnValue({
      embeddings: { create: jest.fn().mockResolvedValue({ data: [{ embedding: [1, 0] }] }) },
    });
    (getVectorStore as jest.Mock).mockReturnValue({
      kind: 'qdrant',
      search: jest.fn().mockResolvedValue([
        { id: deniedId, similarity: 0.99, payload: { doc: { content: 'PRIVATE SECRET' } } },
        { id: allowedId, similarity: 0.92, payload: { doc: { content: 'FAKE CONTENT' } } },
      ]),
    });
    const find = jest.spyOn(KnowledgeDocument, 'find').mockResolvedValue([
      { _id: allowedId, title: 'Public', content: 'REAL MONGO CONTENT' },
    ] as any);
    const filter = { isPublic: true };
    const result = await new EmbeddingService().searchSimilarDocuments('query', { filter });

    expect(find).toHaveBeenCalledWith({
      $and: [filter, { _id: { $in: [deniedId, allowedId] } }],
    });
    expect(result).toHaveLength(1);
    expect(result[0].document.content).toBe('REAL MONGO CONTENT');
    expect(result[0].document._id).toBe(allowedId);
  });
});
