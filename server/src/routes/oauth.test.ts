/**
 * 第三方 OAuth 登录 + 账号绑定/解绑 集成测试
 *
 * 设计：
 * - 复用真实 auth 路由与真实 requireAuth（JWT 验签路径真实）。
 * - mock `../models/User` 模拟 DB 行为（与既有 Order mock 同一思路），避免依赖真实 MongoDB。
 * - ioredis 已由 setup.ts 替为内存桩，state 校验可直接走通。
 * - 测试环境 NODE_ENV=test 且未配置厂商密钥 → OAUTH_CONFIG.*.mock=true，走 mock 登录路径。
 */

jest.setTimeout(15000);

import express from 'express';
import request from 'supertest';
import { generateToken } from '../middleware/auth';
import authRouter from '../routes/auth';

// ── mock User 模型（内存版，可控行为）──
jest.mock('../models/User', () => {
  const store: { users: any[] } = { users: [] };
  const make = (o: any = {}) => {
    const u: any = {
      _id: o._id || 'user-1',
      email: o.email || 'u1@example.com',
      name: o.name || 'U1',
      role: 'user',
      provider: o.provider || 'local',
      password: 'password' in o ? o.password : 'hashed',
      wechatOpenid: o.wechatOpenid,
      douyinOpenid: o.douyinOpenid,
      toJSON() {
        return {
          id: this._id,
          email: this.email,
          name: this.name,
          provider: this.provider,
          wechatOpenid: this.wechatOpenid,
          douyinOpenid: this.douyinOpenid,
        };
      },
    };
    return u;
  };
  const User: any = {
    __store: store,
    findOne: jest.fn((q: any) => {
      const key = q.wechatOpenid
        ? 'wechatOpenid'
        : q.douyinOpenid
          ? 'douyinOpenid'
          : q.phoneHash
            ? 'phoneHash'
            : q.email
              ? 'email'
              : null;
      const val = key ? q[key] : null;
      const found = store.users.find((u: any) => u[key] === val);
      return Promise.resolve(found || null);
    }),
    findById: jest.fn((id: any) => {
      const found = store.users.find((u: any) => u._id === id);
      return Promise.resolve(found || null);
    }),
    findByIdAndUpdate: jest.fn((id: any, update: any) => {
      const u = store.users.find((x: any) => x._id === id);
      if (u && update.$set) Object.assign(u, update.$set);
      if (u && update.$unset) {
        for (const k of Object.keys(update.$unset)) delete u[k];
      }
      return Promise.resolve(u || null);
    }),
    create: jest.fn((o: any) => {
      const u = make(o);
      store.users.push(u);
      return Promise.resolve(u);
    }),
  };
  return { __esModule: true, User };
});

// 注意：jest.mock 会被自动提升，下面 import 在 mock 生效后执行
import { User } from '../models/User';

const token = generateToken({ id: 'user-1', email: 'u1@example.com', role: 'user' });
const authHeader = (t: string) => ({ Authorization: `Bearer ${t}` });

function mount(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(authRouter);
  return app;
}

function seed(overrides: any = {}) {
  (User as any).__store.users = [
    {
      _id: 'user-1',
      email: 'u1@example.com',
      name: 'U1',
      role: 'user',
      password: 'password' in overrides ? overrides.password : 'hashed',
      wechatOpenid: overrides.wechatOpenid,
      douyinOpenid: overrides.douyinOpenid,
      toJSON() {
        return {
          id: this._id,
          email: this.email,
          name: this.name,
          provider: this.provider,
          wechatOpenid: this.wechatOpenid,
          douyinOpenid: this.douyinOpenid,
        };
      },
    },
  ];
}

describe('OAuth 登录方式可用状态', () => {
  it('GET /login-methods 未配密钥时 enabled=false 但 mock=true', async () => {
    const res = await request(mount()).get('/login-methods');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(true);
    // 测试环境未配置厂商密钥 → enabled=false（前端隐藏真实入口），但 mock=true（开发可用）
    expect(res.body.data.wechat).toBe(false);
    expect(res.body.data.douyin).toBe(false);
    expect(res.body.data.wechatMock).toBe(true);
    expect(res.body.data.douyinMock).toBe(true);
  });
});

describe('微信扫码登录（mock 路径）', () => {
  it('GET /wechat/qr 返回 mock 授权地址并写入 state', async () => {
    const res = await request(mount()).get('/wechat/qr');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mock).toBe(true);
    expect(res.body.state).toBeTruthy();
    expect(res.body.authorizeUrl).toContain('mock://wechat-login');
  });

  it('GET /wechat/callback 用有效 state + code=mock 登录成功并返回 token', async () => {
    const qr = await request(mount()).get('/wechat/qr');
    const state = qr.body.state;
    const res = await request(mount())
      .get(`/wechat/callback?code=mock&state=${state}&format=json`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.provider).toBe('wechat');
  });

  it('GET /wechat/callback 非法/缺失 state 返回 400', async () => {
    const res = await request(mount()).get('/wechat/callback?code=mock&state=not-exist&format=json');
    expect(res.status).toBe(400);
  });
});

describe('抖音扫码登录（mock 路径）', () => {
  it('GET /douyin/qr 返回 mock 授权地址并写入 state', async () => {
    const res = await request(mount()).get('/douyin/qr');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mock).toBe(true);
    expect(res.body.state).toBeTruthy();
    expect(res.body.authorizeUrl).toContain('mock://douyin-login');
  });

  it('GET /douyin/h5 返回 mock 跳转地址', async () => {
    const res = await request(mount()).get('/douyin/h5');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.mock).toBe(true);
  });

  it('GET /douyin/callback 用有效 state + code=mock 登录成功并返回 token', async () => {
    const qr = await request(mount()).get('/douyin/qr');
    const state = qr.body.state;
    const res = await request(mount())
      .get(`/douyin/callback?code=mock&state=${state}&format=json`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.provider).toBe('douyin');
  });

  it('GET /douyin/callback 非法 state 返回 400', async () => {
    const res = await request(mount()).get('/douyin/callback?code=mock&state=bad&format=json');
    expect(res.status).toBe(400);
  });
});

describe('账号绑定鉴权与守卫', () => {
  beforeEach(() => seed({ password: 'hashed' }));

  it('POST /bind/wechat 匿名必须 401', async () => {
    const res = await request(mount()).post('/bind/wechat').send({ code: 'mock' });
    expect(res.status).toBe(401);
  });

  it('POST /bind/wechat 登录用户绑定成功', async () => {
    const res = await request(mount())
      .post('/bind/wechat')
      .set(authHeader(token))
      .send({ code: 'mock' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(User.findByIdAndUpdate).toHaveBeenCalled();
  });

  it('POST /bind/douyin 登录用户绑定成功', async () => {
    const res = await request(mount())
      .post('/bind/douyin')
      .set(authHeader(token))
      .send({ code: 'mock' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('缺少 code 返回 400', async () => {
    const res = await request(mount()).post('/bind/wechat').set(authHeader(token)).send({});
    expect(res.status).toBe(400);
  });
});

describe('账号解绑守卫（防失联）', () => {
  it('POST /unbind/wechat 匿名必须 401', async () => {
    seed({ password: 'hashed', wechatOpenid: 'wx_abc' });
    const res = await request(mount()).post('/unbind/wechat');
    expect(res.status).toBe(401);
  });

  it('有密码时解绑微信成功', async () => {
    seed({ password: 'hashed', wechatOpenid: 'wx_abc' });
    const res = await request(mount()).post('/unbind/wechat').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('无密码且无其他 OAuth 时解绑微信被拒（NEED_PASSWORD）', async () => {
    seed({ password: undefined, wechatOpenid: 'wx_abc', douyinOpenid: undefined });
    const res = await request(mount()).post('/unbind/wechat').set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NEED_PASSWORD');
  });

  it('无密码且无其他 OAuth 时解绑抖音被拒（NEED_PASSWORD）', async () => {
    seed({ password: undefined, douyinOpenid: 'dy_abc', wechatOpenid: undefined });
    const res = await request(mount()).post('/unbind/douyin').set(authHeader(token));
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('NEED_PASSWORD');
  });

  it('未绑定微信时解绑返回 400', async () => {
    seed({ password: 'hashed', wechatOpenid: undefined });
    const res = await request(mount()).post('/unbind/wechat').set(authHeader(token));
    expect(res.status).toBe(400);
  });
});

describe('绑定状态查询', () => {
  beforeEach(() => seed({ password: 'hashed', wechatOpenid: 'wx_abc', douyinOpenid: undefined }));

  it('GET /bindings 匿名必须 401', async () => {
    const res = await request(mount()).get('/bindings');
    expect(res.status).toBe(401);
  });

  it('GET /bindings 返回当前绑定状态', async () => {
    const res = await request(mount()).get('/bindings').set(authHeader(token));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.wechat.bound).toBe(true);
    expect(res.body.data.douyin.bound).toBe(false);
    expect(res.body.data.hasPassword).toBe(true);
  });
});
