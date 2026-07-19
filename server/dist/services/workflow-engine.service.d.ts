/**
 * 工作流执行引擎
 * 对标 Langflow / n8n：按拓扑顺序执行节点链，支持条件分支和错误处理
 */
import { IWorkflow, INodeExecution } from '../models/Workflow';
declare class WorkflowEngine {
    /**
     * 执行工作流
     */
    execute(workflowIdOrObj: string | IWorkflow, input: Record<string, unknown>, userId?: string): Promise<{
        runId: string;
        output: unknown;
        nodeExecutions: INodeExecution[];
    }>;
    /**
     * 执行单个节点
     */
    private executeNode;
    /**
     * 发布工作流为 API 端点
     */
    publishWorkflow(workflowId: string): Promise<{
        apiKey: string;
        endpoint: string;
    }>;
    /**
     * 取消发布
     */
    unpublishWorkflow(workflowId: string): Promise<void>;
}
export declare const workflowEngine: WorkflowEngine;
export default WorkflowEngine;
//# sourceMappingURL=workflow-engine.service.d.ts.map