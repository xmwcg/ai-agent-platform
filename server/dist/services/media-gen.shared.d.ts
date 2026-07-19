export type MediaTaskType = 'text2img' | 'image2image' | 'text2video' | 'image2video';
export type MediaProviderName = 'mock' | 'hunyuan' | 'keling' | 'jimeng' | 'moneyprinterturbo' | 'cloudbase-free' | 'tongyi' | 'agnes';
/**
 * BYOK 凭据（用户自带 Key）。随调用注入，绝不污染单例 provider 实例，避免并发竞态。
 * - 混元（TC3）：secretId + secretKey 一对
 * - 可灵 / 即梦：仅 secretKey（即 Bearer Token）
 */
export interface MediaCredentials {
    secretId?: string;
    secretKey?: string;
}
export interface MediaGenParams {
    type: MediaTaskType;
    prompt: string;
    imageBase64?: string;
    imageUrl?: string;
    negativePrompt?: string;
    duration?: number;
    size?: string;
    style?: string;
    /** 生成数量（文生图，1-4） */
    n?: number;
    /** 显式指定厂商 */
    provider?: MediaProviderName;
    /** BYOK：随调用传入的用户凭据，优先于环境变量（平台级 Key） */
    credentials?: MediaCredentials;
}
export interface MediaGenResult {
    type: MediaTaskType;
    taskId: string;
    status: 'completed' | 'processing';
    prompt: string;
    outputUrl: string;
    /** 多图结果（如混元一次生成多张），outputUrl 为其中主图 */
    images?: string[];
    thumbnailUrl?: string;
    duration?: number;
    provider: string;
    note: string;
}
export interface MediaProvider {
    name: MediaProviderName;
    label: string;
    supportedTypes: MediaTaskType[];
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    queryTask?(taskId: string, credentials?: MediaCredentials): Promise<MediaGenResult>;
}
declare const PLACEHOLDER_IMAGE = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJkMzU0OCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWkgUHJvZHVjdGlvbiBSZXN1bHQ8L3RleHQ+PC9zdmc+";
export declare function genTaskId(): string;
export interface StoredTask extends MediaGenResult {
    createdAt: number;
}
/** 持久化存储任务状态；生产环境 MongoDB 不可用时直接失败。 */
export declare function persistTask(taskId: string, result: MediaGenResult): Promise<void>;
/** 从持久化存储检索任务；生产环境 MongoDB 不可用时直接失败。 */
export declare function retrieveTask(taskId: string): Promise<StoredTask | null>;
/** 从任务状态对象推断媒体类型（缺省文生视频） */
export declare function params_type_from_status(d: unknown): MediaTaskType;
export { PLACEHOLDER_IMAGE };
//# sourceMappingURL=media-gen.shared.d.ts.map