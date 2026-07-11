import {
  cosineSimilarity,
  rankByCosine,
  selectVectorStoreKind,
  getVectorStore,
} from './vector-store';

describe('vector-store pure functions', () => {
  describe('cosineSimilarity', () => {
    it('相同向量相似度为 1', () => {
      expect(cosineSimilarity([1, 0, 0], [1, 0, 0])).toBeCloseTo(1);
    });
    it('正交向量相似度为 0', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    });
    it('反向向量相似度为 -1', () => {
      expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    });
    it('维度不一致抛错', () => {
      expect(() => cosineSimilarity([1, 2], [1])).toThrow();
    });
  });

  describe('rankByCosine', () => {
    const q = [1, 0, 0];
    const candidates = [
      { id: 'a', vector: [1, 0, 0] },
      { id: 'b', vector: [0, 1, 0] },
      { id: 'c', vector: [0.9, 0.1, 0] },
    ];
    it('按相似度降序返回', () => {
      const r = rankByCosine(q, candidates, { topK: 3 });
      expect(r[0].id).toBe('a');
      expect(r[1].id).toBe('c');
      expect(r[2].id).toBe('b');
    });
    it('minSimilarity 过滤', () => {
      const r = rankByCosine(q, candidates, { minSimilarity: 0.5 });
      expect(r.map((x) => x.id)).toEqual(['a', 'c']);
    });
    it('topK 截断', () => {
      const r = rankByCosine(q, candidates, { topK: 1 });
      expect(r).toHaveLength(1);
      expect(r[0].id).toBe('a');
    });
  });

  describe('selectVectorStoreKind', () => {
    it('默认 memory', () => {
      expect(selectVectorStoreKind({})).toBe('memory');
    });
    it('显式覆盖优先', () => {
      expect(selectVectorStoreKind({ VECTOR_STORE: 'qdrant' })).toBe('qdrant');
      expect(selectVectorStoreKind({ VECTOR_STORE: 'pinecone' })).toBe('pinecone');
      expect(selectVectorStoreKind({ VECTOR_STORE: 'memory' })).toBe('memory');
    });
    it('按环境变量自动识别', () => {
      expect(selectVectorStoreKind({ QDRANT_URL: 'x', QDRANT_API_KEY: 'y' })).toBe('qdrant');
      expect(selectVectorStoreKind({ PINECONE_API_KEY: 'k', PINECONE_INDEX_HOST: 'h' })).toBe('pinecone');
      expect(selectVectorStoreKind({ QDRANT_URL: 'x' })).toBe('memory'); // 缺 key
    });
  });

  describe('getVectorStore', () => {
    it('memory 始终可用，qdrant/pinecone 未配置时不可用', () => {
      const env = { QDRANT_URL: 'x', QDRANT_API_KEY: 'y', PINECONE_API_KEY: 'k', PINECONE_INDEX_HOST: 'h' };
      expect(getVectorStore(env).kind).toBe('qdrant'); // 显式优先于另一个
      const mem = getVectorStore({});
      expect(mem.kind).toBe('memory');
      expect(mem.isConfigured()).toBe(true);
    });
    it('memory search 复用 rankByCosine', async () => {
      const store = getVectorStore({});
      const hits = await store.search([1, 0, 0], { topK: 1 }, [{ id: 'a', vector: [1, 0, 0] }]);
      expect(hits[0].id).toBe('a');
    });
  });
});
