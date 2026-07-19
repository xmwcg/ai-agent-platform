import { type MediaCredentials, type MediaGenParams, type MediaGenResult, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
export declare class AgnesProvider implements MediaProvider {
    name: "agnes";
    label: string;
    supportedTypes: MediaTaskType[];
    private cached;
    /** 从 ModelConfig 加载 Agnes 配置（baseURL 含 agnès 的自定义配置），结果缓存。 */
    reload(): Promise<void>;
    private ensureLoaded;
    isConfigured(): boolean;
    private pickModel;
    private headers;
    /** 清洗文本：去换行/回车、合并空白、按上限截断，避免超长脚本触发上游 400。 */
    private cleanText;
    /** 把 axios 错误转成可读详情（带上游响应体），便于诊断。 */
    private errDetail;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, _creds?: MediaCredentials): Promise<MediaGenResult>;
}
export declare const agnesProvider: AgnesProvider;
//# sourceMappingURL=agnes.provider.d.ts.map