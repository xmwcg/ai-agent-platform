"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.KelingProvider = void 0;
/** 可灵 Kling（快手）Provider */
const axios_1 = __importDefault(require("axios"));
const media_gen_shared_1 = require("../media-gen.shared");
class KelingProvider {
    constructor() {
        this.name = 'keling';
        this.label = '可灵 Kling（快手）';
        this.supportedTypes = ['text2video', 'image2video'];
    }
    get envToken() {
        return process.env.KELING_API_TOKEN || '';
    }
    /** BYOK 凭据（secretKey=Bearer Token）优先，否则回退平台环境变量 */
    resolveToken(creds) {
        return creds?.secretKey ?? this.envToken;
    }
    isConfigured() {
        return !!this.envToken;
    }
    async generate(params) {
        const token = this.resolveToken(params.credentials);
        if (!token)
            throw new Error('可灵未配置：请在 .env 设置 KELING_API_TOKEN，或配置自带 Key（BYOK）');
        const endpoint = params.type === 'image2video'
            ? 'https://api.klingai.com/v1/images2videos'
            : 'https://api.klingai.com/v1/text2videos';
        const body = {
            prompt: params.prompt,
            mode: 'std',
            duration: params.duration || 5,
            ...(params.imageBase64 ? { image: params.imageBase64 } : {}),
        };
        const resp = await axios_1.default.post(endpoint, body, { headers: { Authorization: `Bearer ${token}` } });
        const vendorTaskId = String(resp.data?.data?.task_id || resp.data?.task_id || (0, media_gen_shared_1.genTaskId)());
        const result = {
            type: params.type,
            taskId: vendorTaskId,
            status: 'processing',
            prompt: params.prompt,
            outputUrl: '',
            provider: 'keling',
            note: '已提交可灵任务，可调用 queryTask 轮询结果。',
        };
        await (0, media_gen_shared_1.persistTask)(vendorTaskId, result);
        return result;
    }
    async queryTask(taskId, credentials) {
        const token = this.resolveToken(credentials);
        if (!token)
            throw new Error('可灵未配置');
        const resp = await axios_1.default.get(`https://api.klingai.com/v1/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        const d = resp.data?.data || {};
        const completed = d.task_status === 'succeed' || d.task_status === 'completed';
        return {
            type: (0, media_gen_shared_1.params_type_from_status)(d),
            taskId,
            status: completed ? 'completed' : 'processing',
            prompt: '',
            outputUrl: completed ? d.task_result?.videos?.[0]?.url || '' : '',
            provider: 'keling',
            note: completed ? '可灵任务完成。' : '可灵任务处理中……',
        };
    }
}
exports.KelingProvider = KelingProvider;
//# sourceMappingURL=keling.provider.js.map