import { type MediaGenParams, type MediaGenResult, type MediaCredentials, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
export declare class HunyuanProvider implements MediaProvider {
    name: "hunyuan";
    label: string;
    supportedTypes: MediaTaskType[];
    /** 平台级凭据（环境变量），BYOK 时由调用方传入 credentials 覆盖 */
    private get secretId();
    private get secretKey();
    /** 凭据解析：传入的 BYOK 凭据优先，否则回退平台环境变量（避免污染单例、避并发竞态） */
    private resolveCreds;
    isConfigured(): boolean;
    private buildHeaders;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}
//# sourceMappingURL=hunyuan.provider.d.ts.map