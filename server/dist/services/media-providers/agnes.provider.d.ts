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
    /** 已落盘任务缓存，避免同一任务跨轮询重复下载（进程内有效，重启后由磁盘存在性兜底）。 */
    private localizedTasks;
    /**
     * 把上游视频落盘到本地 /generated 目录，返回稳定可公开访问的 URL。
     * - 落盘用对象存储抽象（默认 LocalStorage 写 uploads/generated，由 /generated 静态路由对外提供；
     *   COS 已配置时自动落到云存储，返回云 URL）。
     * - 落盘失败不致命：回退返回上游地址，保证成片始终可访问。
     */
    private localizeVideo;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask(taskId: string, _creds?: MediaCredentials): Promise<MediaGenResult>;
}
export declare const agnesProvider: AgnesProvider;
//# sourceMappingURL=agnes.provider.d.ts.map