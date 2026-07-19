import { type MediaGenParams, type MediaGenResult, type MediaCredentials, type MediaProvider, type MediaTaskType, type StoredTask } from '../media-gen.shared';
/** Cloudbase 任务持久化时额外携带的参考图字段 */
export interface CloudbaseStoredTask extends StoredTask {
    imageBase64?: string;
    imageUrl?: string;
}
export declare class CloudbaseImageProvider implements MediaProvider {
    name: "cloudbase-free";
    label: string;
    supportedTypes: MediaTaskType[];
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, _credentials?: MediaCredentials): Promise<MediaGenResult>;
}
//# sourceMappingURL=cloudbase.provider.d.ts.map