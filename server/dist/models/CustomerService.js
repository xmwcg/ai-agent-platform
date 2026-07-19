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
exports.CustomerServiceAuditLog = exports.CustomerServiceSession = exports.CustomerService = void 0;
exports.buildAuditEntry = buildAuditEntry;
const mongoose_1 = __importStar(require("mongoose"));
const CustomerServiceSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
const CustomerServiceSessionSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.CustomerService = mongoose_1.default.model('CustomerService', CustomerServiceSchema);
exports.CustomerServiceSession = mongoose_1.default.model('CustomerServiceSession', CustomerServiceSessionSchema);
const CustomerServiceAuditLogSchema = new mongoose_1.Schema({
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
}, { timestamps: true });
exports.CustomerServiceAuditLog = mongoose_1.default.model('CustomerServiceAuditLog', CustomerServiceAuditLogSchema);
function buildAuditEntry(input) {
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
//# sourceMappingURL=CustomerService.js.map