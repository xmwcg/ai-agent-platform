import { CloudbaseImageProvider } from './media-providers/cloudbase.provider';
import { HunyuanProvider } from './media-providers/hunyuan.provider';
import { TongyiProvider } from './media-providers/tongyi.provider';
import { KelingProvider } from './media-providers/keling.provider';
import { JimengProvider } from './media-providers/jimeng.provider';
import type { MediaTaskType, MediaProviderName, MediaCredentials, MediaGenParams, MediaGenResult, MediaProvider } from './media-gen.shared';
export type { MediaTaskType, MediaProviderName, MediaCredentials, MediaGenParams, MediaGenResult, MediaProvider, } from './media-gen.shared';
export { CloudbaseImageProvider, HunyuanProvider, KelingProvider, JimengProvider, TongyiProvider, };
/** 确保 Agnes 媒体配置已从 DB 加载（容器重启/启动期竞态后调用，返回是否已配置）。 */
export declare function ensureAgnesLoaded(): Promise<boolean>;
export declare function listMediaProviders(): {
    name: MediaProviderName;
    label: string;
    supportedTypes: MediaTaskType[];
    configured: boolean;
}[];
/**
 * 厂商选择：显式指定(已配置) > 自动已配置厂商 > 云函数免费额度(文生图/图生图) > Mock
 * 保证免费用户也能产出真实图像（HY-Image 免费额度），杜绝占位假图。
 */
export declare function selectMediaProvider(preferred?: MediaProviderName, type?: MediaTaskType, credentials?: MediaCredentials): MediaProvider;
declare class MediaGenService {
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    /** 轮询异步任务状态（视频/图像生成）。credentials 用于 BYOK 厂商鉴权。 */
    queryTask(providerName: MediaProviderName, taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}
export declare const mediaGenService: MediaGenService;
//# sourceMappingURL=media-gen.service.d.ts.map