"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CloudbaseImageProvider = void 0;
/** 云函数免费额度（HY-Image 文生图 / 图生图）Provider */
const cloudbase_ai_service_1 = require("../cloudbase-ai.service");
const media_gen_shared_1 = require("../media-gen.shared");
class CloudbaseImageProvider {
    constructor() {
        this.name = 'cloudbase-free';
        this.label = 'AIbak 免费额度（HY-Image）';
        this.supportedTypes = ['text2img', 'image2image'];
    }
    isConfigured() {
        return true; // 免费额度默认可用，无需密钥
    }
    async generate(params) {
        const isImage2Image = params.type === 'image2image';
        const model = isImage2Image
            ? 'HY-Image-v3.0-I2I-ToB-v1.0.1'
            : 'HY-Image-3.0-Plus-4090-Tob-v1.0';
        const taskId = (0, media_gen_shared_1.genTaskId)();
        const result = {
            type: params.type,
            taskId,
            status: 'processing',
            prompt: params.prompt,
            outputUrl: '',
            provider: 'cloudbase-free',
            note: '正在调用云函数 HY-Image 免费额度生成图像……',
            // 图生图参考图随任务持久化，供 queryTask 回源
            ...(isImage2Image && params.imageBase64 ? { imageBase64: params.imageBase64 } : {}),
            ...(isImage2Image && params.imageUrl ? { imageUrl: params.imageUrl } : {}),
        };
        await (0, media_gen_shared_1.persistTask)(taskId, result);
        return result;
    }
    async queryTask(taskId, _credentials) {
        const task = (await (0, media_gen_shared_1.retrieveTask)(taskId));
        if (!task)
            throw new Error('任务不存在或已过期');
        if (task.status === 'completed')
            return task;
        const isImage2Image = task.type === 'image2image';
        const model = isImage2Image
            ? 'HY-Image-v3.0-I2I-ToB-v1.0.1'
            : 'HY-Image-3.0-Plus-4090-Tob-v1.0';
        const images = await (0, cloudbase_ai_service_1.callCloudbaseImage)(model, task.prompt, {
            size: '1024x1024',
            ...(isImage2Image && task.imageBase64 ? { imageBase64: task.imageBase64 } : {}),
            ...(isImage2Image && task.imageUrl ? { imageUrl: task.imageUrl } : {}),
        });
        const completed = {
            ...task,
            status: 'completed',
            outputUrl: images[0] || '',
            images,
            provider: 'cloudbase-free',
            note: '云函数 HY-Image 免费额度生成完成。',
        };
        await (0, media_gen_shared_1.persistTask)(taskId, completed);
        return completed;
    }
}
exports.CloudbaseImageProvider = CloudbaseImageProvider;
//# sourceMappingURL=cloudbase.provider.js.map