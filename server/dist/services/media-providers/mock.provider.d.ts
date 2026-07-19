/** Mock Provider（演示模式，默认可用、永不失败） */
import { type MediaGenParams, type MediaGenResult, type MediaCredentials, type MediaProvider, type MediaTaskType } from '../media-gen.shared';
declare class MockProvider implements MediaProvider {
    name: "mock";
    label: string;
    supportedTypes: MediaTaskType[];
    isConfigured(): boolean;
    generate(params: MediaGenParams): Promise<MediaGenResult>;
    /** 模拟异步：提交 2 秒后转为已完成并返回占位图 */
    queryTask(taskId: string, _credentials?: MediaCredentials): Promise<MediaGenResult>;
}
export { MockProvider };
//# sourceMappingURL=mock.provider.d.ts.map