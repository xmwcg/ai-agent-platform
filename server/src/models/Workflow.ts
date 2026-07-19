import mongoose, { Schema, Document } from 'mongoose';

// ── 工作流节点定义 ───────────────────────────────────

export interface WorkflowNodeData {
  // 节点类型
  type: 'input' | 'output' | 'ai_chat' | 'rag_search' | 'skill' | 'condition' | 'code' | 'translate' | 'media_gen' | 'web_search';
  // 节点标签
  label: string;
  // 节点配置
  config: Record<string, any>;
}

export interface IWorkflowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: WorkflowNodeData;
}

export interface IWorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// ── 工作流文档接口 ──────────────────────────────────

export interface IWorkflow extends Document {
  name: string;
  description?: string;
  nodes: IWorkflowNode[];
  edges: IWorkflowEdge[];
  owner: string;
  teamId?: string;
  isPublic: boolean;
  isPublished: boolean;
  apiKey?: string;           // 发布后的 API 访问 Key
  apiEndpoint?: string;      // 发布后的 API 端点路径
  runCount: number;          // 执行次数
  tags: string[];
  category: string;          // 分类：通用/教育/电商/法律/医疗...
  thumbnail?: string;        // 预览图
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ── 执行日志接口 ────────────────────────────────────

export interface INodeExecution {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  input: any;
  output?: any;
  error?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

export interface IWorkflowRun extends Document {
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  input: any;
  output?: any;
  nodeExecutions: INodeExecution[];
  totalDuration?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

// ── Schemas ─────────────────────────────────────────

const NodeDataSchema = new Schema<WorkflowNodeData>(
  {
    type: { type: String, required: true },
    label: { type: String, required: true },
    config: { type: Schema.Types.Mixed, default: {} },
  },
  { _id: false }
);

const WorkflowNodeSchema = new Schema<IWorkflowNode>(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
    },
    data: { type: NodeDataSchema, required: true },
  },
  { _id: false }
);

const WorkflowEdgeSchema = new Schema<IWorkflowEdge>(
  {
    id: { type: String, required: true },
    source: { type: String, required: true },
    target: { type: String, required: true },
    sourceHandle: { type: String },
    targetHandle: { type: String },
    label: { type: String },
  },
  { _id: false }
);

const WorkflowSchema = new Schema<IWorkflow>(
  {
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
  },
  {
    timestamps: true,
  }
);

// 索引
WorkflowSchema.index({ owner: 1, updatedAt: -1 });
WorkflowSchema.index({ isPublic: 1, runCount: -1 });
WorkflowSchema.index({ tags: 1 });
WorkflowSchema.index({ category: 1 });

// ── 执行日志 Schema ─────────────────────────────────

const NodeExecutionSchema = new Schema<INodeExecution>(
  {
    nodeId: { type: String, required: true },
    nodeType: { type: String, required: true },
    nodeLabel: { type: String, required: true },
    status: { type: String, enum: ['pending', 'running', 'success', 'error', 'skipped'], default: 'pending' },
    input: { type: Schema.Types.Mixed },
    output: { type: Schema.Types.Mixed },
    error: { type: String },
    startTime: { type: Date },
    endTime: { type: Date },
    duration: { type: Number },
  },
  { _id: false }
);

const WorkflowRunSchema = new Schema<IWorkflowRun>(
  {
    workflowId: { type: String, required: true, index: true },
    status: { type: String, enum: ['running', 'completed', 'failed'], default: 'running' },
    input: { type: Schema.Types.Mixed, default: {} },
    output: { type: Schema.Types.Mixed },
    nodeExecutions: { type: [NodeExecutionSchema], default: [] },
    totalDuration: { type: Number },
    error: { type: String },
  },
  {
    timestamps: true,
  }
);

WorkflowRunSchema.index({ workflowId: 1, createdAt: -1 });

// ── 导出 ────────────────────────────────────────────

export const Workflow = mongoose.model<IWorkflow>('Workflow', WorkflowSchema);
export const WorkflowRun = mongoose.model<IWorkflowRun>('WorkflowRun', WorkflowRunSchema);

// ── 可用的节点类型 ──────────────────────────────────

export const NODE_TYPES: { type: string; label: string; category: string; icon: string; color: string; defaultConfig: Record<string, any> }[] = [
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
