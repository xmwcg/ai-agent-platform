/**
 * 请求关联 ID 中间件单测（可观测性）
 */
import express, { Request } from 'express';
import request from 'supertest';
import { requestIdMiddleware, REQUEST_ID_HEADER } from './request-id';

const app = express();
app.use(requestIdMiddleware);
app.get('/ping', (req: Request, res) => {
  res.json({ id: (req as Request & { requestId?: string }).requestId });
});

describe('request-id 中间件', () => {
  it('为每个请求生成 X-Request-Id 并回传响应头', async () => {
    const res = await request(app).get('/ping');
    expect(res.status).toBe(200);
    const header = res.headers['x-request-id'];
    expect(header).toBeTruthy();
    expect(res.body.id).toBe(header);
  });

  it('沿用上游传入的 X-Request-Id（跨服务串联）', async () => {
    const res = await request(app).get('/ping').set(REQUEST_ID_HEADER, 'abc-123');
    expect(res.headers['x-request-id']).toBe('abc-123');
    expect(res.body.id).toBe('abc-123');
  });
});
