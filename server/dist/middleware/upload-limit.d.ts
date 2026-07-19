/**
 * 统一文件上传限制中间件（基础设施骨架 · 上传限制）
 *
 * 设计目标：把所有「接收用户文件」的端点（RAG 文档、媒体生成原图等）
 * 的文件大小 / 类型白名单 / 数量上限集中到一处，避免各路由内联重复、配置漂移。
 * 限制即成本护栏：超大文件会耗尽服务器内存/磁盘、拖慢解析算力、撑爆 OSS。
 *
 * 用法：
 *   const upload = createUploader({ dir: 'rag', allowedExts: ['.pdf', ...], maxCount: 10 });
 *   router.post('/upload', requireAuth, upload.array('files', 10), handler);
 */
import multer from 'multer';
export interface UploadLimitOptions {
    /** 存储子目录（相对 process.cwd()/uploads），默认 'misc' */
    dir?: string;
    /** 单文件最大字节，默认 20MB（与 .env MAX_FILE_SIZE 一致） */
    maxSize?: number;
    /** 允许的扩展名白名单（含点，如 '.pdf'）。缺省为通用文档+图片白名单 */
    allowedExts?: string[];
    /** 单次请求最多文件数（单文件传 1），默认 1 */
    maxCount?: number;
}
export declare function createUploader(opts?: UploadLimitOptions): multer.Multer;
//# sourceMappingURL=upload-limit.d.ts.map