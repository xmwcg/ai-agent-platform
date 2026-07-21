"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const database_1 = require("../config/database");
const billing_1 = require("../config/billing");
const media_gen_service_1 = require("../services/media-gen.service");
const WebhookEvent_1 = require("../models/WebhookEvent");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
function envPresent(...keys) {
    return keys.every((k) => !!process.env[k]);
}
function getRuntimeSafety() {
    const production = process.env.NODE_ENV === 'production';
    return {
        production,
        mockMode: process.env.ENABLE_MOCK_MODE === 'true' || process.env.MOCK_MODE === 'true',
        aiMockEnabled: !production && process.env.ENABLE_MOCK_MODE === 'true',
        paymentMockEnabled: !production,
        sandboxMockEnabled: !production && process.env.SANDBOX_MODE === 'mock',
        sandboxLocalEnabled: !production && process.env.SANDBOX_MODE === 'local',
        smsMockEnabled: !production && (process.env.SMS_MOCK === 'true' || !process.env.SMS_PROVIDER),
        wechatLoginMockEnabled: !production && (process.env.WECHAT_LOGIN_MOCK === 'true' || !process.env.WECHAT_OPEN_APPID),
        memoryRedisEnabled: (0, database_1.isUsingMemoryRedis)(),
    };
}
/** 发布系统使用的无密钥安全摘要。仅暴露布尔状态，便于自动验收生产 Mock 已清零。 */
router.get('/runtime-safety', (_req, res) => {
    const runtimeSafety = getRuntimeSafety();
    const safe = runtimeSafety.production
        && !Object.entries(runtimeSafety).some(([key, value]) => key !== 'production' && value === true);
    res.status(safe ? 200 : 503).json({ success: safe, data: { runtimeSafety } });
});
/** 环境自检：返回各项集成状态（绝不泄露密钥明文），用于部署向导/健康看板；需登录，避免暴露部署指纹 */
router.get('/', auth_1.requireAuth, async (req, res) => {
    const health = await (0, database_1.checkDatabaseHealth)().catch(() => ({ mongodb: false, redis: false }));
    const checks = [
        { key: 'mongodb', label: 'MongoDB 数据库', ok: !!health.mongodb, tip: health.mongodb ? '' : '检查托管 MongoDB 连接和 MONGODB_URI' },
        { key: 'redis', label: 'Redis 缓存/限流', ok: !!health.redis, tip: health.redis ? '' : '生产环境必须连接真实 Redis，不允许内存降级' },
        { key: 'jwt', label: 'JWT 鉴权', ok: !!process.env.JWT_SECRET, tip: process.env.JWT_SECRET ? '' : '生产环境必须设置强 JWT_SECRET' },
        { key: 'ai_openai', label: 'OpenAI 模型', ok: envPresent('OPENAI_API_KEY'), tip: envPresent('OPENAI_API_KEY') ? '' : '生产环境必须至少配置一个真实 AI Provider' },
        { key: 'ai_deepseek', label: 'DeepSeek 模型', ok: envPresent('DEEPSEEK_API_KEY'), tip: envPresent('DEEPSEEK_API_KEY') ? '' : '可选，未配置不影响运行' },
        { key: 'ai_hunyuan', label: '混元/智绘媒体', ok: envPresent('HUNYUAN_SECRET_ID', 'HUNYUAN_SECRET_KEY'), tip: envPresent('HUNYUAN_SECRET_ID') ? '' : '文生视频/图生视频真实厂商，可选' },
        { key: 'ai_keling', label: '可灵 Kling', ok: envPresent('KELING_API_TOKEN'), tip: envPresent('KELING_API_TOKEN') ? '' : '可选' },
        { key: 'ai_jimeng', label: '即梦 Jimeng', ok: envPresent('JIMENG_API_TOKEN'), tip: envPresent('JIMENG_API_TOKEN') ? '' : '可选' },
        { key: 'pay_wechat', label: '微信支付', ok: envPresent('WECHAT_MCH_ID', 'WECHAT_APP_ID', 'WECHAT_API_V3_KEY', 'WECHAT_CERT_SERIAL', 'WECHAT_PRIVATE_KEY', 'WECHAT_PLATFORM_CERT'), tip: envPresent('WECHAT_MCH_ID', 'WECHAT_APP_ID', 'WECHAT_API_V3_KEY', 'WECHAT_CERT_SERIAL', 'WECHAT_PRIVATE_KEY', 'WECHAT_PLATFORM_CERT') ? '' : '生产环境缺少任一微信支付参数将拒绝启动' },
    ];
    const mediaProviders = (0, media_gen_service_1.listMediaProviders)().map((p) => ({ name: p.name, label: p.label, configured: p.configured }));
    // Webhook 健康指标（最近 24 小时统计）
    let webhookStats = null;
    try {
        const since = new Date(Date.now() - 24 * 3600 * 1000);
        const [total, failed, processed, skipped] = await Promise.all([
            WebhookEvent_1.WebhookEvent.countDocuments({ receivedAt: { $gte: since } }),
            WebhookEvent_1.WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'failed' }),
            WebhookEvent_1.WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'processed' }),
            WebhookEvent_1.WebhookEvent.countDocuments({ receivedAt: { $gte: since }, status: 'skipped' }),
        ]);
        webhookStats = { total, failed, processed, skipped, since: since.toISOString() };
    }
    catch {
        webhookStats = null; // MongoDB 不可用时忽略
    }
    // 未登录用户只返回基本健康状态（不含支付详情和Webhook统计）
    const isAuth = !!(req.user && req.user.id);
    // 支付渠道详细状态
    const defaultProvider = process.env.DEFAULT_PAY_PROVIDER || (process.env.NODE_ENV === 'production' ? 'wechat' : 'mock');
    const mask = (s) => {
        if (!s)
            return '';
        if (s.length <= 8)
            return '***';
        return s.slice(0, 4) + '****' + s.slice(-4);
    };
    const paymentStatus = {
        defaultProvider,
        isReal: defaultProvider !== 'mock',
        notifyUrl: `${process.env.PUBLIC_BASE_URL || ''}/api/billing/webhook/${defaultProvider}`,
        wechat: {
            configured: envPresent('WECHAT_MCH_ID', 'WECHAT_APP_ID', 'WECHAT_API_V3_KEY', 'WECHAT_CERT_SERIAL', 'WECHAT_PRIVATE_KEY', 'WECHAT_PLATFORM_CERT'),
            mchId: mask(process.env.WECHAT_MCH_ID),
            appId: mask(process.env.WECHAT_APP_ID),
            hasApiKey: !!process.env.WECHAT_API_V3_KEY,
            hasPlatformCert: !!process.env.WECHAT_PLATFORM_CERT,
            hasPrivateKey: !!process.env.WECHAT_PRIVATE_KEY,
        },
        stripe: {
            configured: envPresent('STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET'),
            hasSecretKey: !!process.env.STRIPE_SECRET_KEY,
            hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
        },
        alipay: {
            configured: envPresent('ALIPAY_APP_ID', 'ALIPAY_PRIVATE_KEY', 'ALIPAY_PUBLIC_KEY'),
        },
    };
    res.json({
        success: true,
        data: {
            mockMode: process.env.ENABLE_MOCK_MODE === 'true',
            runtimeSafety: getRuntimeSafety(),
            checks,
            mediaProviders,
            plans: Object.keys(billing_1.PLANS),
            allHealthy: checks.every((c) => c.ok),
            webhookStats,
            paymentStatus,
        },
    });
});
exports.default = router;
//# sourceMappingURL=diagnostics.js.map