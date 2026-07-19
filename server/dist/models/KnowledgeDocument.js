"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.KnowledgeDocument = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// 知识文档 Schema
const KnowledgeDocumentSchema = new mongoose_1.Schema({
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
        type: String,
        required: [true, 'Content is required'],
        get: function (content) {
            // 这里可以添加 Markdown 解析逻辑
            return content;
        }
    },
    htmlContent: {
        type: String,
        select: false // 默认不返回 HTML 内容，减少传输量
    },
    summary: {
        type: String,
        maxlength: [500, 'Summary cannot exceed 500 characters']
    },
    tags: [
        {
            type: String,
            trim: true,
            lowercase: true
        }
    ],
    categories: [
        {
            type: String,
            trim: true
        }
    ],
    author: {
        type: String, // 简化为 String，不引用 User
        required: true
    },
    teamId: {
        type: String, // 归属团队 ID（团队资源隔离）
        index: true,
    },
    isPublic: {
        type: Boolean,
        default: true
    },
    categoryTree: {
        type: [String],
        default: undefined
    },
    price: {
        type: Number,
        default: undefined
    },
    requiredPlan: {
        type: String,
        enum: ['free', 'pro', 'max'],
        default: 'free'
    },
    creditsCost: {
        type: Number,
        default: undefined
    },
    freePreviewPages: {
        type: Number,
        default: undefined
    },
    unlockedBy: {
        type: [String],
        default: undefined
    },
    viewCount: {
        type: Number,
        default: 0
    },
    likeCount: {
        type: Number,
        default: 0
    },
    embedding: {
        type: [Number],
        select: false // 向量数据量大，默认不返回
    },
    aiTags: [
        {
            type: String,
            trim: true
        }
    ],
    relatedDocs: [
        {
            type: String // 简化为 String
        }
    ]
}, {
    timestamps: true, // 自动添加 createdAt 和 updatedAt
    toJSON: { getters: true },
    toObject: { getters: true }
});
// 索引
KnowledgeDocumentSchema.index({ title: 'text', content: 'text' }); // 全文搜索
KnowledgeDocumentSchema.index({ tags: 1 });
KnowledgeDocumentSchema.index({ categories: 1 });
KnowledgeDocumentSchema.index({ categoryTree: 1 });
KnowledgeDocumentSchema.index({ author: 1 });
KnowledgeDocumentSchema.index({ createdAt: -1 });
// 虚拟字段：阅读时间（分钟）
KnowledgeDocumentSchema.virtual('readingTime').get(function () {
    const wordsPerMinute = 200;
    const wordCount = this.content.split(/\s+/).length;
    return Math.ceil(wordCount / wordsPerMinute);
});
/**
 * 轻量本地摘要：去除 Markdown 标记后取纯文本前段，截断到 summary 上限内。
 * 零外部依赖、无网络/超时风险；如需更高质量摘要可在配置 AI Key 后替换为 AI 生成。
 */
function buildLocalSummary(content, maxLength = 200) {
    const plain = content
        .replace(/```[\s\S]*?```/g, ' ') // 代码块
        .replace(/`[^`]*`/g, ' ') // 行内代码
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
        .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // 链接
        .replace(/[#>*_~\\-]+/g, ' ') // Markdown 符号
        .replace(/\s+/g, ' ')
        .trim();
    if (!plain)
        return '';
    return plain.length > maxLength ? plain.slice(0, maxLength).trimEnd() + '…' : plain;
}
// 中间件：保存前生成摘要（如果内容有修改且尚无摘要）
KnowledgeDocumentSchema.pre('save', async function (next) {
    if (this.isModified('content') && !this.summary) {
        this.summary = buildLocalSummary(this.content);
    }
    next();
});
// 静态方法：全文搜索
KnowledgeDocumentSchema.statics.fullTextSearch = function (query, options = {}) {
    const searchQuery = {
        $text: { $search: query }
    };
    if (options.tags && options.tags.length > 0) {
        searchQuery.tags = { $in: options.tags };
    }
    if (options.categories && options.categories.length > 0) {
        searchQuery.categories = { $in: options.categories };
    }
    return this.find(searchQuery, { score: { $meta: 'textScore' } }).sort({
        score: { $meta: 'textScore' }
    });
};
// 创建并导出 Model
exports.KnowledgeDocument = mongoose_1.default.model('KnowledgeDocument', KnowledgeDocumentSchema);
//# sourceMappingURL=KnowledgeDocument.js.map