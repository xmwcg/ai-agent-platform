import { Router, Request, Response } from 'express';
import { checkDatabaseHealth } from '../config/database';
import { PLANS } from '../config/billing';
import { listMediaProviders } from '../services/media-gen.service';
import { WebhookEvent } from '../models/WebhookEvent';
import { requireAuth } from '../middleware/auth';

const router = Router();

function envPresent(...keys: string[]): boolean {
  return keys.every((k) => !!process.env[k]);
}

/** 环境自检：返回各项集成状态（绝不泄露密钥明文），用于部署向导/健康看板；需登录，避免暴露部署指纹 */
router.get('/', requireAuth, async (_req: Request, res: Response) => {
  const health = await checkDatabaseHealth().catch(() => ({ mongodb: false, redis: false }));
  const checks = [
    { key: 'mongodb', label: 'MongoDB 数据库', ok: !!health.mongodb, tip: health.mongodb ? '' : '检查 MONGODB_URI 或 docker-compose 是否启动' },
    { key: 'redis', label: 'Redis 缓存/限流', ok: !!health.redis, tip: health.redis ? '' : '未配置将自动降级为内存实现，配额仍可用' },
    { key: 'jwt', label: 'JWT 鉴权', ok: !!process.env.JWT_SECRET, tip: process.env.JWT_SECRET ? '' : '建议生产环境设置 JWT_SECRET' },
    { key: 'ai_openai', label: 'OpenAI 模型', ok: envPresent('OPENAI_API_KEY'), tip: envPresent('OPENAI_API_KEY') ? '' : '未配置将走 Mock；可在 /model-config 自助接入' },
    { key: 'ai_deepseek', label: 'DeepSeek 模型', ok: envPresent('DEEPSEEK_API_KEY'), tip: envPresent('DEEPSEEK_API_KEY') ? '' : '可选，未配置不影响运行' },
    { key: 'ai_hunyuan', label: '混元/智绘媒体', ok: envPresent('HUNYUAN_SECRET_ID', 'HUNYUAN_SECRET_KEY'), tip: envPresent('HUNYUAN_SECRET_ID') ? '' : '文生视频/图生视频真实厂商，可选' },
    { key: 'ai_keling', label: '可灵 Kling', ok: envPresent('KELING_API_TOKEN'), tip: envPresent('KELING_API_TOKEN') ? '' : '可选' },
    { key: 'ai_jimeng', label: '即梦 Jimeng', ok: envPresent('JIMENG_API_TOKEN'), tip: envPresent('JIMENG_API_TOKEN') ? '' : '可选' },
    { key: 'pay_wechat', label: '微信支付', ok: envPresent('WECHAT_MCH_ID', 'WECHAT_API_V3_KEY', 'WECHAT_PRIVATE_KEY'), tip: envPresent('WECHAT_MCH_ID') ? '' : '可选，未配置仅演示' },
    { key: 'pay_stripe', label: 'Stripe 支付', ok: envPresent('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'), tip: envPresent('STRIPE_SECRET_KEY') ? '' : '可选，未配置仅演示' },
  ];
  const mediaProviders = listMediaProviders().map((p) => ({ name: p.name, label: p.label, configured: p.configured }));

  // Webhook 健康指标（最近 24 小时统计）
  let webhookStats: any = null;
  try {
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [total, failed, processed, skipped] = await Promise.all([
      WebhookEvent.countDocuments({ receivedAt: { $gte: since } }),
      WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'failed' }),
      WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'processed' }),
      WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'skipped' }),
    ]);
    webhookStats = { total, failed, processed, skipped, since: since.toISOString() };
  } catch {
    webhookStats = null; // MongoDB 不可用时忽略
  }

  res.json({
    success: true,
    data: {
      mockMode: process.env.ENABLE_MOCK_MODE === 'true',
      checks,
      mediaProviders,
      plans: Object.keys(PLANS),
      allHealthy: checks.every((c) => c.ok),
      webhookStats,
    },
  });
});

export default router;
