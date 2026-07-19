import mongoose, { Document } from 'mongoose';
export interface WorkflowNodeData {
    type: 'input' | 'output' | 'ai_chat' | 'rag_search' | 'skill' | 'condition' | 'code' | 'translate' | 'media_gen' | 'web_search';
    label: string;
    config: Record<string, any>;
}
export interface IWorkflowNode {
    id: string;
    type: string;
    position: {
        x: number;
        y: number;
    };
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
export interface IWorkflow extends Document {
    name: string;
    description?: string;
    nodes: IWorkflowNode[];
    edges: IWorkflowEdge[];
    owner: string;
    teamId?: string;
    isPublic: boolean;
    isPublished: boolean;
    apiKey?: string;
    apiEndpoint?: string;
    runCount: number;
    tags: string[];
    category: string;
    thumbnail?: string;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
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
export declare const Workflow: mongoose.Model<IWorkflow, {}, {}, {}, mongoose.Document<unknown, {}, IWorkflow, {}, {}> & IWorkflow & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const WorkflowRun: mongoose.Model<IWorkflowRun, {}, {}, {}, mongoose.Document<unknown, {}, IWorkflowRun, {}, {}> & IWorkflowRun & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
}, any>;
export declare const NODE_TYPES: {
    type: string;
    label: string;
    category: string;
    icon: string;
    color: string;
    defaultConfig: Record<string, any>;
}[];
//# sourceMappingURL=Workflow.d.ts.map