import { type MediaGenParams, type MediaGenResult, type MediaCredentials, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
export declare class TongyiProvider implements MediaProvider {
    name: "tongyi";
    label: string;
    supportedTypes: MediaTaskType[];
    /** 平台级凭据（环境变量），BYOK 时由调用方传入 credentials 覆盖 */
    private get apiKey();
    /** 凭据解析：传入的 BYOK 凭据优先，否则回退平台环境变量 */
    private resolveKey;
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}
//# sourceMappingURL=tongyi.provider.d.ts.map