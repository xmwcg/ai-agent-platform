"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.cosineSimilarity = cosineSimilarity;
exports.rankByCosine = rankByCosine;
exports.selectVectorStoreKind = selectVectorStoreKind;
exports.getVectorStore = getVectorStore;
/**
 * 向量库抽象（可插件化专业向量库）
 *
 * 把「向量相似度检索」抽象为 Provider，默认 memory（进程内余弦相似度，复用既有 MongoDB 文档向量），
 * 可一键切换到专业向量库 Qdrant / Pinecone（配置环境变量后自动启用，否则回退 memory）。
 *
 * 纯函数（可单测）：
 *   - cosineSimilarity(a, b)
 *   - rankByCosine(queryVec, candidates, opts)
 *   - selectVectorStoreKind(env)
 */
const axios_1 = __importDefault(require("axios"));
/** 纯函数：余弦相似度（与 OpenAI embeddings 约定一致，向量已归一化时即点积） */
function cosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB || vecA.length !== vecB.length) {
        throw new Error('cosineSimilarity: 两个向量维度不一致或为空');
    }
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dot += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0)
        return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
/** 纯函数：在候选向量中按余弦相似度排序并过滤，返回 TopK */
function rankByCosine(queryVec, candidates, options = {}) {
    const { topK = 5, minSimilarity = 0 } = options;
    return candidates
        .map((c) => ({ id: c.id, similarity: cosineSimilarity(queryVec, c.vector), payload: c.payload }))
        .filter((h) => h.similarity >= minSimilarity)
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK);
}
/** 纯函数：根据环境变量推导向量库类型，默认 memory */
function selectVectorStoreKind(env = process.env) {
    const explicit = env.VECTOR_STORE;
    if (explicit === 'qdrant')
        return 'qdrant';
    if (explicit === 'pinecone')
        return 'pinecone';
    if (explicit === 'memory')
        return 'memory';
    if (env.QDRANT_URL && env.QDRANT_API_KEY)
        return 'qdrant';
    if (env.PINECONE_API_KEY && env.PINECONE_INDEX_HOST)
        return 'pinecone';
    return 'memory';
}
class MemoryVectorStore {
    constructor() {
        this.kind = 'memory';
    }
    isConfigured() {
        return true;
    }
    async search(queryVec, options = {}, candidates = []) {
        return rankByCosine(queryVec, candidates, options);
    }
    async upsert() {
        /* memory 模式由调用方在 MongoDB 维护向量，无需额外写入 */
    }
}
class QdrantVectorStore {
    constructor(env = process.env) {
        this.kind = 'qdrant';
        this.env = env;
    }
    get url() {
        return (this.env.QDRANT_URL || '').replace(/\/$/, '');
    }
    get apiKey() {
        return this.env.QDRANT_API_KEY || '';
    }
    get collection() {
        return this.env.QDRANT_COLLECTION || 'reasonix';
    }
    isConfigured() {
        return !!this.env.QDRANT_URL && !!this.env.QDRANT_API_KEY;
    }
    async upsert(points, payloads = []) {
        if (!this.isConfigured())
            return;
        const body = {
            points: points.map((p, i) => ({
                id: p.id,
                vector: p.vector,
                payload: payloads[i] || p.payload || {},
            })),
        };
        await axios_1.default.put(`${this.url}/collections/${this.collection}/points?wait=true`, body, {
            headers: { 'Api-Key': this.apiKey, 'Content-Type': 'application/json' },
            timeout: 10000,
        });
    }
    async search(queryVec, options = {}) {
        if (!this.isConfigured())
            return [];
        const { topK = 5, minSimilarity = 0 } = options;
        const resp = await axios_1.default.post(`${this.url}/collections/${this.collection}/points/search`, { vector: queryVec, limit: topK, score_threshold: minSimilarity, with_payload: true }, { headers: { 'Api-Key': this.apiKey }, timeout: 10000 });
        const result = (resp.data?.result || []);
        return result.map((r) => ({ id: String(r.id), similarity: r.score, payload: r.payload }));
    }
}
class PineconeVectorStore {
    constructor(env = process.env) {
        this.kind = 'pinecone';
        this.env = env;
    }
    get indexHost() {
        return (this.env.PINECONE_INDEX_HOST || '').replace(/\/$/, '');
    }
    get apiKey() {
        return this.env.PINECONE_API_KEY || '';
    }
    isConfigured() {
        return !!this.env.PINECONE_API_KEY && !!this.env.PINECONE_INDEX_HOST;
    }
    async upsert(points, payloads = []) {
        if (!this.isConfigured())
            return;
        const body = {
            vectors: points.map((p, i) => ({
                id: p.id,
                values: p.vector,
                metadata: payloads[i] || p.payload || {},
            })),
        };
        await axios_1.default.post(`${this.indexHost}/vectors/upsert`, body, {
            headers: { 'Api-Key': this.apiKey, 'Content-Type': 'application/json' },
            timeout: 10000,
        });
    }
    async search(queryVec, options = {}) {
        if (!this.isConfigured())
            return [];
        const { topK = 5, minSimilarity = 0 } = options;
        const resp = await axios_1.default.post(`${this.indexHost}/query`, { vector: queryVec, topK, includeMetadata: true, scoreThreshold: minSimilarity }, { headers: { 'Api-Key': this.apiKey }, timeout: 10000 });
        const matches = (resp.data?.matches || []);
        return matches.map((m) => ({ id: m.id, similarity: m.score, payload: m.metadata }));
    }
}
const MEMORY_STORE = new MemoryVectorStore();
function getVectorStore(env = process.env) {
    const kind = selectVectorStoreKind(env);
    if (kind === 'qdrant')
        return new QdrantVectorStore(env);
    if (kind === 'pinecone')
        return new PineconeVectorStore(env);
    return MEMORY_STORE;
}
exports.default = getVectorStore;
//# sourceMappingURL=vector-store.js.map