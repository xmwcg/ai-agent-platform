import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';
import { validate, ValidationSchema } from '../lib/validation';
import { User } from '../models/User';
import { ApiKey, IApiKey } from '../models/ApiKey';
import { ApiUsageLog } from '../models/ApiUsageLog';
import { CreditsTransaction } from '../models/CreditsTransaction';
import { getCreditsCost, MarketplaceResource } from '../config/credits-pricing';
import {
  generateApiKey,
  hashKey,
  remainingQuota,
  logApiUsage,
  ApiKeyQuotaState,
} from '../services/apikey.service';

/** 携带已鉴权 API Key 的请求（收敛 enforceApiKey 中间件挂载的任意断言） */
interface ApiKeyRequest extends AuthRequest {
  apiKey: IApiKey;
}

/** enforceApiKey 中间件选项 */
interface EnforceApiKeyOptions {
  /** 资源类型，用于查询积分扣减定价，默认 'chat' */
  resource?: MarketplaceResource;
}

const router = Router();

/** API Key 允许的 scope 白名单（避免越权授予未实现的能力） */
const ALLOWED_SCOPES = ['chat', 'embed', 'compare', 'image'] as const;

const createKeySchema: ValidationSchema = {
  name: { required: true, type: 'string', minLength: 1, maxLength: 64 },
  quotaDaily: { type: 'number' },
  scopes: { type: 'stringArray' },
};

const chatSchema: ValidationSchema = {
  prompt: { required: true, type: 'string', minLength: 1 },
};

/**
 * 原子扣减 API Key 日配额：用 MongoDB findOneAndUpdate 的 $inc + 条件 $lt 在单条文档上完成，
 * 避免「先读 usedToday 判断 → 再 save」两步之间并发超发。
 * 返回更新后的 key（已扣减）；若配额已用尽返回 null。
 */
async function consumeQuotaAtomically(keyId: string): Promise<InstanceType<typeof ApiKey> | null> {
  return ApiKey.findOneAndUpdate(
    { _id: keyId, status: 'active', $expr: { $lt: ['$usedToday', '$quotaDaily'] } },
    { $inc: { usedToday: 1 } },
    { new: true }
  );
}

/**
 * API Key 鉴权 + 按量配额中间件工厂（开放 API 市场闸门）
 *
 * 支持传入 resource 参数，按资源类型查询积分扣减定价，配额耗尽时自动抵扣积分。
 * 抵扣成功时记录 CreditsTransaction 到 MongoDB，形成完整审计链路。
 *
 * @param options.resource - 资源类型（chat/embed/compare/image），默认 'chat'
 */
export function enforceApiKey(options: EnforceApiKeyOptions = {}): (req: AuthRequest, res: Response, next: NextFunction) => Promise<void> {
  const resource: MarketplaceResource = options.resource || 'chat';
  const cost = getCreditsCost(resource);

  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const headerKey =
      (req.headers['x-api-key'] as string) || (req.headers.authorization || '').replace(/^Bearer\s+/, '');
    if (!headerKey) {
      res.status(401).json({ error: '缺少 API Key（X-API-Key）' });
      return;
    }
    const key = await ApiKey.findOne({ keyHash: hashKey(headerKey), status: 'active' });
    if (!key) {
      res.status(401).json({ error: 'API Key 无效或已吊销' });
      return;
    }
    // 原子扣减日配额（避免并发超发）；返回 null 表示已用尽
    const consumed = await consumeQuotaAtomically(String(key._id));
    if (!consumed) {
      // 配额耗尽后尝试积分抵扣
      if (key.creditsEnabled) {
        const user = await User.findOneAndUpdate(
          { _id: key.ownerId, credits: { $gte: cost } },
          { $inc: { credits: -cost } },
          { new: true }
        );
        if (user) {
          // 积分抵扣成功：记录变动明细（异步不阻塞响应）
          void CreditsTransaction.create({
            userId: key.ownerId,
            type: 'deduction',
            amount: -cost,
            balanceAfter: user.credits,
            resource,
            apiKeyId: key._id,
            description: `API 积分抵扣 (${resource})`,
          });
          (req as ApiKeyRequest).apiKey = key;
          (req as any)._creditsDeducted = cost;
          logger.info('marketplace', `积分抵扣 ${cost} (${resource})，用户 ${key.ownerId} 余额 ${user.credits}`);
          return next();
        }
      }
      res.status(429).json({
        error: '今日 API 调用配额已用尽',
        code: 'API_QUOTA_EXCEEDED',
        remaining: 0,
        upgradeUrl: '/pricing',
      });
      return;
    }
    (req as ApiKeyRequest).apiKey = consumed;
    next();
  };
}

/** 创建密钥（明文仅返回一次） */
router.post('/api-keys', requireAuth, validate(createKeySchema), async (req: AuthRequest, res: Response) => {
  try {
    const { name, quotaDaily, scopes, creditsEnabled } = req.body as {
      name: string;
      quotaDaily?: number;
      scopes?: string[];
      creditsEnabled?: boolean;
    };
    if (quotaDaily !== undefined && (!Number.isInteger(quotaDaily) || quotaDaily <= 0)) {
      return res.status(400).json({ success: false, error: 'quotaDaily 必须为正整数' });
    }
    const safeScopes = Array.isArray(scopes)
      ? scopes.filter((s) => (ALLOWED_SCOPES as readonly string[]).includes(s))
      : ['chat'];
    const { plain, prefix, hash } = generateApiKey();
    const key = await ApiKey.create({
      ownerId: req.user!.id,
      name,
      keyHash: hash,
      prefix,
      quotaDaily: quotaDaily || 1000,
      scopes: safeScopes,
      creditsEnabled: !!creditsEnabled,
    });
    res.json({
      success: true,
      data: { id: key._id, name: key.name, prefix, plainKey: plain, remaining: key.quotaDaily },
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 列出密钥 */
router.get('/api-keys', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await ApiKey.find({ ownerId: req.user!.id, status: 'active' }).select('-keyHash').lean();
    const data = keys.map((k) => ({ ...k, remaining: remainingQuota(k as ApiKeyQuotaState) }));
    res.json({ success: true, data });
  } catch (err) {
    sendError(res, err);
  }
});

/** 切换积分抵扣开关 */
router.patch('/api-keys/:id/toggle-credits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const key = await ApiKey.findOne({ _id: req.params.id, ownerId: req.user!.id });
    if (!key) return res.status(404).json({ success: false, error: '密钥不存在' });
    key.creditsEnabled = !key.creditsEnabled;
    await key.save();
    res.json({ success: true, data: { creditsEnabled: key.creditsEnabled } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 吊销密钥 */
router.delete('/api-keys/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await ApiKey.findOneAndUpdate({ _id: req.params.id, ownerId: req.user!.id }, { status: 'revoked' });
    res.json({ success: true });
  } catch (err) {
    sendError(res, err);
  }
});

/** 用量统计 */
router.get('/usage', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const keys = await ApiKey.find({ ownerId: req.user!.id }).lean();
    const totalUsed = keys.reduce((s: number, k) => s + k.usedToday, 0);
    res.json({ success: true, data: { keys: keys.length, totalUsedToday: totalUsed } });
  } catch (err) {
    sendError(res, err);
  }
});

/** 按量计费端点：开放 API 市场 - 对话 */
router.post('/v1/chat', enforceApiKey({ resource: 'chat' }), validate(chatSchema), async (req: AuthRequest, res: Response) => {
  try {
    const { prompt } = req.body as { prompt: string };
    const key = (req as ApiKeyRequest).apiKey;
    const reply = `(API 调用) 已处理：${String(prompt).slice(0, 60)}…`;
    // 异步记录用量日志（不阻塞响应），支撑账单导出与积分抵扣审计
    void logApiUsage({
      keyId: String(key._id),
      ownerId: key.ownerId,
      prefix: key.prefix,
      resource: 'chat',
      promptBytes: Buffer.byteLength(String(prompt), 'utf8') || undefined,
      replyBytes: Buffer.byteLength(reply, 'utf8') || undefined,
      status: 'success',
      creditsDeducted: (req as any)._creditsDeducted,
    });
    res.json({
      provider: 'marketplace',
      model: 'reasonix-route',
      reply,
      apiKeyId: String(key._id),
      remaining: remainingQuota(key as unknown as ApiKeyQuotaState),
    });
  } catch (err) {
    sendError(res, err);
  }
});

/* ========== 用量报表与账单导出（B：计费深化） ========== */

/**
 * 用量汇总报表：按密钥聚合指定时间区间内每日调用次数与字节数。
 * GET /api/marketplace/usage/report?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/usage/report', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const fromStr = (req.query.from as string) || new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = (req.query.to as string) || today.toISOString().slice(0, 10);
    const from = new Date(`${fromStr}T00:00:00.000Z`);
    const to = new Date(`${toStr}T23:59:59.999Z`);

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ success: false, error: '日期范围无效（格式 YYYY-MM-DD，from ≤ to）' });
    }

    const logs = await ApiUsageLog.find({
      ownerId: req.user!.id,
      timestamp: { $gte: from, $lte: to },
      status: 'success',
    }).lean();

    // 聚合：{ keyId → { prefix, daily: { date: { calls, promptBytes, replyBytes, creditsDeducted } } } }
    const agg: Record<string, { prefix: string; daily: Record<string, { calls: number; promptBytes: number; replyBytes: number; creditsDeducted: number }> }> = {};
    for (const l of logs) {
      const id = String(l.keyId);
      const date = new Date(l.timestamp).toISOString().slice(0, 10);
      if (!agg[id]) { agg[id] = { prefix: l.prefix, daily: {} }; }
      if (!agg[id].daily[date]) { agg[id].daily[date] = { calls: 0, promptBytes: 0, replyBytes: 0, creditsDeducted: 0 }; }
      agg[id].daily[date].calls += 1;
      agg[id].daily[date].promptBytes += (l.promptBytes || 0);
      agg[id].daily[date].replyBytes  += (l.replyBytes || 0);
      agg[id].daily[date].creditsDeducted += (l.creditsDeducted || 0);
    }

    const items = Object.entries(agg).map(([keyId, v]) => ({
      keyId,
      prefix: v.prefix,
      daily: Object.entries(v.daily).map(([d, s]) => ({ date: d, ...s })),
      totalCalls: Object.values(v.daily).reduce((sum, s) => sum + s.calls, 0),
      totalCreditsDeducted: Object.values(v.daily).reduce((sum, s) => sum + s.creditsDeducted, 0),
    }));

    res.json({ success: true, data: { from: fromStr, to: toStr, items } });
  } catch (err) {
    sendError(res, err);
  }
});

/**
 * 用量账单导出（CSV / JSON）。
 * GET /api/marketplace/usage/export?from=YYYY-MM-DD&to=YYYY-MM-DD&format=csv|json
 */
router.get('/usage/export', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const today = new Date();
    const fromStr = (req.query.from as string) || new Date(today.getTime() - 30 * 86400000).toISOString().slice(0, 10);
    const toStr = (req.query.to as string) || today.toISOString().slice(0, 10);
    const format = (req.query.format as string) === 'json' ? 'json' : 'csv';
    const from = new Date(`${fromStr}T00:00:00.000Z`);
    const to = new Date(`${toStr}T23:59:59.999Z`);

    if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) {
      return res.status(400).json({ success: false, error: '日期范围无效' });
    }

    const logs = await ApiUsageLog.find({
      ownerId: req.user!.id,
      timestamp: { $gte: from, $lte: to },
      status: 'success',
    }).sort({ timestamp: 1 }).lean();

    if (format === 'json') {
      return res.json({
        success: true,
        data: {
          from: fromStr, to: toStr,
          total: logs.length,
          records: logs.map((l) => ({
            time: new Date(l.timestamp).toISOString(),
            keyPrefix: l.prefix,
            resource: l.resource,
            promptBytes: l.promptBytes || 0,
            replyBytes: l.replyBytes || 0,
            creditsDeducted: l.creditsDeducted,
          })),
        },
      });
    }

    // CSV 格式
    const header = '时间,密钥前缀,资源,输入字节,输出字节,抵扣积分';
    const rows = logs.map((l) =>
      [
        new Date(l.timestamp).toISOString(),
        `"${l.prefix}"`,
        l.resource,
        l.promptBytes || 0,
        l.replyBytes || 0,
        l.creditsDeducted || 0,
      ].join(',')
    );
    const csv = [header, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="api-usage-${fromStr}-${toStr}.csv"`);
    res.send('\uFEFF' + csv); // BOM 保证 Excel 正确识别 UTF-8
  } catch (err) {
    sendError(res, err);
  }
});

/* ========== 积分查询（P0-2-4：积分余额 + 变动明细） ========== */

/** 查询当前积分余额 */
router.get('/credits', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const user = await User.findById(req.user!.id).select('credits plan').lean();
    if (!user) return res.status(404).json({ success: false, error: '用户不存在' });
    res.json({
      success: true,
      data: {
        credits: user.credits,
        plan: user.plan,
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

/** 查询积分变动明细（分页、支持 type 过滤） */
router.get('/credits/history', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(req.query.pageSize as string) || 20));
    const type = req.query.type as string;
    const filter: Record<string, unknown> = { userId: req.user!.id };
    if (type && ['deduction', 'grant', 'purchase'].includes(type)) {
      filter.type = type;
    }
    const [total, items] = await Promise.all([
      CreditsTransaction.countDocuments(filter),
      CreditsTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean(),
    ]);
    res.json({
      success: true,
      data: {
        total,
        page,
        pageSize,
        items: items.map((tx) => ({
          id: String(tx._id),
          type: tx.type,
          amount: tx.amount,
          balanceAfter: tx.balanceAfter,
          resource: tx.resource,
          orderNo: tx.orderNo,
          description: tx.description,
          createdAt: tx.createdAt,
        })),
      },
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
