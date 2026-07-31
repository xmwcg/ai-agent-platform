import axios from 'axios';
import express from 'express';
import request from 'supertest';
import aibakChatRoutes from './aibak-chat';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/aibak', aibakChatRoutes);
  return app;
}

describe('AIBAK AI 状态接口契约', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('上游可用时返回 安全代理方法信息且不暴露不存在的 URL 字段', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { success: true } });

    const response = await request(createApp()).get('/api/aibak/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.knowledgeGateway).toEqual(expect.objectContaining({
      available: expect.any(Boolean),
      method: 'cloud-function-proxy',
      env: expect.any(String),
      models: expect.any(Array),
    }));
    expect(response.body.knowledgeGateway).not.toHaveProperty('url');
  });

  it('上游不可用时保持相同的安全代理状态响应结构', async () => {
    mockedAxios.post.mockRejectedValueOnce(new Error('upstream unavailable'));

    const response = await request(createApp()).get('/api/aibak/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(false);
    expect(response.body.knowledgeGateway).toEqual(expect.objectContaining({
      available: expect.any(Boolean),
      method: 'cloud-function-proxy',
      env: expect.any(String),
      models: expect.any(Array),
    }));
    expect(response.body.knowledgeGateway).not.toHaveProperty('url');
  });
});
