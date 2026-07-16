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
import vm from 'vm';

// ── 受限表达式 / 代码沙盒（P0 止血：替换 new Function 任意代码执行）──
// condition 节点使用受限表达式求值；code 节点默认禁用，需管理员显式开启。
// 主防线为 vm 受限 context（仅暴露 input，不暴露 process / require 等宿主全局）。
// 已知限制：标识符黑名单可被 Unicode 转义绕过，深度硬化见阶段2 安全文档。
const CODE_NODE_ENABLED = process.env.WORKFLOW_CODE_NODE_ENABLED === 'true';

const FORBIDDEN_TOKENS = /\b(constructor|__proto__|prototype|process|require|module|exports|global|globalThis|eval|Function|import|export|while|for|switch|case|break|continue|class|extends|new|delete|instanceof|typeof|void|with|this|window|document|fetch|XMLHttpRequest|http|https|fs|child_process|spawn|exec)\b/;

function createSandbox(input: any): vm.Context {
  const sandbox: Record<string, any> = { input };
  return vm.createContext(sandbox);
}

function safeEvaluateExpression(
  expression: string,
  input: any,
  timeoutMs = 100
): { ok: boolean; value?: any; error?: string } {
  if (typeof expression !== 'string' || expression.trim() === '') {
    return { ok: false, error: '空表达式' };
  }
  if (FORBIDDEN_TOKENS.test(expression)) {
    return { ok: false, error: '表达式含不允许的语法或标识符' };
  }
  const sandbox = createSandbox(input);
  try {
    const result = vm.runInContext(
      `(function(input){ "use strict"; return (${expression}); })(input)`,
      sandbox,
      { timeout: timeoutMs }
    );
    return { ok: true, value: result };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

function safeExecuteCode(
  code: string,
  input: any,
  timeoutMs = 1000
): { ok: boolean; value?: any; error?: string; disabled?: boolean } {
  if (!CODE_NODE_ENABLED) {
    return { ok: false, disabled: true, error: '代码执行节点已按安全策略禁用' };
  }
  if (typeof code !== 'string' || code.trim() === '') {
    return { ok: false, error: '空代码' };
  }
  if (FORBIDDEN_TOKENS.test(code)) {
    return { ok: false, error: '代码含不允许的语法或标识符' };
  }
  const sandbox = createSandbox(input);
  try {
    const result = vm.runInContext(
      `(function(input){ "use strict"; ${code} })(input)`,
      sandbox,
      { timeout: timeoutMs }
    );
    return { ok: true, value: result };
  } catch (e: any) {
    return { ok: false, error: e.message };
  }
}

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
            execution.status = 'error';
            execution.error = e instanceof Error ? e.message : '人工智能对话执行失败';
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
            execution.status = 'error';
            execution.error = e instanceof Error ? e.message : '知识检索执行失败';
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
            execution.status = 'error';
            execution.error = e instanceof Error ? e.message : '翻译执行失败';
          }
          break;
        }

        case 'condition': {
          const config = node.data.config || {};
          const condition = config.condition || '';
          // 受限表达式求值（不再做 {{input}} 字符串插值，避免代码注入；
          // 表达式通过 input 变量访问输入，在 vm 受限 context 中执行）
          const result = safeEvaluateExpression(condition, input);
          if (result.ok) {
            execution.output = { conditionResult: result.value, branch: result.value ? config.trueBranch : config.falseBranch };
            execution.status = 'success';
          } else {
            // 语法错误或含危险标识符：安全回退为 falseBranch，绝不执行未授权代码
            execution.output = { conditionResult: false, branch: config.falseBranch };
            execution.status = 'success';
          }
          break;
        }

        case 'code': {
          const config = node.data.config || {};
          // P0 止血：code 节点默认禁用，需管理员显式配置 WORKFLOW_CODE_NODE_ENABLED=true
          const res = safeExecuteCode(config.code || 'return input;', input);
          if (res.disabled) {
            execution.output = '代码执行节点已禁用（安全策略）。如需启用，请联系管理员配置 WORKFLOW_CODE_NODE_ENABLED=true，且仅用于可信工作流。';
            execution.status = 'error';
            execution.error = res.error;
          } else if (res.ok) {
            execution.output = res.value;
            execution.status = 'success';
          } else {
            execution.output = `执行错误: ${res.error}`;
            execution.status = 'error';
            execution.error = res.error;
          }
          break;
        }

        case 'skill': {
          // 统一工作流技能节点尚未接入技能注册表，不得将空壳节点标记为成功。
          execution.status = 'error';
          execution.error = '技能节点尚未接入真实技能执行器';
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
