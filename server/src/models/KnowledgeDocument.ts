import mongoose, { Schema, Document } from 'mongoose';

// 知识文档接口
export interface IKnowledgeDocument extends Document {
  title: string;
  content: string; // Markdown 内容
  htmlContent?: string; // 渲染后的 HTML
  summary?: string; // AI 生成的摘要
  tags: string[]; // 标签
  categories: string[]; // 分类
  author: string; // 作者 ID
  teamId?: string; // 归属团队（团队资源级隔离，可选）
  isPublic: boolean; // 是否公开
  // 商业化与权限字段（知识库 v2）
  categoryTree?: string[];     // 业务分类路径，如 ['法律咨询','合同范本']
  price?: number;              // 付费解锁价格（元），缺省 = 免费
  requiredPlan?: 'free' | 'pro' | 'max'; // 查看所需最低会员等级
  creditsCost?: number;        // 查看/下载消耗积分
  freePreviewPages?: number;   // 免费试看页数（文档类）
  unlockedBy?: string[];       // 已用积分/付费解锁的用户 ID（避免重复扣减）
  viewCount: number; // 浏览次数
  likeCount: number; // 点赞次数
  createdAt: Date;
  updatedAt: Date;
  // 向量嵌入（用于 RAG）
  embedding?: number[];
  // AI 生成的标签
  aiTags?: string[];
  // 相关文档 ID
  relatedDocs?: string[];
}

// 知识文档 Schema
const KnowledgeDocumentSchema = new Schema<IKnowledgeDocument>(
  {
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters']
    },
    content: {
      type: String,
      required: [true, 'Content is required'],
      get: function (content: string) {
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
  },
  {
    timestamps: true, // 自动添加 createdAt 和 updatedAt
    toJSON: { getters: true },
    toObject: { getters: true }
  }
);

// 索引
KnowledgeDocumentSchema.index({ title: 'text', content: 'text' }); // 全文搜索
KnowledgeDocumentSchema.index({ tags: 1 });
KnowledgeDocumentSchema.index({ categories: 1 });
KnowledgeDocumentSchema.index({ categoryTree: 1 });
KnowledgeDocumentSchema.index({ author: 1 });
KnowledgeDocumentSchema.index({ createdAt: -1 });

// 虚拟字段：阅读时间（分钟）
KnowledgeDocumentSchema.virtual('readingTime').get(function (this: IKnowledgeDocument) {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

/**
 * 轻量本地摘要：去除 Markdown 标记后取纯文本前段，截断到 summary 上限内。
 * 零外部依赖、无网络/超时风险；如需更高质量摘要可在配置 AI Key 后替换为 AI 生成。
 */
function buildLocalSummary(content: string, maxLength = 200): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ') // 代码块
    .replace(/`[^`]*`/g, ' ') // 行内代码
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // 图片
    .replace(/\[[^\]]*\]\([^)]*\)/g, ' ') // 链接
    .replace(/[#>*_~\\-]+/g, ' ') // Markdown 符号
    .replace(/\s+/g, ' ')
    .trim();
  if (!plain) return '';
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
KnowledgeDocumentSchema.statics.fullTextSearch = function (
  query: string,
  options: { tags?: string[]; categories?: string[] } = {}
) {
  const searchQuery: any = {
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
export const KnowledgeDocument = mongoose.model<IKnowledgeDocument>(
  'KnowledgeDocument',
  KnowledgeDocumentSchema
);
