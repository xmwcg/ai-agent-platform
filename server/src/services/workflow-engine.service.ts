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

function createSandbox(input: unknown): vm.Context {
  const sandbox: Record<string, unknown> = { input };
  return vm.createContext(sandbox);
}

function safeEvaluateExpression(
  expression: string,
  input: unknown,
  timeoutMs = 100
): { ok: boolean; value?: unknown; error?: string } {
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
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

function safeExecuteCode(
  code: string,
  input: unknown,
  timeoutMs = 1000
): { ok: boolean; value?: unknown; error?: string; disabled?: boolean } {
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
  } catch (e: unknown) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

// ── 工作流内调用用户技能（prompt / mcp / workflow 三类）──
// 使用动态 import 避免与 skills 路由形成循环依赖（skills 路由反向依赖本引擎）。

/** 把 {{var}} 占位符用调用入参替换；无模板时退化为取常见字段 */
function renderSkillTemplate(tpl: string | undefined, input: Record<string, any>): string {
  if (!tpl) {
    const v = input?.text ?? input?.input ?? input?.query ?? input?.message;
    if (v !== undefined) return String(v);
    return typeof input === 'object' ? JSON.stringify(input) : String(input ?? '');
  }
  return tpl.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const v = input?.[key];
    return v === undefined ? '' : typeof v === 'string' ? v : JSON.stringify(v);
  });
}

/** 渲染 MCP 工具入参模板（仅对字符串值做占位符替换） */
function renderSkillArgs(tpl: Record<string, any> | undefined, input: Record<string, any>): Record<string, any> {
  if (!tpl) return { ...input };
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(tpl)) {
    out[k] = typeof v === 'string' ? renderSkillTemplate(v, input) : v;
  }
  return out;
}

async function runUserSkillInWorkflow(
  us: any,
  userId: string | undefined,
  input: Record<string, any>
): Promise<{ ok: boolean; data?: any; error?: string; status?: number; code?: string }> {
  if (us.kind === 'prompt') {
    const userMsg = renderSkillTemplate(us.prompt?.userTemplate, input);
    const { route } = await import('../gateway/ai-gateway.service');
    const r = await route({
      messages: [
        { role: 'system', content: us.prompt?.system || '' },
        { role: 'user', content: userMsg },
      ],
      maxTokens: us.prompt?.maxTokens ?? 800,
      temperature: us.prompt?.temperature ?? 0.5,
    });
    return { ok: true, data: { reply: r.reply } };
  }
  if (us.kind === 'mcp') {
    const { mcpService } = await import('../services/mcp.service');
    const srv = mcpService.getServer(us.mcp.serverId);
    if (!srv) return { ok: false, error: `引用的 MCP 服务器不存在：${us.mcp.serverId}` };
    if (srv.status !== 'connected') {
      try { await mcpService.connect(us.mcp.serverId); } catch (e: any) { return { ok: false, error: `MCP 连接失败：${e.message}` }; }
    }
    const args = renderSkillArgs(us.mcp.argsTemplate, input);
    const res = await mcpService.callTool(us.mcp.serverId, us.mcp.tool, args);
    return { ok: true, data: res };
  }
  if (us.kind === 'workflow') {
    const result = await workflowEngine.execute(us.workflow.workflowId, input, userId);
    return { ok: true, data: result };
  }
  return { ok: false, error: '未知技能类型', status: 400, code: 'SKILL_UNKNOWN_KIND' };
}

// ── 执行上下文 ───────────────────────────────────────

interface ExecutionContext {
  input: Record<string, unknown>;
  nodeOutputs: Map<string, unknown>; // nodeId → 该节点的输出
  sessionId?: string;                 // AI 对话会话 ID
  userId?: string;                    // 执行用户
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

function getNodeInput(nodeId: string, edges: IWorkflowEdge[], ctx: ExecutionContext): unknown {
  const incomingEdges = edges.filter(e => e.target === nodeId);
  if (incomingEdges.length === 0) {
    return ctx.input.userInput || '';
  }
  if (incomingEdges.length === 1) {
    return ctx.nodeOutputs.get(incomingEdges[0].source) || '';
  }
  // 多输入：合并
  const inputs: Record<string, unknown> = {};
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
    input: Record<string, unknown>,
    userId?: string
  ): Promise<{ runId: string; output: unknown; nodeExecutions: INodeExecution[] }> {
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
    const levels = topologicalSort(workflow.nodes, workflow.edges);
    logger.info('workflow-engine', `Executing ${workflow.name} (${levels.length} levels, ${workflow.nodes.length} nodes)`);

    const allExecutions: INodeExecution[] = [];
    let finalOutput: unknown = null;

    // 逐层执行
    for (const level of levels) {
      // 同层并行执行
      const levelPromises = level.map(async (nodeId) => {
        const node = workflow.nodes.find((n) => n.id === nodeId);
        if (!node) return null;

        const nodeInput = getNodeInput(nodeId, workflow.edges, ctx);
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
    const outputNode = workflow.nodes.find((n) => n.data.type === 'output');
    if (outputNode) {
      finalOutput = ctx.nodeOutputs.get(outputNode.id);
    } else {
      // 没有输出节点：返回最后一个有输出的结果
      const outputs = Array.from(ctx.nodeOutputs.entries());
      finalOutput = outputs.length > 0 ? outputs[outputs.length - 1][1] : {};
    }

    // 更新执行记录
    run.status = allExecutions.some(e => e.status === 'error') ? 'failed' : 'completed';
    run.nodeExecutions = allExecutions;
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
    input: unknown,
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
          } catch (e: unknown) {
            execution.status = 'error';
            execution.error = e instanceof Error ? e.message : '人工智能对话执行失败';
          }
          break;
        }

        case 'rag_search': {
          const config = node.data.config || {};
          const inputObj = input as Record<string, unknown>;
          const query: string = typeof input === 'string' ? input : (typeof inputObj.query === 'string' ? inputObj.query : JSON.stringify(input));
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
          } catch (e: unknown) {
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
          } catch (e: unknown) {
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
          const config = node.data.config || {};
          const skillId: string | undefined = config.skillId || config.skillName;
          if (!skillId) {
            // 未配置技能：明确错误，绝不假装成功
            execution.status = 'error';
            execution.error = '技能节点未配置技能：请在节点配置中选择要调用的技能（skillId）';
            break;
          }
          try {
            const nodeInputObj: Record<string, any> =
              typeof input === 'object' && input !== null ? (input as Record<string, any>) : { text: String(input ?? '') };

            const { getSkill } = await import('../skills/registry');
            const builtin = getSkill(skillId);
            let result: { ok: boolean; data?: any; error?: string; status?: number; code?: string };

            if (builtin) {
              result = await builtin.invoke({ userId: ctx.userId, input: nodeInputObj });
            } else {
              const { UserSkill } = await import('../models/UserSkill');
              const us = await UserSkill.findOne({ skillId });
              if (!us) {
                execution.status = 'error';
                execution.error = `未找到技能：${skillId}（内置技能或用户已安装技能中均不存在）`;
                break;
              }
              result = await runUserSkillInWorkflow(us, ctx.userId, nodeInputObj);
            }

            if (!result.ok) {
              execution.status = 'error';
              execution.error = result.error || '技能执行失败';
              execution.output = { code: result.code, status: result.status };
            } else {
              execution.output = result.data;
              execution.status = 'success';
            }
          } catch (e: unknown) {
            execution.status = 'error';
            execution.error = e instanceof Error ? e.message : '技能节点执行异常';
          }
          break;
        }

        default:
          execution.output = input; // 透传
          execution.status = 'success';
      }
    } catch (error: unknown) {
      execution.status = 'error';
      execution.error = error instanceof Error ? error.message : 'Unknown error';
      execution.output = null;
    }

    execution.endTime = new Date();
    execution.duration = Date.now() - startTime;

    // 实时更新到数据库
    try {
      await WorkflowRun.findByIdAndUpdate(runId, {
        $push: { nodeExecutions: execution },
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
