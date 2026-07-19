"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TongyiProvider = void 0;
/**
 * 阿里云通义万相（DashScope Wanx2.1-T2I）文生图 Provider
 * 真实 API：提交异步任务（image-synthesis）+ 轮询 task 状态。
 * 未配置 TONGYI_API_KEY 时不可用时，由 media-gen 的 selectMediaProvider 自动降级到 Mock。
 */
const axios_1 = __importDefault(require("axios"));
const media_gen_shared_1 = require("../media-gen.shared");
const TONGYI_HOST = 'https://dashscope.aliyuncs.com';
const TONGYI_MODEL = 'wanx2.1-t2i-turbo';
class TongyiProvider {
    constructor() {
        this.name = 'tongyi';
        this.label = '阿里云通义万相';
        this.supportedTypes = ['text2img'];
    }
    /** 平台级凭据（环境变量），BYOK 时由调用方传入 credentials 覆盖 */
    get apiKey() {
        return process.env.TONGYI_API_KEY || '';
    }
    /** 凭据解析：传入的 BYOK 凭据优先，否则回退平台环境变量 */
    resolveKey(creds) {
        return creds?.secretKey ?? this.apiKey;
    }
    isConfigured() {
        return !!this.apiKey;
    }
    async generate(params) {
        const apiKey = this.resolveKey(params.credentials);
        if (!apiKey) {
            throw new Error('通义万相未配置：请在 .env 设置 TONGYI_API_KEY，或配置自带 Key（BYOK）');
        }
        const size = (params.size || '1024x1024').replace('x', '*'); // 1024x1024 → 1024*1024
        const n = Math.min(Math.max(Number(params.n) || 1, 1), 4);
        const resp = await axios_1.default.post(`${TONGYI_HOST}/api/v1/services/aigc/text2image/image-synthesis`, {
            model: TONGYI_MODEL,
            input: { prompt: params.prompt },
            parameters: {
                size,
                n,
                ...(params.style ? { style: params.style } : {}),
            },
        }, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'X-DashScope-Async': 'enable',
            },
            timeout: 30000,
        });
        const taskId = String(resp.data?.output?.task_id || resp.data?.request_id || (0, media_gen_shared_1.genTaskId)());
        const result = {
            type: params.type,
            taskId,
            status: 'processing',
            prompt: params.prompt,
            outputUrl: '',
            provider: 'tongyi',
            note: `已提交通义万相任务（model=${TONGYI_MODEL}），可调用 queryTask 轮询结果。`,
        };
        await (0, media_gen_shared_1.persistTask)(taskId, result);
        return result;
    }
    async queryTask(taskId, credentials) {
        const apiKey = this.resolveKey(credentials);
        if (!apiKey)
            throw new Error('通义万相未配置');
        const resp = await axios_1.default.get(`${TONGYI_HOST}/api/v1/tasks/${taskId}`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 30000,
        });
        const d = resp.data || {};
        if (d.code !== undefined && d.code !== 200 && d.code !== '200') {
            throw new Error(`通义万相查询错误：${d.code} ${d.message || ''}`);
        }
        const status = (d.output?.task_status || '').toUpperCase();
        if (status === 'FAILED') {
            throw new Error(`通义万相任务失败：${d.output?.message || d.message || ''}`);
        }
        const completed = status === 'SUCCEEDED';
        const results = d.output?.results || [];
        const urls = results.map((r) => r.url).filter(Boolean);
        return {
            type: 'text2img',
            taskId,
            status: completed ? 'completed' : 'processing',
            prompt: '',
            outputUrl: completed && urls.length ? urls[0] : '',
            images: completed && urls.length ? urls : undefined,
            provider: 'tongyi',
            note: completed ? '通义万相任务完成。' : '通义万相任务处理中……',
        };
    }
}
exports.TongyiProvider = TongyiProvider;
//# sourceMappingURL=tongyi.provider.js.map