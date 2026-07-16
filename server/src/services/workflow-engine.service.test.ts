/**
 * 阶段0 测试安全网（characterization test）
 * ───────────────────────────────────────────────────────────────────────
 * 目的：在阶段1a 用「安全表达式求值器」替换 workflow-engine 内部的 `new Function`
 * （workflow-engine.service.ts 的 condition 节点 line 272、code 节点 line 286，属于
 * P0 RCE 高危）之前，先锁定「拓扑编排 + 节点执行」的现有行为，作为回归防护网。
 *
 * 重要：其中针对 code 节点的「任意 JS 代码执行」、condition 节点的 `new Function`
 * 求值，属于 P0 高危行为（任意代码执行）。本文件刻意以「改造前现状」断言之，作为
 * 基线快照。阶段1a 落地后，这些用例必须同步改写为「安全语义」断言（例如 code 节点
 * 默认拒绝执行 / 走白名单沙盒；condition 仅支持受限安全表达式）。
 */

import WorkflowEngine from './workflow-engine.service';
import { aiAgentService } from './ai-agent';
import { embeddingService } from './embedding';
import { WorkflowRun } from '../models/Workflow';

// 控制数据库写入（execute 内部会调用 WorkflowRun.create / save / findByIdAndUpdate）
jest.mock('../models/Workflow', () => {
  const run = { _id: 'mockrun', save: jest.fn().mockResolvedValue(undefined) };
  return {
    __esModule: true,
    Workflow: {
      findById: jest.fn(),
      findByIdAndUpdate: jest.fn().mockResolvedValue({}),
    },
    WorkflowRun: {
      create: jest.fn().mockResolvedValue(run),
      findByIdAndUpdate: jest.fn().mockResolvedValue(undefined),
    },
    NODE_TYPES: [],
  };
});

// 避免外部 SDK / 连接副作用（ai_chat / rag / translate 节点才用到，本测试不触发）
jest.mock('./ai-agent', () => ({
  aiAgentService: { createSession: jest.fn(), sendMessage: jest.fn() },
}));
jest.mock('./rag', () => ({ ragService: {} }));
jest.mock('./embedding', () => ({
  embeddingService: { searchSimilarDocuments: jest.fn() },
}));
jest.mock('../lib/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function node(id: string, type: string, config: Record<string, any> = {}) {
  return {
    id,
    type,
    position: { x: 0, y: 0 },
    data: { type, label: id, config },
  } as any;
}

const engine = new WorkflowEngine();

function wf(id: string, nodes: any[], edges: any[] = []) {
  return {
    name: `wf-${id}`,
    _id: id,
    nodes,
    edges,
    runCount: 0,
    version: 1,
  } as any;
}

describe('workflow-engine.service · 拓扑编排', () => {
  it('input → condition → output 串联得到正确结果（默认启用受限求值）', async () => {
    const res = await engine.execute(
      wf('wf1', [
        node('in', 'input'),
        node('cond', 'condition', { condition: 'input > 20', trueBranch: 'big', falseBranch: 'small' }),
        node('out', 'output'),
      ], [
        { id: 'e1', source: 'in', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'out' },
      ]),
      { userInput: 21 },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: true, branch: 'big' });
    expect(res.nodeExecutions).toHaveLength(3);
    expect(res.nodeExecutions.every((e: any) => e.status === 'success')).toBe(true);
  });

  it('节点按拓扑顺序执行（condition 能看到上游 input 节点的输出）', async () => {
    const res = await engine.execute(
      wf('wf2', [
        node('in', 'input'),
        node('cond', 'condition', { condition: "input === 'hi'", trueBranch: 'match', falseBranch: 'nomatch' }),
        node('out', 'output'),
      ], [
        { id: 'e1', source: 'in', target: 'cond' },
        { id: 'e2', source: 'cond', target: 'out' },
      ]),
      { userInput: 'hi' },
      'u1'
    );
    // input 节点把 userInput 透传给 condition 节点，condition 用 input 变量求值
    expect(res.output).toEqual({ conditionResult: true, branch: 'match' });
  });
});

describe('workflow-engine.service · code 节点（阶段1a 止血：默认禁用）', () => {
  it('默认禁用：不再执行任意 JS，返回禁用错误而不是结果', async () => {
    const res = await engine.execute(
      wf('wf3', [node('code', 'code', { code: 'return input.toUpperCase()' })]),
      { userInput: 'hello' },
      'u1'
    );
    const codeExec = res.nodeExecutions.find((e: any) => e.nodeType === 'code')!;
    expect(codeExec.status).toBe('error');
    expect(String(codeExec.output)).toMatch(/已禁用/);
    expect(res.output).not.toBe('HELLO'); // 证明任意代码未被执行
  });

  it('默认禁用：无法访问全局/进程对象（消除 RCE）', async () => {
    const res = await engine.execute(
      wf('wf4', [node('code', 'code', { code: 'return typeof process' })]),
      { userInput: 1 },
      'u1'
    );
    const codeExec = res.nodeExecutions.find((e: any) => e.nodeType === 'code')!;
    expect(codeExec.status).toBe('error');
    expect(String(codeExec.output)).toMatch(/已禁用/);
    expect(res.output).not.toBe('object');
  });

  it('默认禁用优先于语法检查：危险或非法代码均被拒绝', async () => {
    const res = await engine.execute(
      wf('wf5', [node('code', 'code', { code: 'return (' })]),
      { userInput: 1 },
      'u1'
    );
    const codeExec = res.nodeExecutions.find((e: any) => e.nodeType === 'code')!;
    expect(codeExec.status).toBe('error');
    expect(String(codeExec.output)).toMatch(/已禁用/);
  });
});

describe('workflow-engine.service · condition 节点（阶段1a：受限表达式求值）', () => {
  it('条件为真时输出 trueBranch', async () => {
    const res = await engine.execute(
      wf('wf6', [
        node('cond', 'condition', {
          condition: 'input > 3',
          trueBranch: 'yes',
          falseBranch: 'no',
        }),
      ]),
      { userInput: 5 },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: true, branch: 'yes' });
  });

  it('条件为假时输出 falseBranch', async () => {
    const res = await engine.execute(
      wf('wf7', [
        node('cond', 'condition', {
          condition: 'input > 3',
          trueBranch: 'yes',
          falseBranch: 'no',
        }),
      ]),
      { userInput: 2 },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: false, branch: 'no' });
  });

  it('通过 input 变量访问输入并求值（不再使用 {{input}} 插值，避免注入）', async () => {
    const res = await engine.execute(
      wf('wf8', [
        node('cond', 'condition', {
          condition: "input === 'hello'",
          trueBranch: 'match',
          falseBranch: 'nomatch',
        }),
      ]),
      { userInput: 'hello' },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: true, branch: 'match' });
  });

  it('表达式语法错误时回退为 falseBranch', async () => {
    const res = await engine.execute(
      wf('wf9', [
        node('cond', 'condition', {
          condition: 'return (',
          trueBranch: 'yes',
          falseBranch: 'no',
        }),
      ]),
      { userInput: 1 },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: false, branch: 'no' });
  });

  it('含危险标识符（如 process）的表达式被拒绝并回退 falseBranch（止血验证）', async () => {
    const res = await engine.execute(
      wf('wf10', [
        node('cond', 'condition', {
          condition: 'process.exit(1)',
          trueBranch: 'yes',
          falseBranch: 'no',
        }),
      ]),
      { userInput: 1 },
      'u1'
    );
    expect(res.output).toEqual({ conditionResult: false, branch: 'no' });
  });
});

describe('workflow-engine.service · code 节点（启用后：受限执行 / 危险代码拦截）', () => {
  const ORIG = process.env.WORKFLOW_CODE_NODE_ENABLED;
  let EnabledEngine: any;

  beforeAll(() => {
    process.env.WORKFLOW_CODE_NODE_ENABLED = 'true';
    jest.isolateModules(() => {
      EnabledEngine = require('./workflow-engine.service').default;
    });
    process.env.WORKFLOW_CODE_NODE_ENABLED = ORIG;
  });

  it('启用后：受限代码可处理输入并返回结果', async () => {
    const res = await new EnabledEngine().execute(
      wf('wf11', [node('code', 'code', { code: 'return input.toUpperCase()' })]),
      { userInput: 'hello' },
      'u1'
    );
    const codeExec = res.nodeExecutions.find((e: any) => e.nodeType === 'code')!;
    expect(codeExec.status).toBe('success');
    expect(res.output).toBe('HELLO');
  });

  it('启用后：含危险标识符的代码被拦截（不执行）', async () => {
    const res = await new EnabledEngine().execute(
      wf('wf12', [node('code', 'code', { code: 'process.exit(1)' })]),
      { userInput: 1 },
      'u1'
    );
    const codeExec = res.nodeExecutions.find((e: any) => e.nodeType === 'code')!;
    expect(codeExec.status).toBe('error');
    expect(String(codeExec.output)).toMatch(/不允许/);
  });
});

describe('workflow-engine.service · 生产真实性门禁', () => {
  const createSessionMock = aiAgentService.createSession as jest.Mock;
  const sendMessageMock = aiAgentService.sendMessage as jest.Mock;
  const searchDocumentsMock = embeddingService.searchSimilarDocuments as jest.Mock;

  beforeEach(() => {
    createSessionMock.mockReset();
    sendMessageMock.mockReset();
    searchDocumentsMock.mockReset();
  });

  async function expectLastRunFailed() {
    const createMock = WorkflowRun.create as jest.Mock;
    const lastResult = createMock.mock.results[createMock.mock.results.length - 1];
    const createdRun = await lastResult.value;
    expect(createdRun.status).toBe('failed');
  }

  it('AI 对话 Provider 失败时节点和工作流失败，不返回伪成功文案', async () => {
    createSessionMock.mockRejectedValueOnce(new Error('AI provider unavailable'));

    const res = await engine.execute(
      wf('wf-ai-failure', [node('chat', 'ai_chat')]),
      { userInput: 'hello' },
      'u1'
    );

    expect(res.nodeExecutions[0]).toEqual(expect.objectContaining({
      status: 'error',
      error: 'AI provider unavailable',
    }));
    expect(res.nodeExecutions[0].output).toBeUndefined();
    await expectLastRunFailed();
  });

  it('RAG Provider 失败时节点和工作流失败，不回退空结果', async () => {
    searchDocumentsMock.mockRejectedValueOnce(new Error('vector store unavailable'));

    const res = await engine.execute(
      wf('wf-rag-failure', [node('rag', 'rag_search')]),
      { userInput: 'query' },
      'u1'
    );

    expect(res.nodeExecutions[0]).toEqual(expect.objectContaining({
      status: 'error',
      error: 'vector store unavailable',
    }));
    expect(res.nodeExecutions[0].output).toBeUndefined();
    await expectLastRunFailed();
  });

  it('翻译 Provider 失败时节点和工作流失败，不把原文包装成译文', async () => {
    createSessionMock.mockResolvedValueOnce('session-1');
    sendMessageMock.mockRejectedValueOnce(new Error('translation provider unavailable'));

    const res = await engine.execute(
      wf('wf-translate-failure', [node('translate', 'translate', { targetLanguage: '英文' })]),
      { userInput: '待翻译文本' },
      'u1'
    );

    expect(res.nodeExecutions[0]).toEqual(expect.objectContaining({
      status: 'error',
      error: 'translation provider unavailable',
    }));
    expect(res.nodeExecutions[0].output).toBeUndefined();
    await expectLastRunFailed();
  });

  it('尚未接入真实执行器的 skill 节点明确失败', async () => {
    const res = await engine.execute(
      wf('wf-skill-unavailable', [node('skill', 'skill')]),
      { userInput: 'hello' },
      'u1'
    );

    expect(res.nodeExecutions[0]).toEqual(expect.objectContaining({
      status: 'error',
      error: '技能节点尚未接入真实技能执行器',
    }));
    expect(res.nodeExecutions[0].output).toBeUndefined();
    await expectLastRunFailed();
  });
});
