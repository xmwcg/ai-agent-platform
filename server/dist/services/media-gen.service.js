"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaGenService = exports.TongyiProvider = exports.JimengProvider = exports.KelingProvider = exports.HunyuanProvider = exports.CloudbaseImageProvider = void 0;
exports.ensureAgnesLoaded = ensureAgnesLoaded;
exports.listMediaProviders = listMediaProviders;
exports.selectMediaProvider = selectMediaProvider;
/**
 * 媒体生成服务 - 编排层
 * 多厂商 Provider 抽象（混元 / 可灵 / 即梦 / Mock），统一接口、可插拔、无密钥自动降级演示。
 * Provider 实现拆分见 ./media-providers/*，共享类型/任务存储见 ./media-gen.shared.ts
 */
const mock_provider_1 = require("./media-providers/mock.provider");
const cloudbase_provider_1 = require("./media-providers/cloudbase.provider");
Object.defineProperty(exports, "CloudbaseImageProvider", { enumerable: true, get: function () { return cloudbase_provider_1.CloudbaseImageProvider; } });
const hunyuan_provider_1 = require("./media-providers/hunyuan.provider");
Object.defineProperty(exports, "HunyuanProvider", { enumerable: true, get: function () { return hunyuan_provider_1.HunyuanProvider; } });
const tongyi_provider_1 = require("./media-providers/tongyi.provider");
Object.defineProperty(exports, "TongyiProvider", { enumerable: true, get: function () { return tongyi_provider_1.TongyiProvider; } });
const keling_provider_1 = require("./media-providers/keling.provider");
Object.defineProperty(exports, "KelingProvider", { enumerable: true, get: function () { return keling_provider_1.KelingProvider; } });
const jimeng_provider_1 = require("./media-providers/jimeng.provider");
Object.defineProperty(exports, "JimengProvider", { enumerable: true, get: function () { return jimeng_provider_1.JimengProvider; } });
const moneyprinterturbo_provider_1 = require("./media-providers/moneyprinterturbo.provider");
const agnes_provider_1 = require("./media-providers/agnes.provider");
const http_error_1 = require("../lib/http-error");
const PROVIDERS = {
    mock: new mock_provider_1.MockProvider(),
    hunyuan: new hunyuan_provider_1.HunyuanProvider(),
    keling: new keling_provider_1.KelingProvider(),
    jimeng: new jimeng_provider_1.JimengProvider(),
    moneyprinterturbo: new moneyprinterturbo_provider_1.MoneyPrinterTurboProvider(),
    'cloudbase-free': new cloudbase_provider_1.CloudbaseImageProvider(),
    tongyi: new tongyi_provider_1.TongyiProvider(),
    agnes: agnes_provider_1.agnesProvider,
};
// 启动/配置变更时预加载 Agnes 配置（与 AI 网关共用 ModelConfig），失败不致命
void agnes_provider_1.agnesProvider.reload().catch(() => { });
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
function assertMockAllowed(providerName) {
    if (isProduction() && providerName === 'mock') {
        throw new http_error_1.AppError(503, '生产环境未启用演示媒体服务，请配置真实媒体生成厂商', 'MEDIA_MOCK_DISABLED');
    }
}
function hasInjectedCredentials(providerName, credentials) {
    if (!credentials)
        return false;
    if (providerName === 'hunyuan')
        return !!credentials.secretId && !!credentials.secretKey;
    if (providerName === 'keling' || providerName === 'jimeng' || providerName === 'tongyi')
        return !!credentials.secretKey;
    return false;
}
/** 确保 Agnes 媒体配置已从 DB 加载（容器重启/启动期竞态后调用，返回是否已配置）。 */
async function ensureAgnesLoaded() {
    if (!agnes_provider_1.agnesProvider.isConfigured()) {
        await agnes_provider_1.agnesProvider.reload().catch(() => { });
    }
    return agnes_provider_1.agnesProvider.isConfigured();
}
function listMediaProviders() {
    return Object.values(PROVIDERS).filter(Boolean).map((p) => ({
        name: p.name,
        label: p.label,
        supportedTypes: p.supportedTypes,
        configured: p.name === 'mock' && isProduction() ? false : p.isConfigured(),
    }));
}
/**
 * 厂商选择：显式指定(已配置) > 自动已配置厂商 > 云函数免费额度(文生图/图生图) > Mock
 * 保证免费用户也能产出真实图像（HY-Image 免费额度），杜绝占位假图。
 */
function selectMediaProvider(preferred, type, credentials) {
    const requestedType = (type || 'text2img');
    if (preferred) {
        const selected = PROVIDERS[preferred];
        if (!selected) {
            throw new http_error_1.AppError(400, '不支持的媒体生成厂商', 'MEDIA_PROVIDER_UNSUPPORTED');
        }
        assertMockAllowed(preferred);
        if (!selected.supportedTypes.includes(requestedType)) {
            throw new http_error_1.AppError(400, '所选厂商不支持该媒体类型', 'MEDIA_TYPE_UNSUPPORTED');
        }
        if (selected.isConfigured() || hasInjectedCredentials(preferred, credentials))
            return selected;
    }
    for (const name of ['agnes', 'hunyuan', 'keling', 'jimeng', 'moneyprinterturbo', 'tongyi']) {
        const p = PROVIDERS[name];
        if (p.isConfigured() && p.supportedTypes.includes(requestedType))
            return p;
    }
    if ((requestedType === 'text2img' || requestedType === 'image2image') && PROVIDERS['cloudbase-free'].isConfigured()) {
        return PROVIDERS['cloudbase-free'];
    }
    if (isProduction()) {
        throw new http_error_1.AppError(503, '没有可用的真实媒体生成厂商，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE');
    }
    return PROVIDERS.mock;
}
class MediaGenService {
    async generate(params) {
        if (!params?.prompt?.trim())
            throw new Error('提示词不能为空');
        if (params.provider)
            assertMockAllowed(params.provider);
        // 仅在自动选厂商或显式选择 Agnes 时惰性加载其 DB 配置。
        // 显式 Mock/其他厂商不应被无关的 Agnes 数据库查询阻塞，尤其是本地测试与降级联调。
        if ((!params.provider || params.provider === 'agnes') && !agnes_provider_1.agnesProvider.isConfigured()) {
            await agnes_provider_1.agnesProvider.reload().catch(() => { });
        }
        const mockMode = !isProduction() && process.env.ENABLE_MOCK_MODE === 'true';
        const provider = mockMode
            ? PROVIDERS.mock
            : selectMediaProvider(params.provider, params.type, params.credentials);
        assertMockAllowed(provider.name);
        return provider.generate(params);
    }
    /** 轮询异步任务状态（视频/图像生成）。credentials 用于 BYOK 厂商鉴权。 */
    async queryTask(providerName, taskId, credentials) {
        assertMockAllowed(providerName);
        const p = PROVIDERS[providerName];
        if (!p)
            throw new http_error_1.AppError(400, '未知媒体生成厂商', 'MEDIA_PROVIDER_UNSUPPORTED');
        if (!p.queryTask)
            throw new http_error_1.AppError(400, '该厂商不支持任务查询', 'MEDIA_QUERY_UNSUPPORTED');
        return p.queryTask(taskId, credentials);
    }
}
exports.mediaGenService = new MediaGenService();
//# sourceMappingURL=media-gen.service.js.map