import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import axios from 'axios';
import { User } from '../models/User';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';
import { redisClient } from '../config/database';
import { logger } from '../lib/logger';

const router = Router();

/** 中国大陆手机号校验 */
function isCnPhone(s: string): boolean {
  return /^1[3-9]\d{9}$/.test(s);
}

// 注册输入校验（email 格式 + 密码长度 + 用户名长度）
const registerSchema: ValidationSchema = {
  email: { required: true, type: 'string', isEmail: true, maxLength: 254 },
  password: { required: true, type: 'string', minLength: 6, maxLength: 64 },
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
    const { email, password, name } = req.body;

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: '该邮箱已被注册' });
    }

    const user = await User.create({ email, password, name });
    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    res.status(201).json({
      success: true,
      token,
      user: user.toJSON()
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

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

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
  try {
    const { phone } = req.body as { phone: string };
    // 同手机号 60s 限频
    const limitKey = `sms:limit:${phone}`;
    if (await redisClient.get(limitKey)) {
      return res.status(429).json({ error: '验证码发送过于频繁，请稍后再试' });
    }
    const code = crypto.randomInt(100000, 999999).toString();
    await redisClient.set(`sms:code:${phone}`, code, 'EX', 300);
    await redisClient.set(limitKey, '1', 'EX', 60);

    const isMock = (process.env.SMS_MOCK || process.env.NODE_ENV !== 'production') === 'true' || process.env.NODE_ENV !== 'production';
    if (isMock || !process.env.SMS_PROVIDER) {
      logger.info('auth', `[SMS Mock] 向 ${phone} 发送验证码: ${code}`);
    } else {
      // 真实短信服务商接入点（阿里云/腾讯云）：在此调用对应 SDK 发送 code
      logger.info('auth', `[SMS ${process.env.SMS_PROVIDER}] 向 ${phone} 发送验证码(真实)`);
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
  try {
    const { phone, code } = req.body as { phone: string; code: string };
    const stored = await redisClient.get(`sms:code:${phone}`);
    if (!stored || stored !== code) {
      return res.status(400).json({ error: '验证码错误 or 已过期' });
    }
    await redisClient.del(`sms:code:${phone}`);

    let user = await User.findOne({ phone });
    if (!user) {
      // 自动注册：生成随机密码（用户后续可绑定邮箱/改密）
      const rand = crypto.randomBytes(9).toString('base64').replace(/[+/=]/g, '');
      user = await User.create({ phone, password: rand, name: `用户${phone.slice(-4)}`, provider: 'local', email: `${phone}@phone.local` });
    }
    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });
    res.json({ success: true, token, user: user.toJSON() });
  } catch (err) {
    sendError(res, err);
  }
});

// ===================== 微信扫码登录（OAuth2 网站应用） =====================
// 生成扫码登录入口：返回需渲染为二维码的 authorizeUrl（开发态 Mock 可直接走通）
router.get('/wechat/qr', async (_req: Request, res: Response) => {
  try {
    const mock = process.env.WECHAT_LOGIN_MOCK === 'true' || (!process.env.WECHAT_OPEN_APPID);
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
    if (!state || !(await redisClient.get(`wechat:state:${state}`))) {
      return res.status(400).json({ error: '非法的登录态' });
    }
    await redisClient.del(`wechat:state:${state}`);

    let openid: string;
    if (code === 'mock' || !process.env.WECHAT_OPEN_APPID) {
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
    const token = generateToken({ id: user._id.toString(), email: user.email, role: user.role });

    if (format === 'json') {
      return res.json({ success: true, token, user: user.toJSON() });
    }
    // 前端弹窗扫码：回调页把 token 发给 opener 并关闭
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(`<html><body><script>
      try { window.opener && window.opener.postMessage({ type:'wechat_login', token:'${token}' }, '*'); } catch(e){}
      window.close();
    </script>登录成功，正在返回…</body></html>`);
  } catch (err) {
    sendError(res, err);
  }
});

export default router;