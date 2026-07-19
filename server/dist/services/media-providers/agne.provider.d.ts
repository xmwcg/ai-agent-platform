import { type MediaGenParams, type MediaGenResult, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
export declare class AgneProvider implements MediaProvider {
    name: "agnes";
    label: string;
    supportedTypes: MediaTaskType[];
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    /** 轮询任务结果：GET {root}/agnesapi?video_id=<taskId>；completed 时读取 url */
    queryTask(taskId: string): Promise<MediaGenResult>;
}
//# sourceMappingURL=agne.provider.d.ts.map