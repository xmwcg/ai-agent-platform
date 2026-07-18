import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { User } from '../models/User';
import { PlatformAuditLog } from '../models/PlatformAuditLog';
import { logPlatformAudit } from '../services/platform-audit.service';
import { generateAccessToken, generateRefreshToken, hashRefreshToken, setRefreshTokenCookie, clearRefreshTokenCookie, generateDeviceFingerprint, requireAuth, AuthRequest } from '../middleware/auth';
import { requireAdmin } from '../middleware/requireAdmin';
import { authLimiter } from '../middleware/rate-limit';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import { redisClient } from '../config/database';
import { logger } from '../lib/logger';
import { processReferralOnRegister } from '../services/referral.service';
import { phoneHash, normalizePhone, maskPhone, encryptField } from '../lib/field-crypto';
import { OAUTH_CONFIG } from '../config/oauth';
import { AuthSession } from '../models/AuthSession';
import { ConsentRecord } from '../models/ConsentRecord';
import { writeAuditLogAsync, writeAuditLog } from '../services/security-audit.service';

const router = Router();

/** 中国大陆手机号校验 */
function isCnPhone(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s);
}

// 注册输入校验（email 格式 + 密码长度 + 用户名长度）
const registerSchema: ValidationSchema = {
  email: { required: true, type: 'string', isEmail: true, maxLength: 254 },
  password: { required: true, type: 'string', minLength: 10, maxLength: 64 },
  name: { required: true, type: 'string', minLength: 1, maxLength: 50 },
};

// 登录输入校验
const loginSchema: ValidationSchema = {
  email: { required: true, type: 'string', isEmail: true, maxLength: 254 },
  password: { required: true, type: 'string', minLength: 1, maxLength: 64 },
};

// 注册
router.post('/register', authLimiter, validate(registerSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password, name, referralCode, acceptTerms, acceptPrivacy } = req.body;

    // 协议合规：注册必须勾选用户协议和隐私政策
    if (!acceptTerms || !acceptPrivacy) {
      return res.status(400).json({
        error: '请阅读并同意《用户服务协议》和《隐私政策》',
        code: 'CONSENT_REQUIRED',
      });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    // 处理推荐码
    let referredBy: string | undefined;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode });
      if (referrer) {
        referredBy = referrer._id.toString();
      }
    }

    const user = await User.create({
      email,
      password,
      name,
      ...(referredBy ? { referredBy: referredBy } : {}),
    });

    // 记录协议同意
    await ConsentRecord.create([
      {
        userId: user._id,
        consentType: 'terms_of_service',
        version: 'TOU_v1',
        accepted: true,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        channel: 'web',
      },
      {
        userId: user._id,
        consentType: 'privacy_policy',
        version: 'PRIVACY_v1',
        accepted: true,
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || '',
        channel: 'web',
      },
    ]);

        const jti = require('crypto').randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const deviceFingerprint = generateDeviceFingerprint(req);

    // 创建 AuthSession
    await AuthSession.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: tokenHash,
      accessTokenJti: jti,
      deviceFingerprint,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 设置刷新令牌 Cookie
    setRefreshTokenCookie(res, refreshToken);

    const token = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role, jti });

    // 异步处理推荐关系（不阻塞注册响应）
    if (referralCode) {
      processReferralOnRegister(user._id.toString(), referralCode).catch((err) => {
        logger.error('auth', `推荐处理失败: ${err.message}`);
      });
    }

    res.status(201).json({
      success: true,
      token,
      user: user.toJSON(),
    });
  } catch (error) {
    logger.error('auth', `注册失败: ${(error as Error)?.stack || error}`);
    sendError(res, error);
  }
});

// 登录
router.post('/login', authLimiter, validate(loginSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }
    if (user.isBanned) {
      return res.status(403).json({ error: '该账号已被封禁，请联系管理员' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const jti = require('crypto').randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const deviceFingerprint = generateDeviceFingerprint(req);

    // 创建 AuthSession
    await AuthSession.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: tokenHash,
      accessTokenJti: jti,
      deviceFingerprint,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 设置刷新令牌 Cookie
    setRefreshTokenCookie(res, refreshToken);

    const token = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role, jti });

    res.json({
      success: true,
      token,
      user: user.toJSON()
    });
  } catch (error) {
    logger.error('auth', `登录失败: ${(error as Error)?.stack || error}`);
    sendError(res, error);
  }
});

// 获取当前用户信息
router.get('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    sendError(res, error);
  }
});

// 更新用户信息
router.put('/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user!.id,
      { $set: { ...(name && { name }), ...(avatar && { avatar }) } },
      { new: true }
    );
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }
    res.json({ success: true, user: user.toJSON() });
  } catch (error) {
    sendError(res, error);
  }
});

// ===================== 手机号 + 验证码登录 =====================
const smsSendSchema: ValidationSchema = {
  phone: { required: true, type: 'string', pattern: '^1[3-9]\\d{9}$' },
};
const smsLoginSchema: ValidationSchema = {
  phone: { required: true, type: 'string', pattern: '^1[3-9]\\d{9}$' },
  code: { required: true, type: 'string', minLength: 4, maxLength: 8 },
};

// 发送验证码（开发态 Mock：直接返回 code 便于测试；生产接短信服务商）
router.post('/sms/send', authLimiter, validate(smsSendSchema), async (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ success: false, error: '短信登录暂未开放' });
  }
  try {
    const { phone } = req.body as { phone: string };
    const rawPhone = normalizePhone(phone);
    const hash = phoneHash(phone); // 用 hash 做 Redis key，保护隐私
    // 同手机号 60s 限频（key 使用 hash 而非明文）
    const limitKey = `sms:limit:${hash}`;
    if (await redisClient.get(limitKey)) {
      return res.status(429).json({ error: '验证码发送过于频繁，请稍后再试' });
    }
    const code = crypto.randomInt(100000, 999999).toString();
    await redisClient.set(`sms:code:${hash}`, code, 'EX', 300);
    await redisClient.set(limitKey, '1', 'EX', 60);

    const isMock = (process.env.SMS_MOCK || process.env.NODE_ENV !== 'production') === 'true' || process.env.NODE_ENV !== 'production';
    if (isMock || !process.env.SMS_PROVIDER) {
      logger.info('auth', `[SMS Mock] 向 ${maskPhone(rawPhone)} 发送验证码: ${code}`);
    } else {
      // 真实短信服务商接入点（阿里云/腾讯云）：在此调用对应 SDK 发送 code
      logger.info('auth', `[SMS ${process.env.SMS_PROVIDER}] 向 ${maskPhone(rawPhone)} 发送验证码(真实)`);
    }
    const payload: any = { success: true, message: '验证码已发送' };
    if (isMock) payload.devCode = code; // 仅开发态回显，便于联调/测试
    res.json(payload);
  } catch (err) {
    sendError(res, err);
  }
});

// 验证码登录/注册（手机号不存在则自动注册）
router.post('/sms/login', authLimiter, validate(smsLoginSchema), async (req: AuthRequest, res: Response) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(503).json({ success: false, error: '短信登录暂未开放' });
  }
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const rawPhone = normalizePhone(phone);
    const hash = phoneHash(phone);
    const stored = await redisClient.get(`sms:code:${hash}`);
    if (!stored || stored !== code) {
      return res.status(400).json({ error: '验证码错误或已过期' });
    }
    await redisClient.del(`sms:code:${hash}`);

    // 通过 phoneHash 查找用户（隐私保护：不存明文手机号）
    let user = await User.findOne({ phoneHash: hash });
    if (!user) {
      // 自动注册：加密手机号落库，生成随机密码
      const rand = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
      user = await User.create({
        phone: encryptField(rawPhone), // 预加密（避免被 pre-save 二次加密）
        phoneHash: hash,
        password: rand,
        name: `用户${rawPhone.slice(-4)}`,
        provider: 'local',
        email: `phone_${Date.now()}@phone.local`,
      });
    }
    const jti = require('crypto').randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const deviceFingerprint = generateDeviceFingerprint(req);

    // 创建 AuthSession
    await AuthSession.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: tokenHash,
      accessTokenJti: jti,
      deviceFingerprint,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 设置刷新令牌 Cookie
    setRefreshTokenCookie(res, refreshToken);

    const token = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role, jti });
    res.json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    sendError(res, err);
  }
});

// 登录方式可用状态：前端据此动态显示/隐藏入口；缺密钥自动隐藏，不影响其他功能上线
router.get('/login-methods', async (_req: Request, res: Response) => {
  const wechatEnabled = OAUTH_CONFIG.wechat.enabled;
  const douyinEnabled = OAUTH_CONFIG.douyin.enabled;
  // 当前代码尚未接入真实短信 SDK；生产必须隐藏入口并拒绝请求。
  const smsEnabled = process.env.NODE_ENV !== 'production' && !!process.env.SMS_PROVIDER;
  res.json({
    success: true,
    data: {
      email: true,
      wechat: wechatEnabled,
      douyin: douyinEnabled,
      sms: smsEnabled,
      // Mock 模式下也显示入口，便于前端开发
      wechatMock: OAUTH_CONFIG.wechat.mock,
      douyinMock: OAUTH_CONFIG.douyin.mock,
    },
  });
});

// ===================== 微信扫码登录（OAuth2 网站应用） =====================
// 生成扫码登录入口：返回需渲染为二维码的 authorizeUrl（开发态 Mock 可直接走通）
router.get('/wechat/qr', async (_req: Request, res: Response) => {
  try {
    const configured = !!(process.env.WECHAT_OPEN_APPID && process.env.WECHAT_OPEN_SECRET);
    if (process.env.NODE_ENV === 'production' && !configured) {
      return res.status(503).json({ success: false, error: '微信登录暂未开放' });
    }
    const mock = process.env.NODE_ENV !== 'production'
      && (process.env.WECHAT_LOGIN_MOCK === 'true' || !configured);
    if (mock) {
      const state = crypto.randomBytes(8).toString('hex');
      await redisClient.set(`wechat:state:${state}`, '1', 'EX', 600);
      return res.json({ success: true, mock: true, authorizeUrl: `mock://wechat-login?state=${state}`, state });
    }
    const appId = process.env.WECHAT_OPEN_APPID!;
    const redirectUri = encodeURIComponent(process.env.WECHAT_LOGIN_REDIRECT || `${process.env.PUBLIC_BASE_URL}/api/auth/wechat/callback`);
    const state = crypto.randomBytes(8).toString('hex');
    await redisClient.set(`wechat:state:${state}`, '1', 'EX', 600);
    const authorizeUrl = `https://open.weixin.qq.com/connect/qrconnect?appid=${appId}&redirect_uri=${redirectUri}&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`;
    res.json({ success: true, mock: false, authorizeUrl, state });
  } catch (err) {
    sendError(res, err);
  }
});

// 微信回调：code 换 openid，登录/注册，返回 token（支持 ?format=json 便于测试/Mock）
router.get('/wechat/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const format = (req.query as any).format;
    const configured = !!(process.env.WECHAT_OPEN_APPID && process.env.WECHAT_OPEN_SECRET);
    if (process.env.NODE_ENV === 'production' && (!configured || code === 'mock')) {
      return res.status(503).json({ success: false, error: '微信登录不可用' });
    }
    if (!state || !(await redisClient.get(`wechat:state:${state}`))) {
      return res.status(400).json({ error: '非法的登录态' });
    }
    await redisClient.del(`wechat:state:${state}`);

    let openid: string;
    if (process.env.NODE_ENV !== 'production' && (code === 'mock' || !configured)) {
      openid = `mock_openid_${state.slice(0, 6)}`;
    } else {
      const tokenResp = await axios.get('https://api.weixin.qq.com/sns/oauth2/access_token', {
        params: {
          appid: process.env.WECHAT_OPEN_APPID,
          secret: process.env.WECHAT_OPEN_SECRET,
          code,
          grant_type: 'authorization_code',
        },
      });
      openid = tokenResp.data?.openid;
      if (!openid) return res.status(400).json({ error: '微信授权失败' });
    }

    let user = await User.findOne({ wechatOpenid: openid });
    if (!user) {
      user = await User.create({
        wechatOpenid: openid,
        password: crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, ''),
        name: '微信用户',
        provider: 'wechat',
        providerId: openid,
        email: `${openid}@wechat.local`,
      });
    }
    const jti = require('crypto').randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const deviceFingerprint = generateDeviceFingerprint(req);

    // 创建 AuthSession
    await AuthSession.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: tokenHash,
      accessTokenJti: jti,
      deviceFingerprint,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 设置刷新令牌 Cookie
    setRefreshTokenCookie(res, refreshToken);

    const token = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role, jti });

    if (format === 'json') {
      return res.json({ success: true, token, user: user.toJSON() });
    }
    // 前端弹窗扫码：回调页把 token 发给 opener 并关闭；移动端整页跳转（无 opener）则暂存 token 由 SPA 回收
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<html><body><script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type:'wechat_login', token:'${token}' }, '*');
          window.close();
        } else {
          try { localStorage.setItem('oauth_pending_token', '${token}'); } catch(e){}
          window.location.replace('/');
        }
      } catch(e){ window.location.replace('/'); }
    </script>登录成功，正在返回…</body></html>`);
  } catch (err) {
    sendError(res, err);
  }
});

// ===================== 管理员：用户权限管理 =====================
// 用户列表（支持邮箱/名称搜索 + 分页），仅管理员可访问
router.get('/admin/users', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const search = ((req.query.search as string) || '').trim();
    const filter: any = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
      ];
    }
    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    res.json({
      success: true,
      users: users.map((u) => u.toJSON()),
      pagination: { page, limit: pageSize, total },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// 修改用户角色（user / admin）
router.put('/admin/users/:id/role', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: '角色必须是 user 或 admin' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    // 防止把唯一管理员降级导致系统锁死
    if (target.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });
      if (adminCount <= 1) return res.status(400).json({ error: '至少保留一名管理员' });
    }
    const oldRole = target.role;
    target.role = role;
    await target.save();
    logPlatformAudit({
      actorId: req.user!.id,
      action: 'user_role_changed',
      targetId: target._id.toString(),
      detail: { oldRole, newRole: role },
    });
    res.json({ success: true, user: target.toJSON() });
  } catch (error) {
    sendError(res, error);
  }
});

// 封禁 / 解封账号
router.put('/admin/users/:id/ban', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const { banned } = req.body;
    if (typeof banned !== 'boolean') {
      return res.status(400).json({ error: 'banned 必须为布尔值' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: '用户不存在' });
    // 不允许封禁当前登录账号
    if (target._id.toString() === req.user!.id) {
      return res.status(400).json({ error: '不能封禁当前登录账号' });
    }
    target.isBanned = banned;
    await target.save();
    logPlatformAudit({
      actorId: req.user!.id,
      action: banned ? 'user_banned' : 'user_unbanned',
      targetId: target._id.toString(),
      detail: { banned },
    });
    res.json({ success: true, user: target.toJSON() });
  } catch (error) {
    sendError(res, error);
  }
});

// 平台审计日志查看（管理员操作留痕），支持 action 过滤 + 分页
router.get('/admin/audit', requireAuth, requireAdmin, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt((req.query.page as string) || '1', 10));
    const pageSize = Math.min(100, Math.max(1, parseInt((req.query.limit as string) || '20', 10)));
    const action = (req.query.action as string) || '';
    const filter: Record<string, unknown> = {};
    if (action) filter.action = action;
    const total = await PlatformAuditLog.countDocuments(filter);
    const logs = await PlatformAuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize);
    res.json({
      success: true,
      logs: logs.map((l) => ({
        id: l._id.toString(),
        actorId: l.actorId,
        action: l.action,
        targetId: l.targetId,
        detail: l.detail,
        createdAt: l.createdAt,
      })),
      pagination: { page, limit: pageSize, total },
    });
  } catch (error) {
    sendError(res, error);
  }
});

// ===================== 抖音扫码登录（OAuth2 网站应用） =====================
// 抖音 OAuth 与微信的关键差异：
// 1. 参数名 client_key（非 appid）；2. token 用 POST（微信 GET）；3. scope=user_info

// 生成抖音扫码登录入口（PC 端弹出二维码）
router.get('/douyin/qr', async (_req: Request, res: Response) => {
  try {
    const cfg = OAUTH_CONFIG.douyin;
    if (process.env.NODE_ENV === 'production' && !cfg.enabled) {
      return res.status(503).json({ success: false, error: '抖音登录暂未开放' });
    }
    const state = crypto.randomBytes(8).toString('hex');
    await redisClient.set(`douyin:state:${state}`, '1', 'EX', 600);

    if (cfg.mock) {
      return res.json({ success: true, mock: true, authorizeUrl: `mock://douyin-login?state=${state}`, state });
    }

    const redirectUri = encodeURIComponent(cfg.redirectUri);
    const authorizeUrl = `${cfg.authorizeUrl}?client_key=${cfg.clientId}&response_type=code&scope=${cfg.scope}&redirect_uri=${redirectUri}&state=${state}`;
    res.json({ success: true, mock: false, authorizeUrl, state });
  } catch (err) {
    sendError(res, err);
  }
});

// 抖音 H5 跳转授权（移动端直接跳转，不弹窗）
router.get('/douyin/h5', async (_req: Request, res: Response) => {
  try {
    const cfg = OAUTH_CONFIG.douyin;
    if (process.env.NODE_ENV === 'production' && !cfg.enabled) {
      return res.status(503).json({ success: false, error: '抖音登录暂未开放' });
    }
    const state = crypto.randomBytes(8).toString('hex');
    await redisClient.set(`douyin:state:${state}`, '1', 'EX', 600);

    if (cfg.mock) {
      return res.json({ success: true, mock: true, authorizeUrl: `mock://douyin-h5?state=${state}`, state });
    }

    const redirectUri = encodeURIComponent(cfg.redirectUri);
    const authorizeUrl = `${cfg.authorizeUrl}?client_key=${cfg.clientId}&response_type=code&scope=${cfg.scope}&redirect_uri=${redirectUri}&state=${state}`;
    res.json({ success: true, mock: false, authorizeUrl, state });
  } catch (err) {
    sendError(res, err);
  }
});

// 抖音回调：code 换 access_token + openid，登录/注册，返回 token
router.get('/douyin/callback', async (req: Request, res: Response) => {
  try {
    const { code, state } = req.query as { code?: string; state?: string };
    const format = (req.query as any).format;
    const cfg = OAUTH_CONFIG.douyin;

    if (process.env.NODE_ENV === 'production' && (!cfg.enabled || code === 'mock')) {
      return res.status(503).json({ success: false, error: '抖音登录不可用' });
    }
    if (!state || !(await redisClient.get(`douyin:state:${state}`))) {
      return res.status(400).json({ error: '非法的登录态' });
    }
    await redisClient.del(`douyin:state:${state}`);

    let openid: string;
    let unionid: string | undefined;
    let nickname: string | undefined;
    let avatar: string | undefined;

    if (cfg.mock && code !== 'mock_real') {
      // Mock 模式：生成模拟 openid，便于前端开发
      openid = `mock_douyin_openid_${state.slice(0, 6)}`;
      nickname = '抖音用户';
    } else {
      // 抖音获取 access_token：POST 请求（与微信 GET 不同）
      const tokenResp = await axios.post(cfg.tokenUrl, {
        client_key: cfg.clientId,
        client_secret: cfg.clientSecret,
        code,
        grant_type: 'authorization_code',
      }, {
        headers: { 'Content-Type': 'application/json' },
      });
      openid = tokenResp.data?.data?.open_id;
      const accessToken = tokenResp.data?.data?.access_token;
      if (!openid) return res.status(400).json({ error: '抖音授权失败' });

      // 获取用户信息（openid + unionid + 昵称 + 头像）
      const userinfoResp = await axios.get(cfg.userinfoUrl, {
        params: { access_token: accessToken, open_id: openid },
      });
      unionid = userinfoResp.data?.data?.union_id;
      nickname = userinfoResp.data?.data?.nickname;
      avatar = userinfoResp.data?.data?.avatar;
    }

    let user = await User.findOne({ douyinOpenid: openid });
    if (!user) {
      user = await User.create({
        douyinOpenid: openid,
        ...(unionid ? { douyinUnionid: unionid } : {}),
        password: crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, ''),
        name: nickname || '抖音用户',
        ...(avatar ? { avatar } : {}),
        provider: 'douyin',
        providerId: openid,
        email: `douyin_${openid.slice(-12)}@douyin.local`,
      });
    }
    const jti = require('crypto').randomUUID();
    const refreshToken = generateRefreshToken();
    const tokenHash = hashRefreshToken(refreshToken);
    const deviceFingerprint = generateDeviceFingerprint(req);

    // 创建 AuthSession
    await AuthSession.create({
      userId: user._id,
      refreshToken,
      refreshTokenHash: tokenHash,
      accessTokenJti: jti,
      deviceFingerprint,
      userAgent: req.headers['user-agent'] || '',
      ipAddress: req.ip || req.socket.remoteAddress || '',
      status: 'active',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    // 设置刷新令牌 Cookie
    setRefreshTokenCookie(res, refreshToken);

    const token = generateAccessToken({ id: user._id.toString(), email: user.email, role: user.role, jti });

    if (format === 'json') {
      return res.json({ success: true, token, user: user.toJSON() });
    }
    // 前端弹窗扫码：回调页把 token 发给 opener 并关闭；移动端整页跳转（无 opener）则暂存 token 由 SPA 回收
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<html><body><script>
      try {
        if (window.opener) {
          window.opener.postMessage({ type:'douyin_login', token:'${token}' }, '*');
          window.close();
        } else {
          try { localStorage.setItem('oauth_pending_token', '${token}'); } catch(e){}
          window.location.replace('/');
        }
      } catch(e){ window.location.replace('/'); }
    </script>登录成功，正在返回…</body></html>`);
  } catch (err) {
    sendError(res, err);
  }
});

// ===================== 账号绑定 / 解绑 =====================

// 查询当前用户已绑定的第三方账号
router.get('/bindings', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    res.json({
      success: true,
      data: {
        email: user.email,
        hasPassword: !!user.password,
        wechat: user.wechatOpenid ? { bound: true } : { bound: false },
        douyin: user.douyinOpenid ? { bound: true } : { bound: false },
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

// 绑定微信（已登录用户，通过 OAuth code 绑定到当前账号）
router.post('/bind/wechat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code: string };
    if (!code) return res.status(400).json({ error: '缺少授权 code' });
    const cfg = OAUTH_CONFIG.wechat;
    if (process.env.NODE_ENV === 'production' && !cfg.enabled) {
      return res.status(503).json({ success: false, error: '微信登录暂未开放' });
    }

    let openid: string;
    if (cfg.mock || code === 'mock') {
      openid = `mock_openid_bind_${Date.now().toString(36)}`;
    } else {
      const tokenResp = await axios.get(cfg.tokenUrl, {
        params: { appid: cfg.clientId, secret: cfg.clientSecret, code, grant_type: 'authorization_code' },
      });
      openid = tokenResp.data?.openid;
      if (!openid) return res.status(400).json({ error: '微信授权失败' });
    }

    // 检查 openid 是否已被其他账号绑定
    const existing = await User.findOne({ wechatOpenid: openid });
    if (existing && existing._id.toString() !== req.user!.id) {
      return res.status(409).json({ error: '该微信已绑定其他账号' });
    }

    await User.findByIdAndUpdate(req.user!.id, { $set: { wechatOpenid: openid } });
    res.json({ success: true, message: '微信绑定成功' });
  } catch (err) {
    sendError(res, err);
  }
});

// 绑定抖音
router.post('/bind/douyin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { code } = req.body as { code: string };
    if (!code) return res.status(400).json({ error: '缺少授权 code' });
    const cfg = OAUTH_CONFIG.douyin;
    if (process.env.NODE_ENV === 'production' && !cfg.enabled) {
      return res.status(503).json({ success: false, error: '抖音登录暂未开放' });
    }

    let openid: string;
    let unionid: string | undefined;
    if (cfg.mock || code === 'mock') {
      openid = `mock_douyin_bind_${Date.now().toString(36)}`;
    } else {
      const tokenResp = await axios.post(cfg.tokenUrl, {
        client_key: cfg.clientId, client_secret: cfg.clientSecret, code, grant_type: 'authorization_code',
      }, { headers: { 'Content-Type': 'application/json' } });
      openid = tokenResp.data?.data?.open_id;
      const accessToken = tokenResp.data?.data?.access_token;
      if (!openid) return res.status(400).json({ error: '抖音授权失败' });
      const userinfoResp = await axios.get(cfg.userinfoUrl, { params: { access_token: accessToken, open_id: openid } });
      unionid = userinfoResp.data?.data?.union_id;
    }

    const existing = await User.findOne({ douyinOpenid: openid });
    if (existing && existing._id.toString() !== req.user!.id) {
      return res.status(409).json({ error: '该抖音已绑定其他账号' });
    }

    await User.findByIdAndUpdate(req.user!.id, {
      $set: { douyinOpenid: openid, ...(unionid ? { douyinUnionid: unionid } : {}) },
    });
    res.json({ success: true, message: '抖音绑定成功' });
  } catch (err) {
    sendError(res, err);
  }
});

// 解绑微信（若是最后登录方式则强制设密码）
router.post('/unbind/wechat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.wechatOpenid) return res.status(400).json({ error: '未绑定微信' });

    // 安全检查：若解绑后无任何登录方式（无密码 + 无其他 OAuth），拒绝
    const hasPassword = !!user.password;
    const hasDouyin = !!user.douyinOpenid;
    if (!hasPassword && !hasDouyin) {
      return res.status(400).json({
        error: '解绑后将无任何登录方式，请先设置密码或绑定其他账号',
        code: 'NEED_PASSWORD',
      });
    }

    await User.findByIdAndUpdate(req.user!.id, { $unset: { wechatOpenid: '' } });
    res.json({ success: true, message: '微信解绑成功' });
  } catch (err) {
    sendError(res, err);
  }
});

// 解绑抖音
router.post('/unbind/douyin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ error: '用户不存在' });
    if (!user.douyinOpenid) return res.status(400).json({ error: '未绑定抖音' });

    const hasPassword = !!user.password;
    const hasWechat = !!user.wechatOpenid;
    if (!hasPassword && !hasWechat) {
      return res.status(400).json({
        error: '解绑后将无任何登录方式，请先设置密码或绑定其他账号',
        code: 'NEED_PASSWORD',
      });
    }

    await User.findByIdAndUpdate(req.user!.id, { $unset: { douyinOpenid: '', douyinUnionid: '' } });
    res.json({ success: true, message: '抖音解绑成功' });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;