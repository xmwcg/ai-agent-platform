/**
 * 工作流执行引擎
 * 对标 Langflow / n8n：按拓扑顺序执行节点链，支持条件分支和错误处理
 */

import { Workflow, WorkflowRun, IWorkflow, IWorkflowNode, IWorkflowEdge, INodeExecution } from '../models/Workflow';
import { aiAgentService } from './ai-agent';
import { ragService } from './rag';
import { embeddingService } from './embedding';
import { logger } from '../lib/logger';
import crypto from 'crypto';

// ── 执行上下文 ───────────────────────────────────────

interface ExecutionContext {
  input: Record<string, any>;
  nodeOutputs: Map<string, any>; // nodeId → 该节点的输出
  sessionId?: string;            // AI 对话会话 ID
  userId?: string;               // 执行用户
}

// ── 拓步排序 ─────────────────────────────────────────

function topologicalSort(nodes: IWorkflowNode[], edges: IWorkflowEdge[]): string[][] {
  // 构建邻接表和入度
  const adj = new Map<string, string[]>();
  const indegree = new Map<string, number>();

  for (const node of nodes) {
    adj.set(node.id, []);
    indegree.set(node.id, 0);
  }

  for (const edge of edges) {
    const targets = adj.get(edge.source) || [];
    targets.push(edge.target);
    adj.set(edge.source, targets);
    indegree.set(edge.target, (indegree.get(edge.target) || 0) + 1);
  }

  // Kahn 算法分层
  const levels: string[][] = [];
  const queue: string[] = [];

  for (const [nodeId, degree] of indegree) {
    if (degree === 0) queue.push(nodeId);
  }

  while (queue.length > 0) {
    const levelSize = queue.length;
    const level: string[] = [];
    for (let i = 0; i < levelSize; i++) {
      const nodeId = queue.shift()!;
      level.push(nodeId);
      for (const target of adj.get(nodeId) || []) {
        const newDegree = (indegree.get(target) || 1) - 1;
        indegree.set(target, newDegree);
        if (newDegree === 0) queue.push(target);
      }
    }
    levels.push(level);
  }

  return levels;
}

// ── 获取节点输入 ─────────────────────────────────────

function getNodeInput(nodeId: string, edges: IWorkflowEdge[], ctx: ExecutionContext): any {
  const incomingEdges = edges.filter(e => e.target === nodeId);
  if (incomingEdges.length === 0) {
    return ctx.input.userInput || '';
  }
  if (incomingEdges.length === 1) {
    return ctx.nodeOutputs.get(incomingEdges[0].source) || '';
  }
  // 多输入：合并
  const inputs: Record<string, any> = {};
  for (const edge of incomingEdges) {
    inputs[edge.source] = ctx.nodeOutputs.get(edge.source);
  }
  return inputs;
}

// ── 工作流执行引擎类 ─────────────────────────────────

class WorkflowEngine {
  /**
   * 执行工作流
   */
  async execute(
    workflowIdOrObj: string | IWorkflow,
    input: Record<string, any>,
    userId?: string
  ): Promise<{ runId: string; output: any; nodeExecutions: INodeExecution[] }> {
    // 获取工作流
    const workflow = typeof workflowIdOrObj === 'string'
      ? await Workflow.findById(workflowIdOrObj)
      : workflowIdOrObj;

    if (!workflow) throw new Error('Workflow not found');

    const workflowId = typeof workflowIdOrObj === 'string' ? workflowIdOrObj : String(workflow._id);

    // 创建执行记录
    const run = await WorkflowRun.create({
      workflowId,
      status: 'running',
      input,
      nodeExecutions: [],
    });

    const ctx: ExecutionContext = {
      input,
      nodeOutputs: new Map(),
      userId,
    };

    // 拓扑排序
    const levels = topologicalSort(workflow.nodes as any[], workflow.edges as any[]);
    logger.info('workflow-engine', `Executing ${workflow.name} (${levels.length} levels, ${workflow.nodes.length} nodes)`);

    const allExecutions: INodeExecution[] = [];
    let finalOutput: any = null;

    // 逐层执行
    for (const level of levels) {
      // 同层并行执行
      const levelPromises = level.map(async (nodeId) => {
        const node = workflow.nodes.find((n: any) => n.id === nodeId);
        if (!node) return null;

        const nodeInput = getNodeInput(nodeId, workflow.edges as any[], ctx);
        const execution = await this.executeNode(node, nodeInput, ctx, String(run._id));
        return execution;
      });

      const levelResults = await Promise.all(levelPromises);

      for (const result of levelResults) {
        if (result) {
          allExecutions.push(result);
          if (result.status !== 'error') {
            ctx.nodeOutputs.set(result.nodeId, result.output);
          }
        }
      }
    }

    // 找输出节点
    const outputNode = workflow.nodes.find((n: any) => n.data.type === 'output');
    if (outputNode) {
      finalOutput = ctx.nodeOutputs.get(outputNode.id);
    } else {
      // 没有输出节点：返回最后一个有输出的结果
      const outputs = Array.from(ctx.nodeOutputs.entries());
      finalOutput = outputs.length > 0 ? outputs[outputs.length - 1][1] : {};
    }

    // 更新执行记录
    run.status = allExecutions.some(e => e.status === 'error') ? 'failed' : 'completed';
    run.nodeExecutions = allExecutions as any;
    run.output = finalOutput;
    run.totalDuration = allExecutions.reduce((sum, e) => sum + (e.duration || 0), 0);
    await run.save();

    // 增加执行计数
    await Workflow.findByIdAndUpdate(workflowId, { $inc: { runCount: 1 } });

    logger.info('workflow-engine', `Workflow ${workflow.name} completed (${run.status})`);

    return { runId: String(run._id), output: finalOutput, nodeExecutions: allExecutions };
  }

  /**
   * 执行单个节点
   */
  private async executeNode(
    node: IWorkflowNode,
    input: any,
    ctx: ExecutionContext,
    runId: string
  ): Promise<INodeExecution> {
    const execution: INodeExecution = {
      nodeId: node.id,
      nodeType: node.data.type,
      nodeLabel: node.data.label,
      status: 'running',
      input,
      startTime: new Date(),
    };

    const startTime = Date.now();

    try {
      switch (node.data.type) {
        case 'input':
          execution.output = typeof input === 'string' ? input : JSON.stringify(input);
          execution.status = 'success';
          break;

        case 'output':
          execution.output = input;
          execution.status = 'success';
          break;

        case 'ai_chat': {
          const config = node.data.config || {};
          try {
            if (!ctx.sessionId) {
              ctx.sessionId = await aiAgentService.createSession(ctx.userId || 'workflow');
            }
            const result = await aiAgentService.sendMessage(
              ctx.sessionId,
              typeof input === 'string' ? input : JSON.stringify(input),
              { systemPrompt: config.systemPrompt }
            );
            execution.output = result.reply;
            execution.status = 'success';
          } catch (e) {
            execution.output = `[AI 对话失败]`;
            execution.status = 'success'; // 降级不阻塞
          }
          break;
        }

        case 'rag_search': {
          const config = node.data.config || {};
          const query = typeof input === 'string' ? input : input.query || JSON.stringify(input);
          try {
            const results = await embeddingService.searchSimilarDocuments(query, {
              limit: config.maxDocuments || 5,
              minSimilarity: config.minSimilarity || 0.7,
            });
            execution.output = results.map(r => ({
              title: r.document.title,
              content: r.document.content.substring(0, 500),
              similarity: r.similarity,
            }));
            execution.status = 'success';
          } catch (e) {
            execution.output = [];
            execution.status = 'success'; // 降级
          }
          break;
        }

        case 'translate': {
          const config = node.data.config || {};
          const text = typeof input === 'string' ? input : JSON.stringify(input);
          try {
            if (!ctx.sessionId) {
              ctx.sessionId = await aiAgentService.createSession(ctx.userId || 'workflow');
            }
            const prompt = `请将以下内容翻译为${config.targetLanguage || '英文'}：\n${text}`;
            const result = await aiAgentService.sendMessage(ctx.sessionId, prompt);
            execution.output = result.reply;
            execution.status = 'success';
          } catch (e) {
            execution.output = text;
            execution.status = 'success';
          }
          break;
        }

        case 'condition': {
          const config = node.data.config || {};
          const condition = config.condition || '';
          // 简单条件评估（支持 {{input}} 替换）
          const evaluatedCondition = condition.replace(/\{\{input\}\}/g, String(input));
          try {
            const fn = new Function('input', `return ${evaluatedCondition}`);
            const result = fn(input);
            execution.output = { conditionResult: result, branch: result ? config.trueBranch : config.falseBranch };
            execution.status = 'success';
          } catch {
            execution.output = { conditionResult: false, branch: config.falseBranch };
            execution.status = 'success';
          }
          break;
        }

        case 'code': {
          const config = node.data.config || {};
          try {
            const fn = new Function('input', config.code || 'return input;');
            execution.output = fn(input);
            execution.status = 'success';
          } catch (e: any) {
            execution.output = `执行错误: ${e.message}`;
            execution.status = 'error';
            execution.error = e.message;
          }
          break;
        }

        case 'skill': {
          // 技能占位：实际调用 skills 注册表
          execution.output = {
            executed: false,
            message: '技能节点需要配置具体技能名称。在画布右侧属性面板中配置。',
            input,
          };
          execution.status = 'success';
          break;
        }

        default:
          execution.output = input; // 透传
          execution.status = 'success';
      }
    } catch (error: any) {
      execution.status = 'error';
      execution.error = error.message || 'Unknown error';
      execution.output = null;
    }

    execution.endTime = new Date();
    execution.duration = Date.now() - startTime;

    // 实时更新到数据库
    try {
      await WorkflowRun.findByIdAndUpdate(runId, {
        $push: { nodeExecutions: execution as any },
      });
    } catch { /* 不阻塞执行 */ }

    return execution;
  }

  /**
   * 发布工作流为 API 端点
   */
  async publishWorkflow(workflowId: string): Promise<{ apiKey: string; endpoint: string }> {
    const workflow = await Workflow.findById(workflowId);
    if (!workflow) throw new Error('Workflow not found');

    const apiKey = crypto.randomBytes(24).toString('hex');
    const endpoint = `/api/wf/run/${workflowId}`;

    workflow.isPublished = true;
    workflow.apiKey = apiKey;
    workflow.apiEndpoint = endpoint;
    workflow.version += 1;
    await workflow.save();

    return { apiKey, endpoint };
  }

  /**
   * 取消发布
   */
  async unpublishWorkflow(workflowId: string): Promise<void> {
    await Workflow.findByIdAndUpdate(workflowId, { isPublished: false, apiKey: null });
  }
}

export const workflowEngine = new WorkflowEngine();
export default WorkflowEngine;
