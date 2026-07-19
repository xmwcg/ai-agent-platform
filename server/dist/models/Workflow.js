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
exports.NODE_TYPES = exports.WorkflowRun = exports.Workflow = void 0;
const mongoose_1 = __importStar(require("mongoose"));
// ── Schemas ─────────────────────────────────────────
const NodeDataSchema = new mongoose_1.Schema({
    type: { type: String, required: true },
    label: { type: String, required: true },
    config: { type: mongoose_1.Schema.Types.Mixed, default: {} },
}, { _id: false });
const WorkflowNodeSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    type: { type: String, required: true },
    position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true },
    },
    data: { type: NodeDataSchema, required: true },
}, { _id: false });
const WorkflowEdgeSchema = new mongoose_1.Schema({
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
    label: { type: String },
}, { _id: false });
const WorkflowSchema = new mongoose_1.Schema({
    name: { type: String, required: true, trim: true, maxlength: 100 },
    description: { type: String, maxlength: 500 },
    nodes: { type: [WorkflowNodeSchema], default: [] },
    edges: { type: [WorkflowEdgeSchema], default: [] },
    owner: { type: String, required: true, index: true },
    teamId: { type: String, index: true },
    isPublic: { type: Boolean, default: false },
    isPublished: { type: Boolean, default: false },
    apiKey: { type: String },
    apiEndpoint: { type: String },
    runCount: { type: Number, default: 0 },
    tags: [{ type: String, trim: true }],
    category: { type: String, default: '通用' },
    thumbnail: { type: String },
    version: { type: Number, default: 1 },
}, {
    timestamps: true,
});
// 索引
WorkflowSchema.index({ owner: 1, updatedAt: -1 });
WorkflowSchema.index({ isPublic: 1, runCount: -1 });
WorkflowSchema.index({ tags: 1 });
WorkflowSchema.index({ category: 1 });
// ── 执行日志 Schema ─────────────────────────────────
const NodeExecutionSchema = new mongoose_1.Schema({
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    nodeLabel: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'success', 'error', 'skipped'], default: 'pending' },
    input: { type: mongoose_1.Schema.Types.Mixed },
    output: { type: mongoose_1.Schema.Types.Mixed },
    error: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },
}, { _id: false });
const WorkflowRunSchema = new mongoose_1.Schema({
    workflowId: { type: String, required: true, index: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    input: { type: mongoose_1.Schema.Types.Mixed, default: {} },
    output: { type: mongoose_1.Schema.Types.Mixed },
    nodeExecutions: { type: [NodeExecutionSchema], default: [] },
    totalDuration: { type: Number },
    error: { type: String },
}, {
    timestamps: true,
});
WorkflowRunSchema.index({ workflowId: 1, createdAt: -1 });
// ── 导出 ────────────────────────────────────────────
exports.Workflow = mongoose_1.default.model('Workflow', WorkflowSchema);
exports.WorkflowRun = mongoose_1.default.model('WorkflowRun', WorkflowRunSchema);
// ── 可用的节点类型 ──────────────────────────────────
exports.NODE_TYPES = [
    // 输入输出
    { type: 'input', label: '输入', category: '基础', icon: 'ImportOutlined', color: '#52c41a', defaultConfig: { inputType: 'text', placeholder: '用户输入内容...' } },
    { type: 'output', label: '输出', category: '基础', icon: 'ExportOutlined', color: '#fa8c16', defaultConfig: { outputFormat: 'text' } },
    // AI 能力
    { type: 'ai_chat', label: 'AI 对话', category: 'AI', icon: 'RobotOutlined', color: '#1890ff', defaultConfig: { provider: 'deepseek', model: 'deepseek-v4-flash', temperature: 0.7, systemPrompt: '你是一个有用的助手。', maxTokens: 2000 } },
    { type: 'rag_search', label: 'RAG 检索', category: 'AI', icon: 'SearchOutlined', color: '#722ed1', defaultConfig: { maxDocuments: 5, minSimilarity: 0.7 } },
    { type: 'translate', label: '翻译', category: 'AI', icon: 'TranslationOutlined', color: '#13c2c2', defaultConfig: { targetLanguage: '英文', sourceLanguage: '自动检测' } },
    { type: 'web_search', label: '网络搜索', category: 'AI', icon: 'GlobalOutlined', color: '#eb2f96', defaultConfig: { maxResults: 5 } },
    // 处理
    { type: 'condition', label: '条件判断', category: '逻辑', icon: 'BranchesOutlined', color: '#f5222d', defaultConfig: { condition: '', trueBranch: '满足条件', falseBranch: '不满足条件' } },
    { type: 'code', label: '代码执行', category: '处理', icon: 'CodeOutlined', color: '#2f54eb', defaultConfig: { language: 'javascript', code: '// 处理输入数据\nreturn input;' } },
    // 技能
    { type: 'skill', label: '技能调用', category: '技能', icon: 'ThunderboltOutlined', color: '#faad14', defaultConfig: { skillName: '', params: {} } },
    // 媒体
    { type: 'media_gen', label: '媒体生成', category: '媒体', icon: 'PictureOutlined', color: '#eb2f96', defaultConfig: { mediaType: 'text_to_image', size: '1024x1024' } },
];
//# sourceMappingURL=Workflow.js.map