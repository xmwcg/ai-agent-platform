"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockProvider = void 0;
/** Mock Provider（演示模式，默认可用、永不失败） */
const media_gen_shared_1 = require("../media-gen.shared");
class MockProvider {
    constructor() {
        this.name = 'mock';
        this.label = '演示模式（Mock）';
        this.supportedTypes = ['text2img', 'image2image', 'text2video', 'image2video'];
    }
    isConfigured() {
        return true;
    }
    async generate(params) {
        const taskId = (0, media_gen_shared_1.genTaskId)();
        const result = {
            type: params.type,
            taskId,
            status: 'processing',
            prompt: params.prompt,
            outputUrl: '',
            thumbnailUrl: media_gen_shared_1.PLACEHOLDER_IMAGE,
            duration: params.type.includes('video') ? params.duration || 5 : undefined,
            provider: 'mock',
            note: 'Mock 模式：任务已提交，约 2 秒后完成（演示异步轮询）。配置对应厂商 API Key 后将生成真实媒体文件。',
        };
        await (0, media_gen_shared_1.persistTask)(taskId, result);
        return result;
    }
    /** 模拟异步：提交 2 秒后转为已完成并返回占位图 */
    async queryTask(taskId, _credentials) {
        const task = await (0, media_gen_shared_1.retrieveTask)(taskId);
        if (!task)
            throw new Error('任务不存在或已过期');
        if (Date.now() - task.createdAt > 2000) {
            task.status = 'completed';
            task.outputUrl = media_gen_shared_1.PLACEHOLDER_IMAGE;
            task.note = 'Mock 模式：生成完成（占位图）。';
        }
        return task;
    }
}
exports.MockProvider = MockProvider;
//# sourceMappingURL=mock.provider.js.map