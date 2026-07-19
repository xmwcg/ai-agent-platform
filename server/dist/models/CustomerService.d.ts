import mongoose, { Document } from 'mongoose';
/** 智能客服系统 - 客服机器人配置 */
export interface ICustomerService extends Document {
    name: string;
    description?: string;
    knowledgeBaseIds: string[];
    systemPrompt: string;
    modelConfigId?: string;
    provider: string;
    csModel: string;
    welcomeMessage: string;
    fallbackMessage: string;
    enabled: boolean;
    handoffEnabled: boolean;
    handoffPrompt: string;
    escalationTriggers: string[];
    embedCode: string;
    ownerId: string;
    teamId?: string;
    conversationCount: number;
    createdAt: Date;
    updatedAt: Date;
}
/** 客服会话记录 */
export interface ICustomerServiceSession extends Document {
    serviceId: string;
    visitorId: string;
    messages: {
        role: 'user' | 'assistant';
        content: string;
        timestamp: number;
    }[];
    escalated?: boolean;
    satisfaction?: number;
    comment?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const CustomerService: mongoose.Model<ICustomerService, {}, {}, {}, mongoose.Document<unknown, {}, ICustomerService, {}, {}> & ICustomerService & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const CustomerServiceSession: mongoose.Model<ICustomerServiceSession, {}, {}, {}, mongoose.Document<unknown, {}, ICustomerServiceSession, {}, {}> & ICustomerServiceSession & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
/**
 * 客服审计日志（合规溯源）
 * 金融 / 医疗 / 政务类客服必须能给出「谁、在什么时间、问了什么、答了什么、依据哪些文档、
 * 是否转人工、满意度如何」的完整留痕。这是本项目相对 FastGPT 等竞品的差异化合规能力。
 */
export interface ICustomerServiceAuditLog extends Document {
    botId: string;
    botName?: string;
    sessionId: string;
    userId?: string;
    visitorId: string;
    question: string;
    answer: string;
    sources: {
        docId?: string;
        title?: string;
        confidence: number;
        snippet: string;
    }[];
    similarityAvg: number;
    escalated: boolean;
    satisfaction?: number;
    createdAt: Date;
}
export declare const CustomerServiceAuditLog: mongoose.Model<ICustomerServiceAuditLog, {}, {}, {}, mongoose.Document<unknown, {}, ICustomerServiceAuditLog, {}, {}> & ICustomerServiceAuditLog & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
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
export declare function buildAuditEntry(input: {
    botId: string;
    botName?: string;
    sessionId: string;
    userId?: string;
    visitorId: string;
    question: string;
    answer: string;
    sources?: AuditSourceRef[];
    escalated: boolean;
}): Partial<ICustomerServiceAuditLog>;
//# sourceMappingURL=CustomerService.d.ts.map