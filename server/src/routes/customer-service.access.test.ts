/**
 * 公开嵌入客服隔离回归：访客不能通过绑定 ID、向量 payload、
 * 向量失败回退取得私有、跨团队或付费文档正文。
 */
import express from 'express';
import request from 'supertest';
import router from './customer-service';
import { buildRagAccessFilter } from '../services/rag-access';

jest.mock('../middleware/subscription', () => ({
  __esModule: true,
  enforceQuota: () => (_req: any, _res: any, next: any) => next(),
  quotaIncrement: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../models/CustomerService', () => {
  const actual = jest.requireActual('../models/CustomerService');
  return {
    __esModule: true,
    ...actual,
    CustomerService: { findOne: jest.fn(), findByIdAndUpdate: jest.fn() },
    CustomerServiceSession: { findOne: jest.fn(), create: jest.fn() },
    CustomerServiceAuditLog: { create: jest.fn() },
  };
});
jest.mock('../models/KnowledgeDocument', () => ({
  KnowledgeDocument: { find: jest.fn() },
}));
jest.mock('../services/embedding', () => ({
  embeddingService: { searchSimilarDocuments: jest.fn() },
}));

const { CustomerService, CustomerServiceSession, CustomerServiceAuditLog } = require('../models/CustomerService');
const { KnowledgeDocument } = require('../models/KnowledgeDocument');
const { embeddingService } = require('../services/embedding');

const bot = {
  _id: 'bot-1',
  name: '公开客服',
  embedCode: 'embed-1',
  enabled: true,
  knowledgeBaseIds: ['doc-public', 'doc-private', 'doc-paid'],
  ownerId: 'author-1',
  teamId: 'team-1',
  handoffEnabled: false,
  fallbackMessage: '暂无可公开回答的依据',
  welcomeMessage: '你好',
};

const doc = {
  _id: 'doc-public',
  title: '公开免费文档',
  content: '这是已核验的公开正文',
  isPublic: true,
  requiredPlan: 'free',
};

const app = express();
app.use(express.json());
app.use('/api/customer-service', router);

const oldMockMode = process.env.ENABLE_MOCK_MODE;
beforeAll(() => { process.env.ENABLE_MOCK_MODE = 'true'; });
afterAll(() => {
  if (oldMockMode === undefined) delete process.env.ENABLE_MOCK_MODE;
  else process.env.ENABLE_MOCK_MODE = oldMockMode;
});
beforeEach(() => {
  jest.clearAllMocks();
  CustomerService.findOne.mockResolvedValue(bot);
  CustomerService.findByIdAndUpdate.mockResolvedValue({});
  CustomerServiceSession.findOne.mockResolvedValue(null);
  CustomerServiceSession.create.mockResolvedValue({
    _id: 'session-1', visitorId: 'anon-1', messages: [],
    save: jest.fn().mockResolvedValue(undefined),
  });
  CustomerServiceAuditLog.create.mockResolvedValue({});
  KnowledgeDocument.find.mockResolvedValue([doc]);
  embeddingService.searchSimilarDocuments.mockResolvedValue([]);
});

describe('公开客服 RAG 数据边界', () => {
  it('Mongo 查询限制绑定 ID 且必须公开、免费、可阅读全文', async () => {
    const res = await request(app)
      .post('/api/customer-service/chat/embed-1')
      .send({ message: '查知识库' });

    expect(res.status).toBe(200);
    const filter = buildRagAccessFilter();
    expect(KnowledgeDocument.find).toHaveBeenCalledWith({
      _id: { $in: bot.knowledgeBaseIds },
      ...filter,
    });
    expect(embeddingService.searchSimilarDocuments).toHaveBeenCalledWith('查知识库', {
      limit: 5, minSimilarity: 0.6, filter,
    });
    expect(res.body.data.sources).toHaveLength(1);
    expect(res.body.data.sources[0].docId).toBe('doc-public');
  });

  it('远程向量假冒同一 ID 的正文及未授权 ID 都不会进入答案或引用', async () => {
    embeddingService.searchSimilarDocuments.mockResolvedValue([
      { document: { _id: 'doc-private', title: '私密文档', content: '机密泄露' }, similarity: 1 },
      { document: { _id: 'doc-public', title: '伪造标题', content: '伪造正文泄露' }, similarity: 0.9 },
      { document: { _id: 'doc-paid', title: '付费正文', content: '付费内容泄露' }, similarity: 0.8 },
    ]);

    const res = await request(app)
      .post('/api/customer-service/chat/embed-1')
      .send({ message: '查知识库' });

    expect(res.status).toBe(200);
    expect(res.body.data.sources).toHaveLength(1);
    expect(res.body.data.sources[0]).toMatchObject({
      docId: 'doc-public', title: '公开免费文档',
      snippet: '这是已核验的公开正文',
    });
    expect(JSON.stringify(res.body)).not.toMatch(/机密泄露|伪造正文泄露|付费内容泄露/);
  });

  it('向量服务失败时只回退到经权限过滤的公开全文', async () => {
    embeddingService.searchSimilarDocuments.mockRejectedValue(new Error('向量不可用'));

    const res = await request(app)
      .post('/api/customer-service/chat/embed-1')
      .send({ message: '退款规则' });

    expect(res.status).toBe(200);
    expect(res.body.data.sources.map((s: any) => s.docId)).toEqual(['doc-public']);
    expect(res.body.data.reply).toContain('这是已核验的公开正文');
  });

  it('绑定文档全部不符合公开全文条件时，不读取向量也不返回来源', async () => {
    KnowledgeDocument.find.mockResolvedValue([]);

    const res = await request(app)
      .post('/api/customer-service/chat/embed-1')
      .send({ message: '查私有文档' });

    expect(res.status).toBe(200);
    expect(embeddingService.searchSimilarDocuments).not.toHaveBeenCalled();
    expect(res.body.data.reply).toBe('暂无可公开回答的依据');
    expect(res.body.data.sources).toEqual([]);
  });
});
