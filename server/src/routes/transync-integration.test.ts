import express from 'express';
import request from 'supertest';

jest.mock('../middleware/auth', () => ({
  requireAuth: (req: any, _res: any, next: any) => {
    req.user = { id: 'user-1', email: 'member@example.com', role: 'user' };
    next();
  },
}));

jest.mock('../models/User', () => ({
  User: {
    findById: jest.fn(async () => ({
      _id: { toString: () => 'user-1' },
      email: 'member@example.com',
      emailVerified: true,
      name: 'AIbak Member',
      avatar: '',
      role: 'user',
      plan: 'pro',
      membershipExpiresAt: new Date('2026-08-22T00:00:00.000Z'),
      isBanned: false,
    })),
  },
}));


jest.mock('../middleware/subscription', () => ({
  resolveUserPlan: jest.fn(async () => ({ plan: 'pro', expired: false })),
}));

jest.mock('../config/database', () => {
  const store = new Map<string, string>();
  return {
    redisClient: {
      __store: store,
      setex: jest.fn(async (key: string, _ttl: number, value: string) => {
        store.set(key, value);
        return 'OK';
      }),
      getdel: jest.fn(async (key: string) => {
        const value = store.get(key) || null;
        store.delete(key);
        return value;
      }),
    },
  };
});

import router from './transync-integration';
import { redisClient } from '../config/database';
import { resolveUserPlan } from '../middleware/subscription';

function mount() {
  const app = express();
  app.use(express.json());
  app.use(router);
  return app;
}

describe('TranSync one-time authorization code flow', () => {
  beforeEach(() => {
    process.env.TRANSYNC_BASE_URL = 'https://translate.aibak.site';
    process.env.TRANSYNC_SSO_CLIENT_SECRET = 's'.repeat(64);
    (redisClient as any).__store.clear();
    (resolveUserPlan as jest.Mock).mockResolvedValue({ plan: 'pro', expired: false });
  });

  it('issues a short-lived code and allows exactly one server exchange', async () => {
    const state = 'a'.repeat(43);
    const issued = await request(mount()).post('/tickets').send({ state, next: '/billing?from=aibak' });
    expect(issued.status).toBe(200);
    const authorizeUrl = new URL(issued.body.data.authorizeUrl);
    expect(authorizeUrl.origin).toBe('https://translate.aibak.site');
    expect(authorizeUrl.searchParams.get('state')).toBe(state);
    const code = authorizeUrl.searchParams.get('code');
    expect(code).toBeTruthy();

    const first = await request(mount())
      .post('/exchange')
      .set('x-transync-sso-secret', process.env.TRANSYNC_SSO_CLIENT_SECRET!)
      .send({ code });
    expect(first.status).toBe(200);
    expect(first.body.data.subject).toBe('user-1');
    expect(first.body.data.plan).toBe('pro');
    expect(first.body.data.next).toBe('/billing?from=aibak');
    expect(first.headers['cache-control']).toContain('no-store');

    const replay = await request(mount())
      .post('/exchange')
      .set('x-transync-sso-secret', process.env.TRANSYNC_SSO_CLIENT_SECRET!)
      .send({ code });
    expect(replay.status).toBe(410);
  });


  it('会员过期时授权码降级为免费套餐，不信任 User.plan 缓存字段', async () => {
    (resolveUserPlan as jest.Mock).mockResolvedValue({ plan: 'free', expired: true });
    const state = 'b'.repeat(43);
    const issued = await request(mount()).post('/tickets').send({ state, next: '/app' });
    const code = new URL(issued.body.data.authorizeUrl).searchParams.get('code');

    const exchanged = await request(mount())
      .post('/exchange')
      .set('x-transync-sso-secret', process.env.TRANSYNC_SSO_CLIENT_SECRET!)
      .send({ code });

    expect(exchanged.status).toBe(200);
    expect(exchanged.body.data.plan).toBe('free');
  });

  it('rejects untrusted exchange clients', async () => {
    const response = await request(mount())
      .post('/exchange')
      .set('x-transync-sso-secret', 'x'.repeat(64))
      .send({ code: 'c'.repeat(43) });
    expect(response.status).toBe(401);
  });
});
