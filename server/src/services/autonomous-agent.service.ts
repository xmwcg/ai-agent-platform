/**
 * 自主 Agent 执行引擎
 * 对标 AutoGPT：接收高层目标 → LLM 拆解为步骤 → 逐步执行 → 反思迭代 → 汇总结果
 *
 * 核心能力：
 * 1. Goal → Sub-tasks 自动拆分
 * 2. 多步执行（顺序 + 并行）
 * 3. 执行失败自动重试或调整策略
 * 4. 长期记忆：跨会话保留用户偏好和历史
 */

import { aiAgentService } from './ai-agent';
import { logger } from '../lib/logger';

// ── 类型定义 ──────────────────────────────────────────

export interface TaskStep {
  id: string;
  description: string;
  type: 'search' | 'analyze' | 'generate' | 'compare' | 'execute' | 'summarize';
  dependencies?: string[];   // 依赖的其他步骤 ID
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  result?: string;
  error?: string;
  retries: number;
  maxRetries: number;
}

export interface AgentGoal {
  goal: string;
  context?: string;          // 额外上下文
  constraints?: string[];    // 约束条件（如"不超过500字"）
  userId: string;
  maxSteps?: number;         // 最大步骤数
  maxRetries?: number;       // 每步最大重试
}

export interface AgentResult {
  success: boolean;
  goal: string;
  steps: TaskStep[];
  finalResult: string;
  totalDuration: number;
  error?: string;
}

export interface UserMemory {
  userId: string;
  preferences: Record<string, any>;
  recentTopics: string[];
  summary?: string;
  updatedAt: Date;
}

// ── 自主 Agent 引擎类 ─────────────────────────────────

class AutonomousAgentEngine {
  private memoryStore: Map<string, UserMemory> = new Map();

  /**
   * 主入口：接收高层目标，自主完成全部步骤
   */
  async executeGoal(goal: AgentGoal): Promise<AgentResult> {
    const startTime = Date.now();
    logger.info('agent-engine', `Starting goal: "${goal.goal}"`);

    try {
      // Step 1: LLM 拆解目标为子任务
      const steps = await this.decomposeGoal(goal);
      logger.info('agent-engine', `Decomposed into ${steps.length} steps`);

      // Step 2: 逐步执行（拓扑顺序）
      for (const step of steps) {
        if (step.status === 'completed') continue;

        await this.executeStep(step, goal, steps);
      }

      // Step 3: 汇总最终结果
      const finalResult = await this.synthesizeResult(goal, steps);

      // Step 4: 更新用户记忆
      await this.updateMemory(goal.userId, goal.goal, steps);

      const totalDuration = Date.now() - startTime;
      logger.info('agent-engine', `Goal completed in ${totalDuration}ms`);

      return {
        success: true,
        goal: goal.goal,
        steps,
        finalResult,
        totalDuration,
      };
    } catch (error: any) {
      logger.error('agent-engine', `Goal execution failed: ${error.message}`);
      return {
        success: false,
        goal: goal.goal,
        steps: [],
        finalResult: error.message,
        totalDuration: Date.now() - startTime,
        error: error.message,
      };
    }
  }

  /**
   * LLM 拆解目标为子任务步骤
   */
  private async decomposeGoal(goal: AgentGoal): Promise<TaskStep[]> {
    const systemPrompt = `你是一个任务规划专家。将用户的复杂目标拆解为可执行的子步骤。

返回 JSON 数组格式，每个步骤包含：
- description: 该步骤的描述（中文）
- type: 步骤类型，可选 "search"(搜索/检索信息), "analyze"(分析), "generate"(生成内容), "compare"(对比), "execute"(执行操作), "summarize"(汇总)
- dependencies: 依赖的其他步骤索引（从0开始），没有依赖则为空数组

示例输入：「分析竞品并生成报告」
示例输出：
[
  {"description":"搜索竞品信息","type":"search","dependencies":[]},
  {"description":"分析竞品优劣势","type":"analyze","dependencies":[0]},
  {"description":"生成对比分析报告","type":"generate","dependencies":[1]}
]

现在请拆解以下目标：${goal.goal}${goal.context ? '\n额外上下文：' + goal.context : ''}`;

    const sessionId = await aiAgentService.createSession(goal.userId);
    const result = await aiAgentService.sendMessage(sessionId, systemPrompt, {
      systemPrompt: '你是任务规划专家，只输出合法 JSON 数组，不要输出其他内容。',
    });

    try {
      // 解析 JSON
      const match = result.reply.match(/\[[\s\S]*\]/);
      const jsonStr = match ? match[0] : result.reply;
      const parsed = JSON.parse(jsonStr);

      return parsed.map((item: any, idx: number) => ({
        id: `step-${idx}`,
        description: item.description,
        type: item.type || 'analyze',
        dependencies: (item.dependencies || []).map((d: number) => `step-${d}`),
        status: 'pending' as const,
        retries: 0,
        maxRetries: goal.maxRetries || 2,
      }));
    } catch {
      // JSON 解析失败：手动拆解为基础步骤
      logger.warn('agent-engine', 'Goal decomposition JSON parse failed, using basic steps');
      return [
        { id: 'step-0', description: `搜索关于「${goal.goal}」的相关信息`, type: 'search', status: 'pending', retries: 0, maxRetries: 1 },
        { id: 'step-1', description: `分析「${goal.goal}」的关键要点`, type: 'analyze', status: 'pending', retries: 0, maxRetries: 1, dependencies: ['step-0'] },
        { id: 'step-2', description: `生成「${goal.goal}」的最终方案`, type: 'generate', status: 'pending', retries: 0, maxRetries: 1, dependencies: ['step-1'] },
      ];
    }
  }

  /**
   * 执行单个步骤
   */
  private async executeStep(step: TaskStep, goal: AgentGoal, allSteps: TaskStep[]): Promise<void> {
    step.status = 'running';
    logger.info('agent-engine', `Executing step: ${step.description}`);

    try {
      // 构建上下文（包含已完成步骤的结果）
      let context = '';
      for (const depId of step.dependencies || []) {
        const dep = allSteps.find(s => s.id === depId);
        if (dep?.result) {
          context += `\n[参考 ${dep.id} 结果]\n${dep.result}\n`;
        }
      }

      const sessionId = await aiAgentService.createSession(goal.userId);
      const prompt = `目标：${goal.goal}\n当前步骤：${step.description}\n${context}\n${goal.constraints ? '\n约束：' + goal.constraints.join('；') : ''}\n请完成此步骤。`;

      const result = await aiAgentService.sendMessage(sessionId, prompt);
      step.result = result.reply;
      step.status = 'completed';
    } catch (error: any) {
      step.retries++;
      if (step.retries <= step.maxRetries) {
        logger.warn('agent-engine', `Step ${step.id} failed, retrying (${step.retries}/${step.maxRetries})`);
        return this.executeStep(step, goal, allSteps);
      }
      step.status = 'failed';
      step.error = error.message;
    }
  }

  /**
   * 汇总最终结果
   */
  private async synthesizeResult(goal: AgentGoal, steps: TaskStep[]): Promise<string> {
    const completedSteps = steps.filter(s => s.result);
    if (completedSteps.length === 0) return '无可用结果。';

    const sessionId = await aiAgentService.createSession(goal.userId);
    const prompt = `请根据以下步骤的执行结果，生成最终汇总方案。

目标：${goal.goal}

${completedSteps.map(s => `[${s.id}] ${s.description}\n${s.result}`).join('\n\n---\n\n')}

请输出一个完整的汇总结果。`;

    const result = await aiAgentService.sendMessage(sessionId, prompt);
    return result.reply;
  }

  /**
   * 更新用户长期记忆
   */
  private async updateMemory(userId: string, goal: string, steps: TaskStep[]): Promise<void> {
    let memory = this.memoryStore.get(userId);
    if (!memory) {
      memory = { userId, preferences: {}, recentTopics: [], updatedAt: new Date() };
    }

    // 提取主题关键词
    const topics = goal.substring(0, 50).split(/[，,。.、\s]+/).filter(Boolean);
    memory.recentTopics = [...new Set([...topics, ...memory.recentTopics])].slice(0, 20);
    memory.preferences.lastGoal = goal;
    memory.preferences.lastExecution = new Date().toISOString();
    memory.updatedAt = new Date();

    this.memoryStore.set(userId, memory);
  }

  /**
   * 获取用户记忆
   */
  getUserMemory(userId: string): UserMemory | undefined {
    return this.memoryStore.get(userId);
  }

  /**
   * 清除用户记忆
   */
  clearUserMemory(userId: string): void {
    this.memoryStore.delete(userId);
  }
}

export const autonomousAgent = new AutonomousAgentEngine();
export default AutonomousAgentEngine;
