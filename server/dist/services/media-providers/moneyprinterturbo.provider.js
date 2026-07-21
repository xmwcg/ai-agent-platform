"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MoneyPrinterTurboProvider = void 0;
/** MoneyPrinterTurbo（外部视频工厂）Provider */
const axios_1 = __importDefault(require("axios"));
const http_error_1 = require("../../lib/http-error");
const media_gen_shared_1 = require("../media-gen.shared");
/**
 * 对接 harry0703/MoneyPrinterTurbo（FastAPI 服务，默认 http://127.0.0.1:8080）。
 * 真实 API 契约（已对照 app/controllers/v1/video.py 与 app/models/const.py 核对，MPT v1.3.2）：
 *  - POST /api/v1/videos  → 请求体为 VideoParams；响应信封 {status,message,data:{task_id}}
 *  - GET  /api/v1/tasks/{task_id} → 响应信封 {status,message,data:{task_id,state,videos:[...],...}}
 *    state 为整数：1=完成, -1=失败, 其余(含 4=处理中)视为进行中
 *    videos 为成片 URI 数组；若 MPT 配置了 endpoint 则为绝对 URL，否则为 /tasks/... 相对路径
 * 注：MPT 默认关闭鉴权（verify_token 已注释），调用方只需能访问其地址；
 *     MPT 自身的 LLM / Pexels Key 仅存于 MPT worker 的 config.toml，不会暴露给本平台前端。
 */
// MPT 任务状态码（与 app/models/const.py 保持一致）
const MPT_STATE_COMPLETE = 1;
const MPT_STATE_FAILED = -1;
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
/** 判断 prompt 更像「完整口播脚本」而非「简短主题」，从而直接作为 video_script 透传 */
function looksLikeScript(text) {
    const trimmed = (text || '').trim();
    if (trimmed.length < 40)
        return false;
    const sentences = trimmed.split(/[。！？!?\n]/).filter((s) => s.trim().length > 0);
    return sentences.length >= 3;
}
/** style 字段若形如语音 ID（含 Neural / V1 / V2 等），视为配音音色并透传 */
function looksLikeVoiceId(style) {
    return /Neural|V1|V2|male|female/i.test(style);
}
class MoneyPrinterTurboProvider {
    constructor() {
        this.name = 'moneyprinterturbo';
        this.label = 'MoneyPrinterTurbo（视频工厂）';
        this.supportedTypes = ['text2video'];
    }
    get baseURL() {
        return process.env.MONEY_PRINTER_TURBO_URL || 'http://127.0.0.1:8080';
    }
    isConfigured() {
        // 仅当显式配置了地址时才视为「已配置」，避免干扰自动厂商选择与测试断言
        return !!process.env.MONEY_PRINTER_TURBO_URL;
    }
    async generate(params) {
        const taskId = (0, media_gen_shared_1.genTaskId)();
        try {
            // 构造合法的 VideoParams 请求体（仅使用 MPT 真实存在的字段，避免 422）
            const body = {
                video_subject: params.prompt,
                video_language: 'zh', // 中文文案（与已验证可用的配置一致）
                video_source: 'pexels', // 素材来源（需 MPT 侧配置 pexels key）
                video_aspect: '9:16', // 竖屏，适配抖音/视频号
                voice_name: 'zh-CN-XiaoxiaoNeural-Female', // 中文晓晓，默认中文配音
            };
            // 若 prompt 已是一段完整脚本，直接作为口播文案，避免 AI 再自由发挥导致内容跑偏
            if (looksLikeScript(params.prompt)) {
                body.video_script = params.prompt;
            }
            // style 字段若形如语音 ID，则覆盖默认音色
            if (params.style && looksLikeVoiceId(params.style)) {
                body.voice_name = params.style;
            }
            // MoneyPrinterTurbo 真实端点：POST /api/v1/videos
            const resp = await axios_1.default.post(`${this.baseURL}/api/v1/videos`, body, { timeout: 15000 });
            const jobId = String(resp.data?.data?.task_id || taskId);
            const result = {
                type: 'text2video',
                taskId: jobId,
                status: 'processing',
                prompt: params.prompt,
                outputUrl: '',
                provider: 'moneyprinterturbo',
                note: '已提交 MoneyPrinterTurbo（整片生成：文案→素材→配音→字幕→合成）。轮询 queryTask 获取成片。',
            };
            await (0, media_gen_shared_1.persistTask)(jobId, result);
            return result;
        }
        catch (e) {
            if (e instanceof http_error_1.AppError)
                throw e;
            const em = e instanceof Error ? e.message : String(e);
            if (isProduction()) {
                throw new http_error_1.AppError(503, '视频生成服务暂时不可用，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE', `MoneyPrinterTurbo submit failed (${this.baseURL}): ${em}`);
            }
            // 仅开发/测试环境保留占位任务，便于本地联调。
            const result = {
                type: 'text2video',
                taskId,
                status: 'processing',
                prompt: params.prompt,
                outputUrl: '',
                provider: 'moneyprinterturbo',
                note: `MoneyPrinterTurbo 未连接（${this.baseURL}）：${em}。请确认其 FastAPI 服务已启动。`,
            };
            await (0, media_gen_shared_1.persistTask)(taskId, result);
            return result;
        }
    }
    async queryTask(taskId) {
        try {
            // MoneyPrinterTurbo 真实端点：GET /api/v1/tasks/{task_id}
            const resp = await axios_1.default.get(`${this.baseURL}/api/v1/tasks/${encodeURIComponent(taskId)}`, { timeout: 10000 });
            const envelope = resp.data;
            const d = envelope?.data && typeof envelope.data === 'object' ? envelope.data : (envelope || {});
            const state = Number(d.state);
            const status = typeof d.status === 'string' ? d.status.trim().toLowerCase() : '';
            const failed = state === MPT_STATE_FAILED || ['failed', 'error', 'cancelled', 'canceled'].includes(status);
            const completed = state === MPT_STATE_COMPLETE || ['completed', 'succeeded', 'success'].includes(status);
            const knownState = Number.isFinite(state)
                || completed
                || failed
                || ['processing', 'pending', 'queued', 'running'].includes(status);
            if (!knownState) {
                throw new http_error_1.AppError(502, '视频生成服务返回了无法识别的任务状态', 'MEDIA_PROVIDER_INVALID_RESPONSE');
            }
            if (failed) {
                throw new http_error_1.AppError(502, '视频生成任务执行失败', 'MEDIA_TASK_FAILED');
            }
            // videos 为成片 URI 数组；相对路径需拼接 baseURL 才能访问
            const videos = Array.isArray(d.videos) ? d.videos : [];
            let outputUrl = completed && videos.length > 0 ? String(videos[0]) : '';
            if (outputUrl && !/^https?:\/\//i.test(outputUrl)) {
                outputUrl = `${this.baseURL}${outputUrl.startsWith('/') ? '' : '/'}${outputUrl}`;
            }
            if (completed && !outputUrl) {
                throw new http_error_1.AppError(502, '视频生成服务返回了无效结果', 'MEDIA_PROVIDER_INVALID_RESPONSE');
            }
            return {
                type: 'text2video',
                taskId,
                status: completed ? 'completed' : 'processing',
                prompt: '',
                outputUrl,
                provider: 'moneyprinterturbo',
                note: completed ? 'MoneyPrinterTurbo 成片已生成。' : 'MoneyPrinterTurbo 制作中……',
            };
        }
        catch (e) {
            if (e instanceof http_error_1.AppError)
                throw e;
            const em = e instanceof Error ? e.message : String(e);
            if (isProduction()) {
                throw new http_error_1.AppError(503, '视频生成状态暂时无法查询，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE', `MoneyPrinterTurbo query failed (${this.baseURL}, task=${taskId}): ${em}`);
            }
            return {
                type: 'text2video',
                taskId,
                status: 'processing',
                prompt: '',
                outputUrl: '',
                provider: 'moneyprinterturbo',
                note: 'MoneyPrinterTurbo 状态查询失败，请检查服务。',
            };
        }
    }
}
exports.MoneyPrinterTurboProvider = MoneyPrinterTurboProvider;
//# sourceMappingURL=moneyprinterturbo.provider.js.map