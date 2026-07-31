/**
 * 媒体生成服务 - 编排层
 * 多厂商 Provider 抽象（混元 / 可灵 / 即梦 / Mock），统一接口、可插拔、无密钥自动降级演示。
 * Provider 实现拆分见 ./media-providers/*，共享类型/任务存储见 ./media-gen.shared.ts
 */
import { MockProvider } from './media-providers/mock.provider';
import { CloudbaseImageProvider } from './media-providers/cloudbase.provider';
import { HunyuanProvider } from './media-providers/hunyuan.provider';
import { TongyiProvider } from './media-providers/tongyi.provider';
import { KelingProvider } from './media-providers/keling.provider';
import { JimengProvider } from './media-providers/jimeng.provider';
import { MoneyPrinterTurboProvider } from './media-providers/moneyprinterturbo.provider';
import { agnesProvider } from './media-providers/agnes.provider';
import { AppError } from '../lib/http-error';
import type {
  MediaTaskType,
  MediaProviderName,
  MediaCredentials,
  MediaGenParams,
  MediaGenResult,
  MediaProvider,
} from './media-gen.shared';

// 对外 API 保持不变：类型与 Provider 类从子模块重导出
export type {
  MediaTaskType,
  MediaProviderName,
  MediaCredentials,
  MediaGenParams,
  MediaGenResult,
  MediaProvider,
} from './media-gen.shared';
export {
  CloudbaseImageProvider,
  HunyuanProvider,
  KelingProvider,
  JimengProvider,
  TongyiProvider,
};

const PROVIDERS: Record<MediaProviderName, MediaProvider> = {
  mock: new MockProvider(),
  hunyuan: new HunyuanProvider(),
  keling: new KelingProvider(),
  jimeng: new JimengProvider(),
  moneyprinterturbo: new MoneyPrinterTurboProvider(),
  'cloudbase-free': new CloudbaseImageProvider(),
  tongyi: new TongyiProvider(),
  agnes: agnesProvider,
};

// 启动/配置变更时预加载 Agnes 配置（与 AI 网关共用 ModelConfig），失败不致命
void agnesProvider.reload().catch(() => {});

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

function assertMockAllowed(providerName: MediaProviderName): void {
  if (isProduction() && providerName === 'mock') {
    throw new AppError(503, '生产环境未启用演示媒体服务，请配置真实媒体生成厂商', 'MEDIA_MOCK_DISABLED');
  }
}

function hasInjectedCredentials(providerName: MediaProviderName, credentials?: MediaCredentials): boolean {
  if (!credentials) return false;
  if (providerName === 'hunyuan') return !!credentials.secretId && !!credentials.secretKey;
  if (providerName === 'keling' || providerName === 'jimeng' || providerName === 'tongyi') return !!credentials.secretKey;
  return false;
}

/** 确保 Agnes 媒体配置已从 DB 加载（容器重启/启动期竞态后调用，返回是否已配置）。 */
export async function ensureAgnesLoaded(): Promise<boolean> {
  if (!agnesProvider.isConfigured()) {
    await agnesProvider.reload().catch(() => {});
  }
  return agnesProvider.isConfigured();
}

export function listMediaProviders() {
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
export function selectMediaProvider(
  preferred?: MediaProviderName,
  type?: MediaTaskType,
  credentials?: MediaCredentials
): MediaProvider {
  const requestedType = (type || 'text2img') as MediaTaskType;
  if (preferred) {
    const selected = PROVIDERS[preferred];
    if (!selected) {
      throw new AppError(400, '不支持的媒体生成厂商', 'MEDIA_PROVIDER_UNSUPPORTED');
    }
    assertMockAllowed(preferred);
    if (!selected.supportedTypes.includes(requestedType)) {
      throw new AppError(400, '所选厂商不支持该媒体类型', 'MEDIA_TYPE_UNSUPPORTED');
    }
    if (selected.isConfigured() || hasInjectedCredentials(preferred, credentials)) return selected;
  }
  for (const name of ['agnes', 'hunyuan', 'keling', 'jimeng', 'moneyprinterturbo', 'tongyi'] as MediaProviderName[]) {
    const p = PROVIDERS[name];
    if (p.isConfigured() && p.supportedTypes.includes(requestedType)) return p;
  }
  if ((requestedType === 'text2img' || requestedType === 'image2image') && PROVIDERS['cloudbase-free'].isConfigured()) {
    return PROVIDERS['cloudbase-free'];
  }
  if (isProduction()) {
    throw new AppError(503, '没有可用的真实媒体生成厂商，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE');
  }
  return PROVIDERS.mock;
}

class MediaGenService {
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!params?.prompt?.trim()) throw new Error('提示词不能为空');
    if (params.provider) assertMockAllowed(params.provider);
    // 仅在自动选厂商或显式选择 Agnes 时惰性加载其 DB 配置。
    // 显式 Mock/其他厂商不应被无关的 Agnes 数据库查询阻塞，尤其是本地测试与降级联调。
    if ((!params.provider || params.provider === 'agnes') && !agnesProvider.isConfigured()) {
      await agnesProvider.reload().catch(() => {});
    }
    const mockMode = !isProduction() && process.env.ENABLE_MOCK_MODE === 'true';
    const provider = mockMode
      ? PROVIDERS.mock
      : selectMediaProvider(params.provider, params.type, params.credentials);
    assertMockAllowed(provider.name);
    return provider.generate(params);
  }

  /** 轮询异步任务状态（视频/图像生成）。credentials 用于 BYOK 厂商鉴权。 */
  async queryTask(providerName: MediaProviderName, taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult> {
    assertMockAllowed(providerName);
    const p = PROVIDERS[providerName];
    if (!p) throw new AppError(400, '未知媒体生成厂商', 'MEDIA_PROVIDER_UNSUPPORTED');
    if (!p.queryTask) throw new AppError(400, '该厂商不支持任务查询', 'MEDIA_QUERY_UNSUPPORTED');
    return p.queryTask(taskId, credentials);
  }
}

export const mediaGenService = new MediaGenService();
