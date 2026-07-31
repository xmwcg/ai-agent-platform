import { Router, Response } from 'express';
import { AuthRequest, requireAuth } from '../middleware/auth';
import { redisClient } from '../config/database';
import { User } from '../models/User';
import { logger } from '../lib/logger';
import { resolveUserPlan } from '../middleware/subscription';
import { deductCredits } from '../services/credit-ledger.service';
import {
  TRANSYNC_TICKET_TTL_SECONDS,
  TranSyncTicketPayload,
  createAuthorizationCode,
  isValidSsoState,
  normalizeTranSyncOrigin,
  sanitizeTranSyncNext,
  secretMatches,
  ticketStorageKey,
} from '../services/transync-sso.service';

const router = Router();

function noStore(res: Response): void {
  res.setHeader('Cache-Control', 'no-store, max-age=0');
  res.setHeader('Pragma', 'no-cache');
}

async function consumeTicket(key: string): Promise<string | null> {
  const redis = redisClient as any;
  if (typeof redis.getdel === 'function') return redis.getdel(key);
  const value = await redis.get(key);
  if (value) await redis.del(key);
  return value;
}

router.post('/tickets', requireAuth, async (req: AuthRequest, res: Response) => {
  noStore(res);
  try {
    const origin = normalizeTranSyncOrigin(process.env.TRANSYNC_BASE_URL);
    if (!origin) {
      return res.status(503).json({ success: false, code: 'TRANSYNC_SSO_NOT_CONFIGURED', error: '实时翻译统一登录暂未配置' });
    }

    const state = req.body?.state;
    if (!isValidSsoState(state)) {
      return res.status(400).json({ success: false, code: 'INVALID_SSO_STATE', error: '统一登录状态参数无效' });
    }

    const user = await User.findById(req.user!.id);
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    if (user.isBanned) return res.status(403).json({ success: false, code: 'ACCOUNT_BANNED', error: '账号已被封禁' });

    const { plan: effectivePlan } = await resolveUserPlan(user._id.toString());
    const now = new Date();
    const expiresAt = new Date(now.getTime() + TRANSYNC_TICKET_TTL_SECONDS * 1000);
    const code = createAuthorizationCode();
    const next = sanitizeTranSyncNext(req.body?.next);
    const payload: TranSyncTicketPayload = {
      version: 1,
      subject: user._id.toString(),
      email: user.email,
      emailVerified: Boolean(user.emailVerified),
      name: user.name,
      avatar: user.avatar || undefined,
      role: user.role,
      plan: effectivePlan as any,
      membershipExpiresAt: user.membershipExpiresAt?.toISOString(),
      state,
      next,
      issuedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
    };

    await (redisClient as any).setex(ticketStorageKey(code), TRANSYNC_TICKET_TTL_SECONDS, JSON.stringify(payload));

    const authorizeUrl = new URL('/api/auth/aibak/callback', origin);
    authorizeUrl.searchParams.set('code', code);
    authorizeUrl.searchParams.set('state', state);
    return res.json({
      success: true,
      data: { authorizeUrl: authorizeUrl.toString(), expiresIn: TRANSYNC_TICKET_TTL_SECONDS },
    });
  } catch (error) {
    logger.error('transync-sso', `签发统一登录授权码失败: ${(error as Error)?.message}`);
    return res.status(500).json({ success: false, code: 'TRANSYNC_SSO_TICKET_FAILED', error: '统一登录授权失败' });
  }
});

router.post('/exchange', async (req: AuthRequest, res: Response) => {
  noStore(res);
  const suppliedSecret = req.headers['x-transync-sso-secret'];
  if (!secretMatches(process.env.TRANSYNC_SSO_CLIENT_SECRET, suppliedSecret)) {
    return res.status(401).json({ success: false, code: 'INVALID_CLIENT', error: '客户端认证失败' });
  }

  const code = req.body?.code;
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{32,256}$/.test(code)) {
    return res.status(400).json({ success: false, code: 'INVALID_CODE', error: '授权码无效' });
  }

  try {
    const serialized = await consumeTicket(ticketStorageKey(code));
    if (!serialized) {
      return res.status(410).json({ success: false, code: 'CODE_EXPIRED_OR_USED', error: '授权码已过期或已使用' });
    }

    const payload = JSON.parse(serialized) as TranSyncTicketPayload;
    if (payload.version !== 1 || !isValidSsoState(payload.state) || Date.parse(payload.expiresAt) <= Date.now()) {
      return res.status(410).json({ success: false, code: 'CODE_EXPIRED_OR_USED', error: '授权码已过期或已使用' });
    }
    return res.json({ success: true, data: payload });
  } catch (error) {
    logger.error('transync-sso', `兑换统一登录授权码失败: ${(error as Error)?.message}`);
    return res.status(500).json({ success: false, code: 'TRANSYNC_SSO_EXCHANGE_FAILED', error: '统一登录兑换失败' });
  }
});

// ─── TranSync 翻译积分扣减回调（TranSync 服务端调用）───
// 由 TranSync 在用户完成翻译后调用，扣减平台积分。使用 TRANSYNC_SSO_CLIENT_SECRET 认证。
const TRANSLATION_CHAR_COST = 0.05; // 每字符消耗 0.05 积分
const TRANSLATION_MIN_COST = 1;     // 最低消费 1 积分

router.post('/credits/deduct', async (req: AuthRequest, res: Response) => {
  noStore(res);
  const suppliedSecret = req.headers['x-transync-sso-secret'];
  if (!secretMatches(process.env.TRANSYNC_SSO_CLIENT_SECRET, suppliedSecret)) {
    return res.status(401).json({ success: false, code: 'INVALID_CLIENT', error: '客户端认证失败' });
  }

  const { userId, charCount } = req.body || {};
  if (!userId || typeof charCount !== 'number' || charCount <= 0) {
    return res.status(400).json({ success: false, code: 'INVALID_PARAMS', error: '缺少 userId 或 charCount' });
  }

  try {
    // 计算消耗积分：每字符 0.05 积分，最低 1 积分
    const cost = Math.max(TRANSLATION_MIN_COST, Math.ceil(charCount * TRANSLATION_CHAR_COST));

    // 检查余额
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', error: '用户不存在' });
    const balance = user.credits || 0;
    if (balance < cost) {
      return res.json({
        success: false,
        code: 'INSUFFICIENT_CREDITS',
        error: '积分不足，请充值后继续使用翻译服务',
        data: { balance, cost, charCount },
      });
    }

    // 扣减积分
    const result = await deductCredits({
      userId,
      amount: cost,
      idempotencyKey: `transync:${userId}:${Date.now()}:${Math.random().toString(36).slice(2, 10)}`,
      businessType: 'transync_translate',
      businessId: `transync:${userId}`,
      resource: 'translate',
      description: `TranSync 翻译扣费 (${charCount} 字符)`,
    });

    const remaining = result.balanceAfter;
    logger.info('transync-credits', `翻译积分扣减: userId=${userId} charCount=${charCount} cost=${cost} remaining=${remaining}`);

    return res.json({
      success: true,
      data: { cost, remaining, charCount, balance: remaining },
    });
  } catch (error) {
    logger.error('transync-credits', `翻译积分扣减失败: ${(error as Error)?.message}`);
    return res.status(500).json({ success: false, code: 'DEDUCT_FAILED', error: '积分扣减失败' });
  }
});

// ─── TranSync 翻译积分查询（TranSync 服务端调用）───
router.post('/credits/balance', async (req: AuthRequest, res: Response) => {
  noStore(res);
  const suppliedSecret = req.headers['x-transync-sso-secret'];
  if (!secretMatches(process.env.TRANSYNC_SSO_CLIENT_SECRET, suppliedSecret)) {
    return res.status(401).json({ success: false, code: 'INVALID_CLIENT', error: '客户端认证失败' });
  }

  const { userId } = req.body || {};
  if (!userId) {
    return res.status(400).json({ success: false, code: 'INVALID_PARAMS', error: '缺少 userId' });
  }

    try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, code: 'USER_NOT_FOUND', error: '用户不存在' });
    const balance = user.credits || 0;
    return res.json({ success: true, data: { userId, balance } });
  } catch (error) {
    logger.error('transync-credits', `查询积分余额失败: ${(error as Error)?.message}`);
    return res.status(500).json({ success: false, code: 'BALANCE_FAILED', error: '查询余额失败' });
  }
});

export default router;
