"use strict";
/**
 * AI 网关（OmniRoute 风格）
 * ----------------------------------------------------------------
 * 参考 diegosouzapw/OmniRoute 的设计：本地优先、单入口统一路由多家 AI 厂商，
 * 支持「provider 注册表 + 前缀寻址 + fallback 策略 + 协议翻译」。
 *
 * 与我们系统的结合点：
 *   - 把现有 ai-models.ts 的各家客户端纳入统一 Provider 注册表；
 *   - 把 media-gen.service.ts 里已落地的【腾讯云 TC3-HMAC-SHA256 签名】
 *     作为本网关的 `hunyuan` provider（用于混元大模型对话，与媒体生成复用同一签名算法）；
 *   - 提供 route() 统一入口，路由层 / 技能层 / 开放 API 市场都只调它，不直接散落 axios；
 *   - 支持 priority fallback 策略（主厂商失败自动切备份），并尊重 ENABLE_MOCK_MODE。
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.reloadCustomProviders = reloadCustomProviders;
exports.reloadGatewayProviders = reloadGatewayProviders;
exports.listGatewayProviders = listGatewayProviders;
exports.listGatewayModels = listGatewayModels;
exports.route = route;
const axios_1 = __importDefault(require("axios"));
const openai_1 = __importDefault(require("openai"));
const ai_models_1 = require("../config/ai-models");
const tc3_1 = require("../lib/tc3");
const logger_1 = require("../lib/logger");
const http_error_1 = require("../lib/http-error");
/* ------------------------------ Mock Provider ------------------------------ */
class MockGatewayProvider {
    constructor() {
        this.name = 'mock';
        this.label = '演示模式（Mock）';
    }
    isConfigured() {
        return true;
    }
    owns(model) {
        // mock 仅作为显式指定或兜底，不贪婪匹配任意模型，避免抢占真实/自定义 provider 路由
        return model === 'mock';
    }
    models() {
        return [];
    }
    async chat(req) {
        const last = req.messages[req.messages.length - 1]?.content || '';
        return {
            reply: `[Mock] 已收到你的消息：「${last.slice(0, 40)}」。在 .env 中配置厂商 API Key 后可获得真实回复。`,
            provider: 'mock',
            model: 'mock-gpt-4',
            usage: { prompt_tokens: 0, completion_tokens: 0 },
        };
    }
}
/* ------------------------------ OpenAI 兼容 Provider ------------------------------ */
class OpenAICompatibleProvider {
    constructor(name, label, baseURL, apiKey, modelPrefix, modelList = []) {
        this.name = name;
        this.label = label;
        this.baseURL = baseURL;
        this.apiKey = apiKey;
        this.modelPrefix = modelPrefix;
        this.modelList = modelList;
    }
    isConfigured() {
        return !!this.apiKey;
    }
    owns(model) {
        return model.startsWith(this.modelPrefix + "/") || model === this.modelPrefix || this.modelList.includes(model);
    }
    models() {
        return this.modelList;
    }
    async chat(req, model) {
        const client = new openai_1.default({ apiKey: this.apiKey, baseURL: this.baseURL });
        const rawModel = model.includes('/') ? model.split('/').slice(1).join('/') : model;
        // Model names are passed through directly (DeepSeek API now supports v4-flash/v4-pro natively)
        const resolved = rawModel;
        const completion = await client.chat.completions.create({
            model: resolved,
            messages: req.messages,
            temperature: req.temperature ?? 0.7,
            max_tokens: req.maxTokens ?? 2000,
        });
        return {
            reply: completion.choices[0]?.message?.content || '',
            provider: this.name,
            model: resolved, // display name (not api model)
            usage: completion.usage,
        };
    }
}
/* ------------------------------ CloudBase AI Gateway Provider ------------------------------ */
// CloudBase AI Gateway 兼容 OpenAI Chat Completions。优先使用服务端 API Key 直连，
// 并保留 ai-chat 云函数作为旧环境或网关不可用时的兼容回退。
class CloudbaseChatProvider {
    constructor() {
        this.name = 'cloudbase';
        this.label = 'CloudBase AI';
        this.modelList = ['hunyuan-2.0-instruct-20251111'];
    }
    get baseURL() {
        return process.env.CLOUDBASE_FREE_BASE_URL || '';
    }
    get apiKey() {
        return process.env.CLOUDBASE_FREE_API_KEY || '';
    }
    get functionURL() {
        return process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL || '';
    }
    isConfigured() {
        return !!(this.baseURL && this.apiKey) || !!this.functionURL;
    }
    owns(model) {
        return model.startsWith('cloudbase/') || model === 'cloudbase' || this.modelList.includes(model);
    }
    models() {
        return this.modelList;
    }
    async chat(req, model) {
        const rawModel = model.includes('/') ? model.split('/').slice(1).join('/') : model;
        if (this.baseURL && this.apiKey) {
            const client = new openai_1.default({ apiKey: this.apiKey, baseURL: this.baseURL });
            const completion = await client.chat.completions.create({
                model: rawModel,
                messages: req.messages,
                temperature: req.temperature ?? 0.7,
                max_tokens: req.maxTokens ?? 2000,
            });
            return {
                reply: completion.choices[0]?.message?.content || '',
                provider: 'cloudbase',
                model: rawModel,
                usage: completion.usage,
            };
        }
        const resp = await axios_1.default.post(this.functionURL, { messages: req.messages, model: rawModel, stream: false }, { headers: { 'Content-Type': 'application/json' }, timeout: 60000 });
        if (resp.data?.success) {
            return {
                reply: resp.data.text || '',
                provider: 'cloudbase',
                model: rawModel,
                usage: resp.data.usage,
            };
        }
        throw new Error(resp.data?.error || 'CLOUDBASE_FN_ERROR');
    }
}
/* ------------------------------ 腾讯混元（TC3 签名） ------------------------------ */
const HUNYUAN_HOST = 'hunyuan.tencentcloudapi.com';
const HUNYUAN_VERSION = '2023-09-01';
class HunyuanGatewayProvider {
    constructor() {
        this.name = 'hunyuan';
        this.label = '腾讯混元';
    }
    get secretId() {
        return process.env.HUNYUAN_SECRET_ID || process.env.HUNYUAN_API_KEY || '';
    }
    get secretKey() {
        return process.env.HUNYUAN_SECRET_KEY || '';
    }
    isConfigured() {
        return !!this.secretId && !!this.secretKey;
    }
    owns(model) {
        return model.startsWith('hunyuan/') || model === 'hunyuan';
    }
    models() {
        return ['hunyuan-pro', 'hunyuan-std', 'hunyuan-lite'];
    }
    async chat(req, model) {
        if (!this.isConfigured())
            throw new Error('混元未配置：设置 HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY');
        const resolved = model.includes('/') ? model.split('/')[1] : 'hunyuan-pro';
        const payload = JSON.stringify({
            Model: resolved,
            Messages: req.messages.map((m) => ({ Role: m.role, Content: m.content })),
            ...(req.temperature != null ? { Temperature: req.temperature } : {}),
            ...(req.maxTokens != null ? { MaxTokens: req.maxTokens } : {}),
        });
        const timestamp = Math.floor(Date.now() / 1000);
        const { authorization } = (0, tc3_1.signTencentTC3)({
            secretId: this.secretId,
            secretKey: this.secretKey,
            service: 'hunyuan',
            host: HUNYUAN_HOST,
            action: 'ChatCompletions',
            version: HUNYUAN_VERSION,
            region: 'ap-guangzhou',
            payload,
            timestamp,
        });
        const resp = await axios_1.default.post(`https://${HUNYUAN_HOST}/`, payload, {
            headers: {
                'Content-Type': 'application/json; charset=utf-8',
                Host: HUNYUAN_HOST,
                'X-TC-Action': 'ChatCompletions',
                'X-TC-Version': HUNYUAN_VERSION,
                'X-TC-Region': 'ap-guangzhou',
                'X-TC-Timestamp': String(timestamp),
                Authorization: authorization,
            },
        });
        const d = resp.data?.Response || {};
        if (d.Error)
            throw new Error(`混元错误：${d.Error.Code} ${d.Error.Message}`);
        return {
            reply: d.Choices?.[0]?.Message?.Content || d.Reply || '',
            provider: 'hunyuan',
            model: resolved,
            usage: d.Usage,
        };
    }
}
/* ------------------------------ 注册表 ------------------------------ */
function buildProviders() {
    const production = process.env.NODE_ENV === 'production';
    const mockMode = !production && process.env.ENABLE_MOCK_MODE === 'true';
    const list = [];
    if (mockMode) {
        list.push(new MockGatewayProvider());
        return list;
    }
    // Agnes AIHub（免费模型网关，OpenAI 兼容：文本/图像/视频）
    if (process.env.AGNES_API_KEY)
        list.push(new OpenAICompatibleProvider('agnes', 'Agnes AIHub', process.env.AGNES_BASE_URL || 'https://apihub.agnes-ai.com/v1', process.env.AGNES_API_KEY, 'agnes', ['agnes-2.0-flash', 'agnes-image-2.0-flash', 'agnes-image-2.1-flash', 'agnes-video-v2.0']));
    // 腾讯云 CloudBase「小程序免费计划」额度（经云函数中转 hy3/hy3-preview，绕开渠道限制）
    // 仅当配置了 jymkj-knowlage 云函数 HTTP 触发地址时才注册；未部署/未填 URL 时不显示该选项，
    // 由 fallback 接 agnes，避免暴露一个选了会失败的不可用渠道。
    if (process.env.CLOUDBASE_KNOWLEDGE_CHAT_URL)
        list.push(new CloudbaseChatProvider());
    if (process.env.OPENAI_API_KEY)
        list.push(new OpenAICompatibleProvider('openai', 'OpenAI', process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1', process.env.OPENAI_API_KEY, 'openai', ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']));
    if (process.env.ANTHROPIC_API_KEY)
        list.push(new OpenAICompatibleProvider('anthropic', 'Anthropic', 'https://api.anthropic.com/v1', process.env.ANTHROPIC_API_KEY, 'anthropic', ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku']));
    // DeepSeek 自购接口仅供服务端内部调用，不会进入公开模型列表或公开 fallback。
    if (process.env.DEEPSEEK_API_KEY)
        list.push(new OpenAICompatibleProvider('deepseek', 'DeepSeek（私有）', process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1', process.env.DEEPSEEK_API_KEY, 'deepseek', ['deepseek-v4-pro', 'deepseek-v4-flash']));
    // 智谱 GLM（OpenAI 兼容）
    if (process.env.ZHIPU_API_KEY)
        list.push(new OpenAICompatibleProvider('zhipu', '智谱 GLM', 'https://open.bigmodel.cn/api/paas/v4', process.env.ZHIPU_API_KEY, 'zhipu', ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4-long']));
    // 通义千问（阿里云 DashScope，OpenAI 兼容）
    if (process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY)
        list.push(new OpenAICompatibleProvider('qwen', '通义千问', 'https://dashscope.aliyuncs.com/compatible-mode/v1', process.env.QWEN_API_KEY || process.env.DASHSCOPE_API_KEY, 'qwen', ['qwen-plus', 'qwen-max', 'qwen-turbo', 'qwen-long', 'qwen-vl-max']));
    // 豆包（火山方舟，OpenAI 兼容）
    if (process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY)
        list.push(new OpenAICompatibleProvider('doubao', '豆包', 'https://ark.cn-beijing.volces.com/api/v3', process.env.DOUBAO_API_KEY || process.env.ARK_API_KEY, 'doubao', ['doubao-pro-32k', 'doubao-pro-128k', 'doubao-lite-32k']));
    if (process.env.HUNYUAN_SECRET_ID && process.env.HUNYUAN_SECRET_KEY)
        list.push(new HunyuanGatewayProvider());
    return list;
}
let PROVIDERS = buildProviders();
/**
 * 第三方自定义模型（用户 ModelConfig）注入网关。
 * 这是「接入第三方模型 API」闭环的关键：用户在前端保存的 OpenAI 兼容端点
 * 会被加载为独立 provider，前缀为 `mc_<configId>`，聊天路由据此寻址。
 */
const ModelConfig_1 = require("../models/ModelConfig");
const crypto_1 = require("../lib/crypto");
let CUSTOM_PROVIDERS = [];
/**
 * 从数据库加载启用的 ModelConfig 作为自定义 provider。
 * 单测可传入 injected（不触库）以验证路由行为。
 */
async function reloadCustomProviders(injected) {
    let cfgs = injected;
    if (!cfgs) {
        try {
            cfgs = await ModelConfig_1.ModelConfig.find({ enabled: true }).lean();
        }
        catch {
            cfgs = [];
        }
    }
    CUSTOM_PROVIDERS = (cfgs || []).map((c) => {
        const id = String(c._id);
        const prefix = `mc_${id}`;
        // 安全：apiKey 密文落库，加载到网关时解密为明文使用
        const apiKey = (0, crypto_1.decryptSecret)(c.apiKey || '');
        return new OpenAICompatibleProvider(prefix, c.name || `自定义(${c.provider})`, c.baseURL, apiKey, prefix, (c.models && c.models.length > 0 ? c.models : [c.defaultModel]));
    });
}
/** 热重载 provider 注册表（配置变更后调用） */
function reloadGatewayProviders() {
    PROVIDERS = buildProviders();
}
/** 服务端私有 Provider 保留内部调用能力，但不允许公开枚举、显式寻址或 fallback。 */
const PRIVATE_PROVIDER_NAMES = new Set(['deepseek']);
/** 全部可用 provider（内置 + 第三方自定义），供内部路由使用 */
function allProviders() {
    return [...PROVIDERS, ...CUSTOM_PROVIDERS];
}
function publicProviders() {
    return allProviders().filter((p) => !PRIVATE_PROVIDER_NAMES.has(p.name));
}
function listGatewayProviders() {
    return publicProviders().map((p) => ({ name: p.name, label: p.label, configured: p.isConfigured() }));
}
/** 列出全部可选模型（内置 + 第三方自定义），供前端模型选择器
 *  如果自定义 provider 与内置 provider 指向同一 API（同 baseURL + apiKey），
 *  则内置 provider 的模型列表会以自定义 provider 为主，避免重复。 */
function listGatewayModels() {
    const out = [];
    // 收集自定义 provider 的 baseURL 和 apiKey 用于去重
    const customDedup = new Map();
    for (const p of CUSTOM_PROVIDERS) {
        if (p instanceof OpenAICompatibleProvider) {
            const key = p.baseURL + '|' + p.apiKey;
            customDedup.set(key, p.models());
        }
    }
    for (const p of PROVIDERS) {
        if (p.name === 'mock' || PRIVATE_PROVIDER_NAMES.has(p.name))
            continue;
        const models = p.models ? p.models() : [];
        // 检查是否与自定义 provider 重复（同 baseURL + apiKey）
        if (p instanceof OpenAICompatibleProvider) {
            const key = p.baseURL + '|' + p.apiKey;
            if (customDedup.has(key)) {
                // 跳过：自定义 provider 已覆盖此 API
                continue;
            }
        }
        out.push({ provider: p.name, label: p.label, models });
    }
    for (const p of CUSTOM_PROVIDERS) {
        out.push({ provider: p.name, label: p.label, models: p.models ? p.models() : [], custom: true });
    }
    return out;
}
/* ------------------------------ 路由策略 ------------------------------ */
/**
 * priority fallback 策略：按注册顺序尝试，第一个 configured 且能服务的 provider 先上；
 * 调用失败则依次降级到下一个。与 OmniRoute 的 priority combo 一致。
 */
async function route(req) {
    if (process.env.NODE_ENV === 'production'
        && (req.provider === 'mock' || req.model === 'mock' || req.model?.startsWith('mock/'))) {
        throw new http_error_1.AppError(400, '生产环境禁止使用 Mock AI Provider', 'AI_MOCK_DISABLED');
    }
    // reject deprecated model names at gateway level
    const DEPRECATED = new Set(["deepseek-chat", "deepseek-coder", "gpt-3.5-turbo", "gpt-4"]);
    const mName = (req.model || "").split("/").pop() || "";
    if (DEPRECATED.has(mName)) {
        throw new http_error_1.AppError(400, String.fromCharCode(34) + "Model " + JSON.stringify(mName) + " is deprecated" + String.fromCharCode(34), "DEPRECATED_MODEL");
    }
    const requestedProvider = req.provider || (req.model?.includes('/') ? req.model.split('/')[0] : undefined);
    if (req.publicOnly && requestedProvider && PRIVATE_PROVIDER_NAMES.has(requestedProvider)) {
        throw new http_error_1.AppError(403, '该模型不对外开放', 'AI_PROVIDER_PRIVATE');
    }
    const ALL = req.publicOnly ? publicProviders() : allProviders();
    let target;
    // 1. 显式 provider 优先（含第三方自定义 mc_xxx）
    if (req.provider) {
        target = ALL.find((p) => p.name === req.provider && p.isConfigured());
    }
    // 2. 前缀寻址（如 "deepseek/deepseek-v4-flash" 或 "mc_abc/glm-4"）
    if (!target && req.model) {
        target = ALL.find((p) => p.isConfigured() && p.owns(req.model));
    }
    // 3. 默认策略：走 aiModelManager 默认 provider；否则第一个 configured
    if (!target) {
        const def = ai_models_1.aiModelManager.getDefaultProvider();
        const defName = def?.name.toLowerCase();
        target = ALL.find((p) => p.name === defName && p.isConfigured()) || ALL.find((p) => p.isConfigured());
    }
    if (!target)
        throw new Error('没有可用的真实 AI provider（生产环境禁止 Mock，请配置厂商 Key）');
    // fallback：从该 provider 起，依次尝试后续 configured provider（内置 + 自定义）
    const startIdx = ALL.indexOf(target);
    const order = [...ALL.slice(startIdx), ...ALL.slice(0, startIdx)].filter((p) => p.isConfigured());
    let lastErr;
    for (const p of order) {
        try {
            const fallbackModel = p.owns(req.model || '') ? (req.model || '') : (p.models()?.[0] || '');
            return await p.chat(req, fallbackModel);
        }
        catch (e) {
            lastErr = e;
            logger_1.logger.warn('ai-gateway', `provider ${p.name} 失败，尝试降级：${e.message}`);
        }
    }
    throw lastErr || new Error('所有 AI provider 调用失败');
}
//# sourceMappingURL=ai-gateway.service.js.map