import { Router, Response } from 'express';
import { User } from '../models/User';
import { generateToken, requireAuth, AuthRequest } from '../middleware/auth';
import { authLimiter } from '../middleware/rate-limit';
import { sendError } from '../lib/http-error';
import { validate, ValidationSchema } from '../lib/validation';

const router = Router();

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

export default router;