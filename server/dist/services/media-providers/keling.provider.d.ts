import { type MediaGenParams, type MediaGenResult, type MediaCredentials, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
export declare class KelingProvider implements MediaProvider {
    name: "keling";
    label: string;
    supportedTypes: MediaTaskType[];
    private get envToken();
    /** BYOK 凭据（secretKey=Bearer Token）优先，否则回退平台环境变量 */
    private resolveToken;
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}
//# sourceMappingURL=keling.provider.d.ts.map