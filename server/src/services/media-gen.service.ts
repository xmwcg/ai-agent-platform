/**
 * 媒体生成服务 - 编排层
 * 多厂商 Provider 抽象（混元 / 可灵 / 即梦 / Mock），统一接口、可插拔、无密钥自动降级演示。
 * Provider 实现拆分见 ./media-providers/*，共享类型/任务存储见 ./media-gen.shared.ts
 */
import { MockProvider } from './media-providers/mock.provider';
import { CloudbaseImageProvider } from './media-providers/cloudbase.provider';
import { HunyuanProvider } from './media-providers/hunyuan.provider';
import { KelingProvider } from './media-providers/keling.provider';
import { JimengProvider } from './media-providers/jimeng.provider';
import { MoneyPrinterTurboProvider } from './media-providers/moneyprinterturbo.provider';
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
};

const PROVIDERS: Record<MediaProviderName, MediaProvider> = {
  mock: new MockProvider(),
  hunyuan: new HunyuanProvider(),
  keling: new KelingProvider(),
  jimeng: new JimengProvider(),
  moneyprinterturbo: new MoneyPrinterTurboProvider(),
  'cloudbase-free': new CloudbaseImageProvider(),
};

export function listMediaProviders() {
  return Object.values(PROVIDERS).map((p) => ({
    name: p.name,
    label: p.label,
    supportedTypes: p.supportedTypes,
    configured: p.isConfigured(),
  }));
}

/**
 * 厂商选择：显式指定(已配置) > 自动已配置厂商 > 云函数免费额度(文生图/图生图) > Mock
 * 保证免费用户也能产出真实图像（HY-Image 免费额度），杜绝占位假图。
 */
export function selectMediaProvider(preferred?: MediaProviderName, type?: MediaTaskType): MediaProvider {
  if (preferred && PROVIDERS[preferred]?.isConfigured()) return PROVIDERS[preferred];
  for (const name of ['hunyuan', 'keling', 'jimeng', 'moneyprinterturbo'] as MediaProviderName[]) {
    const p = PROVIDERS[name];
    if (p.isConfigured() && p.supportedTypes.includes((type || 'text2img') as MediaTaskType)) return p;
  }
  if ((type === 'text2img' || type === 'image2image') && PROVIDERS['cloudbase-free'].isConfigured()) {
    return PROVIDERS['cloudbase-free'];
  }
  return PROVIDERS.mock;
}

class MediaGenService {
  async generate(params: MediaGenParams): Promise<MediaGenResult> {
    if (!params?.prompt?.trim()) throw new Error('提示词不能为空');
    const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
    const provider = mockMode ? PROVIDERS.mock : selectMediaProvider(params.provider, params.type);
    return provider.generate(params);
  }

  /** 轮询异步任务状态（视频/图像生成）。credentials 用于 BYOK 厂商鉴权。 */
  async queryTask(providerName: MediaProviderName, taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult> {
    const p = PROVIDERS[providerName];
    if (!p) throw new Error('未知厂商');
    if (!p.queryTask) throw new Error('该厂商不支持任务查询');
    return p.queryTask(taskId, credentials);
  }
}

export const mediaGenService = new MediaGenService();
