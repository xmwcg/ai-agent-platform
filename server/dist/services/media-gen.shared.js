"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PLACEHOLDER_IMAGE = void 0;
exports.genTaskId = genTaskId;
exports.persistTask = persistTask;
exports.retrieveTask = retrieveTask;
exports.params_type_from_status = params_type_from_status;
/**
 * 媒体生成服务 - 共享层
 * 类型定义、常量、任务存储，以及与具体厂商无关的辅助函数。
 * Provider 实现见 ./media-providers/*，编排层见 ./media-gen.service.ts
 */
const crypto_1 = require("crypto");
const MediaTask_1 = require("../models/MediaTask");
const http_error_1 = require("../lib/http-error");
const PLACEHOLDER_IMAGE = 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MDAiIGhlaWdodD0iMzAwIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iIzJkMzU0OCIvPjx0ZXh0IHg9IjUwJSIgeT0iNTAlIiBmaWxsPSIjOWNhM2FmIiBmb250LXNpemU9IjI0IiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iLjNlbSI+QWkgUHJvZHVjdGlvbiBSZXN1bHQ8L3RleHQ+PC9zdmc+';
exports.PLACEHOLDER_IMAGE = PLACEHOLDER_IMAGE;
function genTaskId() {
    return `media_${Date.now()}_${(0, crypto_1.randomBytes)(3).toString('hex')}`;
}
/** 内存降级存储（仅开发/测试环境使用） */
const fallbackStore = new Map();
function isProduction() {
    return process.env.NODE_ENV === 'production';
}
function taskStoreUnavailable(operation, error) {
    const detail = error instanceof Error ? error.message : error ? String(error) : 'MongoDB is not connected';
    return new http_error_1.AppError(503, '媒体任务存储暂时不可用，请稍后重试', 'MEDIA_TASK_STORE_UNAVAILABLE', `Media task store ${operation} failed: ${detail}`);
}
/** 持久化存储任务状态；生产环境 MongoDB 不可用时直接失败。 */
async function persistTask(taskId, result) {
    try {
        if (MediaTask_1.MediaTask.db.readyState === 1) {
            await MediaTask_1.MediaTask.findOneAndUpdate({ taskId }, {
                taskId,
                type: result.type,
                status: result.status,
                prompt: result.prompt,
                outputUrl: result.outputUrl,
                thumbnailUrl: result.thumbnailUrl,
                duration: result.duration,
                provider: result.provider,
                note: result.note,
            }, { upsert: true, new: true });
            return;
        }
    }
    catch (error) {
        if (isProduction())
            throw taskStoreUnavailable('write', error);
    }
    if (isProduction())
        throw taskStoreUnavailable('write');
    fallbackStore.set(taskId, { ...result, createdAt: Date.now() });
}
/** 从持久化存储检索任务；生产环境 MongoDB 不可用时直接失败。 */
async function retrieveTask(taskId) {
    try {
        if (MediaTask_1.MediaTask.db.readyState === 1) {
            const doc = await MediaTask_1.MediaTask.findOne({ taskId }).lean();
            if (doc) {
                return {
                    type: doc.type,
                    taskId: doc.taskId,
                    status: doc.status,
                    prompt: doc.prompt,
                    outputUrl: doc.outputUrl,
                    thumbnailUrl: doc.thumbnailUrl,
                    duration: doc.duration,
                    provider: doc.provider,
                    note: doc.note,
                    createdAt: doc.createdAt ? new Date(doc.createdAt).getTime() : Date.now(),
                };
            }
            return null;
        }
    }
    catch (error) {
        if (isProduction())
            throw taskStoreUnavailable('read', error);
    }
    if (isProduction())
        throw taskStoreUnavailable('read');
    return fallbackStore.get(taskId) || null;
}
/** 从任务状态对象推断媒体类型（缺省文生视频） */
function params_type_from_status(d) {
    if (d && typeof d === 'object') {
        const o = d;
        if (o['type'] === 'image' || (typeof o['req_key'] === 'string' && o['req_key'].includes('image'))) {
            return 'image2image';
        }
    }
    return 'text2video';
}
//# sourceMappingURL=media-gen.shared.js.map