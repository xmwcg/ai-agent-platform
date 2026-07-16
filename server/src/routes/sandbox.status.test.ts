import express from 'express';
import request from 'supertest';
import sandboxRoutes from './sandbox';

describe('GET /api/sandbox/status', () => {
  it('is a public read-only deployment probe', async () => {
    const app = express();
    app.use('/api/sandbox', sandboxRoutes);

    const response = await request(app).get('/api/sandbox/status');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toEqual(expect.objectContaining({
      defaultMode: expect.any(String),
      providers: expect.any(Array),
      supportedLanguages: expect.any(Array),
    }));
  });
});
