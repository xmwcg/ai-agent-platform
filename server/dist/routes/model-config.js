"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ModelConfig_1 = require("../models/ModelConfig");
const auth_1 = require("../middleware/auth");
const subscription_1 = require("../middleware/subscription");
const ai_models_1 = require("../config/ai-models");
const ai_gateway_service_1 = require("../gateway/ai-gateway.service");
const agnes_provider_1 = require("../services/media-providers/agnes.provider");
const model_fetch_service_1 = require("../services/model-fetch.service");
const http_error_1 = require("../lib/http-error");
const crypto_1 = require("../lib/crypto");
const secret_audit_service_1 = require("../services/secret-audit.service");
const provider_catalog_1 = require("../config/provider-catalog");
const rate_limit_1 = require("../middleware/rate-limit");
const router = (0, express_1.Router)();
/** 从请求中提取审计所需的操作者上下文 */
function auditCtx(req) {
    return {
        actorId: req.user.id,
        ip: (req.ip || req.headers['x-forwarded-for'] || '').toString(),
        userAgent: req.headers['user-agent'],
    };
}
/** 配置变更后刷新网关的第三方模型注册表 */
async function syncGateway() {
    try {
        await (0, ai_gateway_service_1.reloadCustomProviders)();
    }
    catch {
        /* 非致命：下次启动或手动刷新会重新加载 */
    }
    // 同步刷新 Agnes 媒体配置（模型配置里的 Agnes 自定义模型同时供视频/文生图使用）
    void agnes_provider_1.agnesProvider.reload().catch(() => { });
}
/** 列表：当前用户配置的模型 */
router.get('/', auth_1.requireAuth, async (req, res) => {
    try {
        // 安全：绝不把 apiKey 明文回传前端，改为返回是否已配置 + 尾部掩码
        const list = await ModelConfig_1.ModelConfig.find({ createdBy: req.user.id }).sort({ pinned: -1, createdAt: -1 }).lean();
        const masked = list.map((c) => {
            const key = c.apiKey || '';
            const { apiKey, ...rest } = c;
            return {
                ...rest,
                hasApiKey: !!key,
                apiKeyMask: key ? '****' : '',
            };
        });
        res.json({ success: true, data: masked });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 公开：平台启用的模型（供其他模块选择） */
router.get('/available', async (req, res) => {
    try {
        const list = await ModelConfig_1.ModelConfig.find({ enabled: true }).select('-apiKey').lean();
        res.json({ success: true, data: list });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 新增模型配置（受 model_config 配额限制） */
router.post('/', auth_1.requireAuth, (0, subscription_1.enforceQuota)('model_config'), async (req, res) => {
    try {
        const { name, provider, baseURL, apiKey, models, defaultModel, description } = req.body;
        if (!name || !provider || !baseURL || !apiKey || !defaultModel) {
            return res.status(400).json({ success: false, error: '缺少必填字段' });
        }
        const cfg = await ModelConfig_1.ModelConfig.create({
            name,
            provider,
            baseURL,
            models: models || [defaultModel],
            defaultModel,
            description,
            createdBy: req.user.id,
            isDefault: false,
            // 安全：apiKey 加密落库，避免数据库泄露导致明文 key 暴露
            apiKey: (0, crypto_1.encryptSecret)(apiKey),
        });
        await (0, subscription_1.quotaIncrement)(req.user.id, 'model_config');
        void syncGateway();
        const { actorId, ip, userAgent } = auditCtx(req);
        void (0, secret_audit_service_1.logSecretAudit)({
            ownerId: req.user.id,
            actorId,
            targetId: String(cfg._id),
            action: 'secret_created',
            ip,
            userAgent,
            detail: { provider, name },
        });
        const { apiKey: _omit, ...safe } = cfg.toObject();
        res.json({ success: true, data: safe });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 更新 */
router.put('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        // 安全：字段白名单，禁止越权覆盖 createdBy / isDefault 等敏感字段
        const ALLOWED = ['name', 'provider', 'baseURL', 'models', 'defaultModel', 'enabled', 'description', 'pinned'];
        const update = {};
        for (const k of ALLOWED) {
            if (k in req.body)
                update[k] = req.body[k];
        }
        // apiKey 只有在传入真实新值（非空、非掩码）时才覆盖，避免前端回填掩码把 key 洗掉
        const nextKey = req.body?.apiKey;
        let secretRotated = false;
        if (typeof nextKey === 'string' && nextKey.trim() && !nextKey.includes('****')) {
            // 安全：写入前加密
            update.apiKey = (0, crypto_1.encryptSecret)(nextKey.trim());
            secretRotated = true;
        }
        const cfg = await ModelConfig_1.ModelConfig.findOneAndUpdate({ _id: req.params.id, createdBy: req.user.id }, update, { new: true }).select('-apiKey');
        if (!cfg)
            return res.status(404).json({ success: false, error: '配置不存在' });
        void syncGateway();
        if (secretRotated) {
            const { actorId, ip, userAgent } = auditCtx(req);
            void (0, secret_audit_service_1.logSecretAudit)({
                ownerId: req.user.id,
                actorId,
                targetId: req.params.id,
                action: 'secret_updated',
                ip,
                userAgent,
                detail: { provider: update.provider, name: update.name },
            });
        }
        res.json({ success: true, data: cfg });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 删除 */
router.delete('/:id', auth_1.requireAuth, async (req, res) => {
    try {
        const cfg = await ModelConfig_1.ModelConfig.findOneAndDelete({ _id: req.params.id, createdBy: req.user.id });
        if (!cfg)
            return res.status(404).json({ success: false, error: '配置不存在' });
        void syncGateway();
        const { actorId, ip, userAgent } = auditCtx(req);
        void (0, secret_audit_service_1.logSecretAudit)({
            ownerId: cfg.createdBy,
            actorId,
            targetId: String(cfg._id),
            action: 'secret_deleted',
            ip,
            userAgent,
            detail: { provider: cfg.provider, name: cfg.name },
        });
        res.json({ success: true });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 设置为默认 */
router.post('/:id/set-default', auth_1.requireAuth, async (req, res) => {
    try {
        await ModelConfig_1.ModelConfig.updateMany({ createdBy: req.user.id }, { isDefault: false });
        await ModelConfig_1.ModelConfig.findOneAndUpdate({ _id: req.params.id, createdBy: req.user.id }, { isDefault: true });
        void syncGateway();
        res.json({ success: true });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 测试连接（真实调用厂商 models.list 校验可达性，验证第三方模型接入闭环） */
router.post('/:id/test', auth_1.requireAuth, async (req, res) => {
    // 统一收集测试结果，便于在一次返回前完成审计与异常告警
    const result = { connected: false, provider: '', model: '', error: '' };
    try {
        const cfg = await ModelConfig_1.ModelConfig.findOne({ _id: req.params.id, createdBy: req.user.id });
        if (!cfg)
            return res.status(404).json({ success: false, error: '配置不存在' });
        // 允许前端在「测试连接」时指定具体模型（复用统一选择器的值）
        const targetModel = req.body?.model || cfg.defaultModel;
        result.provider = cfg.provider;
        result.model = targetModel;
        // 安全：apiKey 密文落库，使用前解密
        const apiKey = (0, crypto_1.decryptSecret)(cfg.apiKey || '');
        if (!apiKey || !cfg.baseURL) {
            result.error = '缺少 apiKey 或 baseURL';
            return finalize();
        }
        const client = new (require('openai')).default({ apiKey, baseURL: cfg.baseURL });
        // 指定模型时直接做最小对话校验（最精确，能验证该模型可达）；否则先试 models.list
        if (targetModel && targetModel !== cfg.defaultModel) {
            try {
                await client.chat.completions.create({
                    model: targetModel,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 4,
                });
                result.connected = true;
            }
            catch (e2) {
                result.error = e2?.message || '连接失败';
            }
            return finalize();
        }
        try {
            await client.models.list();
            result.connected = true;
        }
        catch (e) {
            // 部分厂商不支持 models.list，退而尝试一次最小对话校验
            try {
                await client.chat.completions.create({
                    model: targetModel,
                    messages: [{ role: 'user', content: 'ping' }],
                    max_tokens: 4,
                });
                result.connected = true;
            }
            catch (e2) {
                result.error = e2?.message || '连接失败';
            }
        }
        return finalize();
    }
    catch (err) {
        result.error = err.message;
        const { actorId, ip, userAgent } = auditCtx(req);
        void (0, secret_audit_service_1.logSecretAudit)({
            ownerId: req.user.id,
            actorId,
            targetId: req.params.id,
            action: 'secret_test',
            ip,
            userAgent,
            result: 'failure',
            detail: { error: result.error },
        });
        return (0, http_error_1.sendError)(res, err);
    }
    function finalize() {
        const { actorId, ip, userAgent } = auditCtx(req);
        // 安全：检测高频测试连接（疑似滥用/探测 apiKey），命中则标记告警
        const abuse = (0, secret_audit_service_1.checkTestAbuse)(actorId, ip);
        void (0, secret_audit_service_1.logSecretAudit)({
            ownerId: req.user.id,
            actorId,
            targetId: req.params.id,
            action: 'secret_test',
            ip,
            userAgent,
            result: result.connected ? 'success' : 'failure',
            alert: abuse,
            detail: {
                connected: result.connected,
                provider: result.provider,
                model: result.model,
                error: result.error || undefined,
            },
        });
        return res.json({
            success: true,
            data: {
                connected: result.connected,
                provider: result.provider,
                model: result.model,
                error: result.error || undefined,
            },
        });
    }
});
/** 服务端权威厂商目录（模型配置页与查询中心共用） */
router.get('/providers/catalog', (_req, res) => {
    res.json({ success: true, data: (0, provider_catalog_1.publicProviderCatalog)() });
});
/** 兼容旧入口：统一返回权威目录，避免前后端两套厂商信息漂移 */
router.get('/providers/builtin', (_req, res) => {
    res.json({ success: true, data: (0, provider_catalog_1.publicProviderCatalog)() });
});
/**
 * 登录后按服务端白名单查询厂商模型列表。
 * 不接受用户自定义 baseURL；API Key 只用于本次请求，不缓存、不落库、不写日志。
 */
router.post('/providers/fetch-models', auth_1.requireAuth, rate_limit_1.modelFetchLimiter, async (req, res) => {
    try {
        const { providerId, endpointId, apiKey } = req.body || {};
        if (!providerId || !apiKey) {
            return res.status(400).json({ success: false, error: '缺少 providerId 或 apiKey' });
        }
        if ('baseURL' in (req.body || {}) || 'url' in (req.body || {})) {
            return res.status(400).json({ success: false, error: '不允许自定义请求地址，请选择官方厂商 Endpoint' });
        }
        const ids = await (0, model_fetch_service_1.fetchCatalogProviderModels)({ providerId, endpointId, apiKey });
        res.json({ success: true, data: ids, count: ids.length });
    }
    catch (err) {
        (0, http_error_1.sendError)(res, err);
    }
});
/** 平台免费额度（云函数 4 个免费模型）元信息，供配置中心展示与一键选用 */
router.get('/providers/aibak-free', (_req, res) => {
    res.json({ success: true, data: ai_models_1.AIBAK_FREE_MODELS });
});
exports.default = router;
//# sourceMappingURL=model-config.js.map