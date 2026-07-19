"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.HunyuanProvider = void 0;
/** 腾讯混元 / 智绘 Provider（TC3-HMAC-SHA256 真实验签） */
const axios_1 = __importDefault(require("axios"));
const tc3_1 = require("../../lib/tc3");
const media_gen_shared_1 = require("../media-gen.shared");
const HUNYUAN_HOST = 'hunyuan.tencentcloudapi.com';
const HUNYUAN_VERSION = '2023-09-01';
class HunyuanProvider {
    constructor() {
        this.name = 'hunyuan';
        this.label = '腾讯混元 / 智绘';
        this.supportedTypes = ['text2img', 'image2image', 'text2video', 'image2video'];
    }
    /** 平台级凭据（环境变量），BYOK 时由调用方传入 credentials 覆盖 */
    get secretId() {
        return process.env.HUNYUAN_SECRET_ID || '';
    }
    get secretKey() {
        return process.env.HUNYUAN_SECRET_KEY || '';
    }
    /** 凭据解析：传入的 BYOK 凭据优先，否则回退平台环境变量（避免污染单例、避并发竞态） */
    resolveCreds(creds) {
        return {
            secretId: creds?.secretId ?? this.secretId,
            secretKey: creds?.secretKey ?? this.secretKey,
        };
    }
    isConfigured() {
        return !!this.secretId && !!this.secretKey;
    }
    buildHeaders(action, payload, secretId, secretKey) {
        const timestamp = Math.floor(Date.now() / 1000);
        const { authorization } = (0, tc3_1.signTencentTC3)({
            secretId,
            secretKey,
            service: 'hunyuan',
            host: HUNYUAN_HOST,
            action,
            version: HUNYUAN_VERSION,
            region: 'ap-guangzhou',
            payload,
            timestamp,
        });
        return {
            'Content-Type': 'application/json; charset=utf-8',
            Host: HUNYUAN_HOST,
            'X-TC-Action': action,
            'X-TC-Version': HUNYUAN_VERSION,
            'X-TC-Region': 'ap-guangzhou',
            'X-TC-Timestamp': String(timestamp),
            Authorization: authorization,
        };
    }
    async generate(params) {
        const { secretId, secretKey } = this.resolveCreds(params.credentials);
        if (!secretId || !secretKey)
            throw new Error('混元未配置：请在 .env 设置 HUNYUAN_SECRET_ID / HUNYUAN_SECRET_KEY，或配置自带 Key（BYOK）');
        const isVideo = params.type.includes('video');
        const action = isVideo ? 'SubmitVideoGenerationJob' : 'SubmitImageGenerationJob';
        const body = {
            Prompt: params.prompt,
            ...(params.imageBase64 ? { ImageBase64: params.imageBase64 } : {}),
            ...(params.duration ? { Duration: params.duration } : {}),
            ...(params.style ? { Style: params.style } : {}),
            // 文生图专用参数：分辨率（1024x1024 → 1024:1024）、生成数量
            ...(params.size && !isVideo ? { Resolution: params.size.replace('x', ':') } : {}),
            ...(params.n && !isVideo ? { Num: params.n } : {}),
        };
        const payload = JSON.stringify(body);
        const resp = await axios_1.default.post(`https://${HUNYUAN_HOST}/`, payload, {
            headers: this.buildHeaders(action, payload, secretId, secretKey),
        });
        const respData = resp.data?.Response || {};
        if (respData.Error)
            throw new Error(`混元错误：${respData.Error.Code} ${respData.Error.Message}`);
        const vendorTaskId = String(respData.JobId || respData.TaskId || (0, media_gen_shared_1.genTaskId)());
        const result = {
            type: params.type,
            taskId: vendorTaskId,
            status: 'processing',
            prompt: params.prompt,
            outputUrl: '',
            provider: 'hunyuan',
            note: `已提交混元任务（Action=${action}），可调用 queryTask 轮询结果。`,
        };
        await (0, media_gen_shared_1.persistTask)(vendorTaskId, result);
        return result;
    }
    async queryTask(taskId, credentials) {
        const { secretId, secretKey } = this.resolveCreds(credentials);
        if (!secretId || !secretKey)
            throw new Error('混元未配置');
        const isVideo = taskId.toLowerCase().includes('video');
        const action = isVideo ? 'DescribeVideoGenerationJob' : 'DescribeImageGenerationJob';
        const payload = JSON.stringify({ JobId: taskId });
        const resp = await axios_1.default.post(`https://${HUNYUAN_HOST}/`, payload, {
            headers: this.buildHeaders(action, payload, secretId, secretKey),
        });
        const d = resp.data?.Response || {};
        if (d.Error)
            throw new Error(`混元查询错误：${d.Error.Code}`);
        const status = (d.Status || d.JobStatus || '').toLowerCase();
        const completed = status === 'succeeded' || status === 'success' || status === 'completed';
        const images = d.ResultImages || d.ResultUrls || [];
        const primary = d.ResultImage || d.ResultVideo || images[0] || d.ResultUrl || '';
        return {
            type: isVideo ? 'text2video' : (taskId.toLowerCase().includes('image') ? 'image2image' : 'text2img'),
            taskId,
            status: completed ? 'completed' : 'processing',
            prompt: '',
            outputUrl: completed ? primary : '',
            images: completed && images.length ? images : undefined,
            provider: 'hunyuan',
            note: completed ? '混元任务完成。' : '混元任务处理中……',
        };
    }
}
exports.HunyuanProvider = HunyuanProvider;
//# sourceMappingURL=hunyuan.provider.js.map