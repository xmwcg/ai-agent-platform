"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUploader = createUploader;
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
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
/** 通用文档 + 图片白名单（覆盖 RAG 与媒体生成上传场景） */
const DEFAULT_ALLOWED_EXTS = [
    '.pdf', '.docx', '.doc', '.md', '.txt', '.html', '.htm',
    '.png', '.jpg', '.jpeg', '.webp', '.gif',
];
function createUploader(opts = {}) {
    const dir = path_1.default.join(process.cwd(), 'uploads', opts.dir || 'misc');
    fs_1.default.mkdirSync(dir, { recursive: true });
    const allowed = opts.allowedExts ?? DEFAULT_ALLOWED_EXTS;
    const maxSize = opts.maxSize ?? (Number(process.env.MAX_FILE_SIZE) || 20 * 1024 * 1024);
    const maxCount = opts.maxCount ?? 1;
    const storage = multer_1.default.diskStorage({
        destination: (_req, _file, cb) => cb(null, dir),
        filename: (_req, file, cb) => {
            const safeName = file.originalname.replace(/[^a-zA-Z0-9一-鿿\-_.]/g, '_');
            const suffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
            cb(null, `${suffix}-${safeName}`);
        },
    });
    const fileFilter = (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        if (allowed.includes(ext))
            cb(null, true);
        else
            cb(new Error(`不支持的文件格式: ${ext}。允许: ${allowed.join(', ')}`));
    };
    return (0, multer_1.default)({
        storage,
        fileFilter,
        limits: { fileSize: maxSize, files: maxCount },
    });
}
//# sourceMappingURL=upload-limit.js.map