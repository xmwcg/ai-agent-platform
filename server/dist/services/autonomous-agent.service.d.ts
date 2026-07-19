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
export interface TaskStep {
    id: string;
    description: string;
    type: 'search' | 'analyze' | 'generate' | 'compare' | 'execute' | 'summarize';
    dependencies?: string[];
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    result?: string;
    error?: string;
    retries: number;
    maxRetries: number;
}
export interface AgentGoal {
    goal: string;
    context?: string;
    constraints?: string[];
    userId: string;
    maxSteps?: number;
    maxRetries?: number;
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
declare class AutonomousAgentEngine {
    private memoryStore;
    /**
     * 主入口：接收高层目标，自主完成全部步骤
     */
    executeGoal(goal: AgentGoal): Promise<AgentResult>;
    /**
     * LLM 拆解目标为子任务步骤
     */
    private decomposeGoal;
    /**
     * 执行单个步骤
     */
    private executeStep;
    /**
     * 汇总最终结果
     */
    private synthesizeResult;
    /**
     * 更新用户长期记忆
     */
    private updateMemory;
    /**
     * 获取用户记忆
     */
    getUserMemory(userId: string): UserMemory | undefined;
    /**
     * 清除用户记忆
     */
    clearUserMemory(userId: string): void;
}
export declare const autonomousAgent: AutonomousAgentEngine;
export default AutonomousAgentEngine;
//# sourceMappingURL=autonomous-agent.service.d.ts.map