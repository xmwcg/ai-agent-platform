import mongoose, { Schema, Document } from 'mongoose';

/** 智能客服系统 - 客服机器人配置 */
export interface ICustomerService extends Document {
  name: string;                       // 客服名称，如「官网售前助手」
  description?: string;
  knowledgeBaseIds: string[];         // 绑定的知识库文档 ID（RAG 支撑）
  systemPrompt: string;               // 客服人设提示词
  modelConfigId?: string;             // 使用的模型配置 ID
  provider: string;                   // 使用的 provider
  csModel: string;                    // 使用的模型
  welcomeMessage: string;             // 欢迎语
  fallbackMessage: string;            // 无法回答时的兜底语
  enabled: boolean;
  handoffEnabled: boolean;            // 是否支持转人工
  handoffPrompt: string;
  escalationTriggers: string[];        // 行业合规触发词，命中即转人工              // 转人工话术
  embedCode: string;                  // 嵌入网站的脚本标识
  ownerId: string;                    // 拥有者用户 ID
  teamId?: string;                    // 归属团队（团队资源级隔离，可选）
  conversationCount: number;          // 累计会话数
  createdAt: Date;
  updatedAt: Date;
}

const CustomerServiceSchema = new Schema<ICustomerService>(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String },
    knowledgeBaseIds: { type: [String], default: [] },
    systemPrompt: {
      type: String,
      default: '你是一个专业的智能客服助手，请根据提供的知识库内容准确回答用户问题。如果知识库中没有相关信息，请礼貌告知用户并建议联系人工客服。',
    },
    modelConfigId: { type: String },
    provider: { type: String, default: 'openai' },
    csModel: { type: String, default: 'gpt-4o' },
    welcomeMessage: { type: String, default: '您好！我是智能客服助手，有什么可以帮您？' },
    fallbackMessage: {
      type: String,
      default: '抱歉，我暂时无法回答这个问题。您可以拨打客服热线，或留下联系方式，我们会尽快与您联系。',
    },
    enabled: { type: Boolean, default: true },
    handoffEnabled: { type: Boolean, default: true }, // 是否支持转人工
    handoffPrompt: {
      type: String,
      default: '正在为您转接人工客服，请留下联系方式，我们会尽快与您联系。',
    },
    escalationTriggers: { type: [String], default: [] }, // 行业合规触发词，命中即转人工（如诊所「胸痛」、律所「起诉」）
    embedCode: { type: String, unique: true },
    ownerId: { type: String, required: true, index: true },
    teamId: { type: String, index: true }, // 归属团队（资源级隔离）
    conversationCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

/** 客服会话记录 */
export interface ICustomerServiceSession extends Document {
  serviceId: string;
  visitorId: string;                  // 访客标识（匿名或登录用户）
  messages: { role: 'user' | 'assistant'; content: string; timestamp: number }[];
  escalated?: boolean;                // 是否已转人工
  satisfaction?: number;              // 满意度评分 1-5
  comment?: string;                   // 用户备注
  createdAt: Date;
  updatedAt: Date;
}

const CustomerServiceSessionSchema = new Schema<ICustomerServiceSession>(
  {
    serviceId: { type: String, required: true, index: true },
    visitorId: { type: String, required: true, index: true },
    messages: [
      {
        role: { type: String, enum: ['user', 'assistant'] },
        content: { type: String },
        timestamp: { type: Number },
      },
    ],
    escalated: { type: Boolean, default: false }, // 是否已转人工
    satisfaction: { type: Number, min: 1, max: 5 }, // 会话满意度评分
    comment: { type: String }, // 用户备注
  },
  { timestamps: true }
);

export const CustomerService = mongoose.model<ICustomerService>('CustomerService', CustomerServiceSchema);
export const CustomerServiceSession = mongoose.model<ICustomerServiceSession>(
  'CustomerServiceSession',
  CustomerServiceSessionSchema
);

/**
 * 客服审计日志（合规溯源）
 * 金融 / 医疗 / 政务类客服必须能给出「谁、在什么时间、问了什么、答了什么、依据哪些文档、
 * 是否转人工、满意度如何」的完整留痕。这是本项目相对 FastGPT 等竞品的差异化合规能力。
 */
export interface ICustomerServiceAuditLog extends Document {
  botId: string; // 客服机器人 ID
  botName?: string;
  sessionId: string;
  userId?: string; // 登录用户 ID（匿名可为空）
  visitorId: string; // 访客标识
  question: string;
  answer: string;
  sources: { docId?: string; title?: string; confidence: number; snippet: string }[];
  similarityAvg: number; // 来源平均置信度
  escalated: boolean; // 是否转人工
  satisfaction?: number; // 满意度 1-5（反馈后回填）
  createdAt: Date;
}

const CustomerServiceAuditLogSchema = new Schema<ICustomerServiceAuditLog>(
  {
    botId: { type: String, required: true, index: true },
    botName: { type: String },
    sessionId: { type: String, required: true, index: true },
    userId: { type: String, index: true },
    visitorId: { type: String },
    question: { type: String },
    answer: { type: String },
    sources: [
      {
        docId: { type: String },
        title: { type: String },
        confidence: { type: Number },
        snippet: { type: String },
      },
    ],
    similarityAvg: { type: Number, default: 0 },
    escalated: { type: Boolean, default: false },
    satisfaction: { type: Number, min: 1, max: 5 },
  },
  { timestamps: true }
);

export const CustomerServiceAuditLog = mongoose.model<ICustomerServiceAuditLog>(
  'CustomerServiceAuditLog',
  CustomerServiceAuditLogSchema
);

/**
 * 构造一条审计日志（纯函数，便于单测；调用方负责落库）。
 * 输入来自一次客服问答的核心字段，输出为可写入审计表的记录。
 */
/** 审计来源条目（与路由层 SourceRef 结构兼容，避免跨文件循环依赖） */
export interface AuditSourceRef {
  docId?: string;
  title?: string;
  confidence: number;
  snippet: string;
}

export function buildAuditEntry(input: {
  botId: string;
  botName?: string;
  sessionId: string;
  userId?: string;
  visitorId: string;
  question: string;
  answer: string;
  sources?: AuditSourceRef[];
  escalated: boolean;
}): Partial<ICustomerServiceAuditLog> {
  const src = input.sources || [];
  const similarityAvg = src.length
    ? Number((src.reduce((s, r) => s + (r.confidence || 0), 0) / src.length).toFixed(3))
    : 0;
  return {
    botId: input.botId,
    botName: input.botName,
    sessionId: input.sessionId,
    userId: input.userId,
    visitorId: input.visitorId,
    question: input.question,
    answer: input.answer,
    sources: src,
    similarityAvg,
    escalated: input.escalated,
  };
}
