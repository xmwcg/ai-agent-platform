"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agnesProvider = exports.AgnesProvider = void 0;
/**
 * Agnes（apihub.agnes-ai.com）统一媒体 Provider
 * 一个 Provider 覆盖三类能力，全部走用户「模型配置」里的 Agnes 第三方自定义模型：
 *   - 文生图 / 图生图：POST {baseURL}/images/generations（同步返回图片 URL）
 *   - 文生视频：POST {baseURL}/videos（异步，返回 task_id）→ GET {baseURL}/videos/{task_id} 轮询成片
 * 凭据（baseURL + apiKey）与模型清单统一从 ModelConfig（provider=custom、baseURL 含 agnès）读取，
 * 与 AI 网关共用同一份配置，避免重复维护。apiKey 以密文落库，此处运行时解密。
 */
const axios_1 = __importDefault(require("axios"));
const promises_1 = __importDefault(require("fs/promises"));
const path_1 = __importDefault(require("path"));
const http_error_1 = require("../../lib/http-error");
const crypto_1 = require("../../lib/crypto");
const ModelConfig_1 = require("../../models/ModelConfig");
const object_storage_1 = require("../../lib/object-storage");
const media_gen_shared_1 = require("../media-gen.shared");
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
class AgnesProvider {
    constructor() {
        this.name = 'agnes';
        this.label = 'Agnes（文生图 / 文生视频）';
        this.supportedTypes = ['text2img', 'image2image', 'text2video'];
        this.cached = null;
        /** 已落盘任务缓存，避免同一任务跨轮询重复下载（进程内有效，重启后由磁盘存在性兜底）。 */
        this.localizedTasks = new Set();
    }
    /** 从 ModelConfig 加载 Agnes 配置（baseURL 含 agnès 的自定义配置），结果缓存。 */
    async reload() {
        try {
            const doc = await ModelConfig_1.ModelConfig.findOne({
                enabled: true,
                baseURL: /agnes/i,
            }).lean();
            if (!doc) {
                this.cached = null;
                return;
            }
            const models = Array.isArray(doc.models)
                ? doc.models
                : [String(doc.defaultModel || '')];
            this.cached = {
                baseURL: String(doc.baseURL || '').replace(/\/$/, ''),
                apiKey: (0, crypto_1.decryptSecret)(doc.apiKey || ''),
                models: models.filter(Boolean),
            };
        }
        catch {
            // 加载失败不致命：下次 generate / reload 再试
            this.cached = null;
        }
    }
    async ensureLoaded() {
        if (this.cached)
            return this.cached;
        await this.reload();
        if (!this.cached) {
            throw new http_error_1.AppError(503, 'Agnes 模型未配置：请在「模型配置」中添加 Agnes（apihub.agnes-ai.com）自定义模型', 'MEDIA_PROVIDER_UNAVAILABLE');
        }
        return this.cached;
    }
    isConfigured() {
        return !!this.cached;
    }
    pickModel(cfg, kind) {
        if (kind === 'video') {
            return (cfg.models.find((m) => /video/i.test(m)) || 'agnes-video-v2.0');
        }
        // 文生图：优先 2.1（更高画质），回退 2.0
        return (cfg.models.find((m) => /image-2\.1/i.test(m)) ||
            cfg.models.find((m) => /image/i.test(m)) ||
            'agnes-image-2.0-flash');
    }
    headers(cfg) {
        return {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${cfg.apiKey}`,
        };
    }
    /** 清洗文本：去换行/回车、合并空白、按上限截断，避免超长脚本触发上游 400。 */
    cleanText(s, max = 800) {
        return String(s || '')
            .replace(/\n+/g, ' ')
            .replace(/\r+/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, max);
    }
    /** 把 axios 错误转成可读详情（带上游响应体），便于诊断。 */
    errDetail(e) {
        const em = e instanceof Error ? e.message : String(e);
        const resp = e?.response?.data;
        const detail = resp ? ` | upstream=${JSON.stringify(resp).slice(0, 300)}` : '';
        return `${em}${detail}`;
    }
    /**
     * 把上游视频落盘到本地 /generated 目录，返回稳定可公开访问的 URL。
     * - 落盘用对象存储抽象（默认 LocalStorage 写 uploads/generated，由 /generated 静态路由对外提供；
     *   COS 已配置时自动落到云存储，返回云 URL）。
     * - 落盘失败不致命：回退返回上游地址，保证成片始终可访问。
     */
    async localizeVideo(taskId, upstreamUrl) {
        const key = `agnes-video/${taskId}.mp4`;
        const localUrl = `/generated/${key}`;
        // 进程内已处理 或 本地磁盘已存在 → 直接返回，避免重复下载（重启后仍命中）
        if (this.localizedTasks.has(taskId))
            return localUrl;
        try {
            await promises_1.default.access(path_1.default.join(object_storage_1.LOCAL_STORAGE_DIR, key));
            this.localizedTasks.add(taskId);
            return localUrl;
        }
        catch {
            /* 尚未落盘，继续下载 */
        }
        try {
            const resp = await axios_1.default.get(upstreamUrl, {
                responseType: 'arraybuffer',
                timeout: 60000,
                headers: { 'User-Agent': 'AIBAK-Platform' },
            });
            const buf = Buffer.from(resp.data);
            if (!buf.length)
                return upstreamUrl;
            const url = await (0, object_storage_1.getObjectStorage)().put(key, buf, 'video/mp4');
            this.localizedTasks.add(taskId);
            return url;
        }
        catch (e) {
            console.warn(`[agnes] 视频落盘失败 task=${taskId}:`, e?.message || e);
            return upstreamUrl;
        }
    }
    async generate(params) {
        const cfg = await this.ensureLoaded();
        const isVideo = params.type === 'text2video' || params.type === 'image2video';
        if (!isVideo) {
            // —— 文生图 / 图生图：同步返回 ——
            const model = this.pickModel(cfg, 'image');
            const n = Math.min(Math.max(Number(params.n) || 1, 1), 4);
            const body = { model, prompt: params.prompt, n };
            if (params.size)
                body.size = params.size;
            if (params.imageBase64)
                body.image_base64 = params.imageBase64;
            if (params.imageUrl)
                body.image_url = params.imageUrl;
            try {
                const resp = await axios_1.default.post(`${cfg.baseURL}/images/generations`, body, { headers: this.headers(cfg), timeout: 90000 });
                const data = (resp.data && resp.data.data) || [];
                const urls = data.map((x) => x?.url).filter(Boolean);
                if (!urls.length) {
                    throw new http_error_1.AppError(502, 'Agnes 文生图未返回有效图片', 'MEDIA_PROVIDER_INVALID_RESPONSE');
                }
                const taskId = (0, media_gen_shared_1.genTaskId)();
                const result = {
                    type: params.type,
                    taskId,
                    status: 'completed',
                    prompt: params.prompt,
                    outputUrl: urls[0],
                    images: urls,
                    provider: 'agnes',
                    note: 'Agnes 文生图完成。',
                };
                await (0, media_gen_shared_1.persistTask)(taskId, result);
                // 统一异步轮询约定：先返回 processing，前端轮询即拿到 completed
                return { ...result, status: 'processing' };
            }
            catch (e) {
                if (e instanceof http_error_1.AppError)
                    throw e;
                const em = e instanceof Error ? e.message : String(e);
                if (isProduction()) {
                    throw new http_error_1.AppError(503, 'Agnes 文生图暂时不可用，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE', `Agnes image failed: ${em}`);
                }
                throw e;
            }
        }
        // —— 文生视频：异步提交 ——
        const model = this.pickModel(cfg, 'video');
        const body = { model, prompt: this.cleanText(params.prompt) };
        if (params.duration)
            body.duration = params.duration;
        if (params.size)
            body.size = params.size;
        try {
            const resp = await axios_1.default.post(`${cfg.baseURL}/videos`, body, { headers: this.headers(cfg), timeout: 60000 });
            const d = (resp.data || {});
            const taskId = String(d.task_id || d.video_id || d.id || (0, media_gen_shared_1.genTaskId)());
            const result = {
                type: 'text2video',
                taskId,
                status: 'processing',
                prompt: params.prompt,
                outputUrl: '',
                provider: 'agnes',
                note: '已提交 Agnes 视频生成，轮询获取成片。',
            };
            await (0, media_gen_shared_1.persistTask)(taskId, result);
            return result;
        }
        catch (e) {
            if (e instanceof http_error_1.AppError)
                throw e;
            if (isProduction()) {
                throw new http_error_1.AppError(503, 'Agnes 视频生成暂时不可用，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE', `Agnes video submit failed: ${this.errDetail(e)}`);
            }
            throw e;
        }
    }
    async queryTask(taskId, _creds) {
        // 远端异步任务（Agnes 视频）：task_xxx 由 Agnes 返回
        if (/^task_/i.test(taskId)) {
            const cfg = await this.ensureLoaded();
            try {
                const resp = await axios_1.default.get(`${cfg.baseURL}/videos/${taskId}`, { headers: this.headers(cfg), timeout: 30000 });
                const d = (resp.data || {});
                const status = String(d.status || '').toLowerCase();
                if (['failed', 'error', 'cancelled', 'canceled'].includes(status)) {
                    throw new http_error_1.AppError(502, 'Agnes 视频生成任务执行失败', 'MEDIA_TASK_FAILED');
                }
                const completed = status === 'completed' || status === 'success' || status === 'succeeded';
                const meta = (d.metadata || {});
                const dataObj = (d.data || {});
                const outputUrl = String(d.video_url ||
                    d.url ||
                    d.output_url ||
                    d.download_url ||
                    d.file_url ||
                    d.result_url ||
                    // Agnes 视频完成后 URL 位于 metadata.url（嵌套）
                    meta.url ||
                    meta.video_url ||
                    meta.output_url ||
                    dataObj.url ||
                    dataObj.video_url ||
                    '');
                if (completed && !outputUrl) {
                    throw new http_error_1.AppError(502, 'Agnes 视频生成返回了无效结果', 'MEDIA_PROVIDER_INVALID_RESPONSE');
                }
                // 成片完成后落盘到本地 /generated（或云存储），返回稳定可访问 URL；失败回退上游地址。
                const finalUrl = completed && /^https?:\/\//i.test(outputUrl)
                    ? await this.localizeVideo(taskId, outputUrl)
                    : outputUrl;
                return {
                    type: 'text2video',
                    taskId,
                    status: completed ? 'completed' : 'processing',
                    prompt: '',
                    outputUrl: finalUrl,
                    provider: 'agnes',
                    note: completed ? 'Agnes 成片已生成。' : 'Agnes 视频生成中……',
                };
            }
            catch (e) {
                if (e instanceof http_error_1.AppError)
                    throw e;
                const em = e instanceof Error ? e.message : String(e);
                if (isProduction()) {
                    throw new http_error_1.AppError(503, 'Agnes 视频状态暂时无法查询，请稍后重试', 'MEDIA_PROVIDER_UNAVAILABLE', `Agnes video query failed (task=${taskId}): ${em}`);
                }
                return {
                    type: 'text2video',
                    taskId,
                    status: 'processing',
                    prompt: '',
                    outputUrl: '',
                    provider: 'agnes',
                    note: 'Agnes 视频状态查询失败，请检查服务。',
                };
            }
        }
        // 本地图片任务：直接返回已持久化的完成结果
        const stored = await (0, media_gen_shared_1.retrieveTask)(taskId);
        if (!stored) {
            throw new http_error_1.AppError(404, '媒体任务不存在或已过期', 'MEDIA_TASK_NOT_FOUND');
        }
        return stored;
    }
}
exports.AgnesProvider = AgnesProvider;
exports.agnesProvider = new AgnesProvider();
//# sourceMappingURL=agnes.provider.js.map