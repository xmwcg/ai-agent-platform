"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CONFIG = void 0;
const path_1 = __importDefault(require("path"));
// ── 默认配置 ──────────────────────────────────────────
exports.DEFAULT_CONFIG = {
    chunkSize: 1000, // 每块最大字符数
    chunkOverlap: 200, // 块间重叠字符数
    maxChunks: 100, // 单文档最大分块数
    uploadDir: path_1.default.join(process.cwd(), 'uploads'), // 上传目录
};
//# sourceMappingURL=rag-pipeline.types.js.map