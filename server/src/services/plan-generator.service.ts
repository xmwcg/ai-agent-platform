import { createAIClient, aiModelManager, type AIProvider } from '../config/ai-models';

export interface PlanGenerateParams {
  topic: string;            // 方案主题
  type?: 'business' | 'marketing' | 'technical' | 'education' | 'general'; // 方案类型
  audience?: string;        // 目标受众
  length?: 'brief' | 'detailed' | 'comprehensive';
  requirements?: string;    // 额外要求
}

export interface PlanResult {
  topic: string;
  type: string;
  content: string;          // Markdown 格式方案
  outline: string[];        // 大纲
  provider: string;
  model: string;
}

const TYPE_PROMPTS: Record<string, string> = {
  business: '商业计划书/商业方案',
  marketing: '营销推广方案',
  technical: '技术方案/实施方案',
  education: '教育培训方案',
  general: '综合方案',
};

const LENGTH_GUIDE: Record<string, string> = {
  brief: '简洁版（约 800 字，包含核心要点）',
  detailed: '标准版（约 2000 字，包含分章节详细内容）',
  comprehensive: '完整版（约 4000 字，包含背景、目标、策略、执行步骤、预算、风险与评估）',
};

/** 方案生成服务 - 办公自动化核心能力（借鉴 GPT Researcher 思路） */
class PlanGeneratorService {
  async generate(params: PlanGenerateParams): Promise<PlanResult> {
    const { topic, type = 'general', audience, length = 'detailed', requirements } = params;
    if (!topic?.trim()) throw new Error('方案主题不能为空');

    const mockMode = process.env.ENABLE_MOCK_MODE === 'true';
    const p = aiModelManager.getDefaultProvider()?.name.toLowerCase() as AIProvider || 'openai';
    const m = aiModelManager.getProvider(p as AIProvider)?.defaultModel || 'gpt-4o';

    if (mockMode) {
      const content = this.buildMockPlan(topic, type, length);
      return {
        topic,
        type: TYPE_PROMPTS[type] || type,
        content,
        outline: ['项目背景', '核心目标', '实施方案', '执行步骤', '预算与资源', '风险评估', '效果评估'],
        provider: p,
        model: m,
      };
    }

    const client = createAIClient(p as AIProvider);
    const sysPrompt = `你是一名资深方案策划专家。请为用户生成一份专业的${TYPE_PROMPTS[type] || '综合'}方案。
要求：
- 格式：Markdown
- 篇幅：${LENGTH_GUIDE[length]}
- 结构清晰，包含可执行的步骤与量化指标
- 语言专业、务实${audience ? `\n- 目标受众：${audience}` : ''}${
      requirements ? `\n- 额外要求：${requirements}` : ''
    }`;

    const completion = await client.chat.completions.create({
      model: m,
      messages: [
        { role: 'system', content: sysPrompt },
        { role: 'user', content: `请生成关于「${topic}」的方案` },
      ],
      temperature: 0.7,
      max_tokens: length === 'comprehensive' ? 4000 : 2000,
    });

    const content = completion.choices[0]?.message?.content || '';
    return {
      topic,
      type: TYPE_PROMPTS[type] || type,
      content,
      outline: this.extractOutline(content),
      provider: p,
      model: m,
    };
  }

  private extractOutline(md: string): string[] {
    const lines = md.split('\n').filter((l) => /^#{1,3}\s/.test(l.trim()));
    return lines.slice(0, 10).map((l) => l.replace(/^#{1,3}\s/, '').trim());
  }

  private buildMockPlan(topic: string, type: string, length: string): string {
    const size = length === 'brief' ? '简洁' : length === 'comprehensive' ? '完整' : '标准';
    return `# ${topic} ${TYPE_PROMPTS[type] || ''}方案（${size}版）

> 以下为 Mock 模式生成的演示内容，配置 API Key 后将由大模型生成真实方案。

## 一、项目背景
当前市场环境下，「${topic}」已成为提升竞争力的关键要素。本方案旨在系统性地规划落地路径。

## 二、核心目标
- 短期：完成可行性验证与试点
- 中期：规模化推广并验证 ROI
- 长期：形成标准化能力与壁垒

## 三、实施方案
1. 组建专项小组，明确职责
2. 调研标杆案例，提炼最佳实践
3. 制定里程碑与关键指标（KPI）

## 四、执行步骤
| 阶段 | 时间 | 交付物 |
|------|------|--------|
| 启动 | 第 1 周 | 立项文档 |
| 试点 | 第 2-4 周 | 试点报告 |
| 推广 | 第 5-8 周 | 推广方案 |

## 五、预算与资源
- 人力：核心成员 3-5 人
- 预算：按实际规模测算

## 六、风险评估
- 市场变化风险：建立快速响应机制
- 执行风险：设置阶段性检查点

## 七、效果评估
通过核心指标月度复盘，持续优化方案。
`;
  }
}

export const planGeneratorService = new PlanGeneratorService();
