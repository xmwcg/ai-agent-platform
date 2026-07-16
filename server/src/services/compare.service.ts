import { createAIClient, aiModelManager, type AIProvider } from '../config/ai-models';
import { logger } from '../lib/logger';
import { AppError } from '../lib/http-error';

export interface CompareItem {
  id: string;
  name: string;
  type: 'model' | 'tool' | 'framework' | 'language' | 'hardware';
  provider?: string;
  description?: string;
  specs?: Record<string, any>;
}

export interface CompareRequest {
  items: string[]; // item IDs
  dimensions?: string[]; // 对比维度
}

export interface CompareResult {
  items: CompareItem[];
  dimensions: Dimension[];
  rows: CompareRow[];
  recommendation?: string;
}

export interface Dimension {
  key: string;
  label: string;
  unit?: string;
}

export interface CompareRow {
  dimension: string;
  values: (string | number | boolean)[];
  winner?: number; // index of winner
}

export class CompareService {
  // 预置可对比的项
  private presets: CompareItem[] = [
    // AI 模型
    { id: 'gpt-4o', name: 'GPT-4o', type: 'model', provider: 'openai', description: 'OpenAI 最新旗舰多模态模型' },
    { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', type: 'model', provider: 'anthropic', description: 'Anthropic 平衡型模型，擅长推理' },
    { id: 'deepseek-v3', name: 'DeepSeek V3', type: 'model', provider: 'deepseek', description: '国产开源 MoE 模型，性价比极高' },
    { id: 'deepseek-r1', name: 'DeepSeek R1', type: 'model', provider: 'deepseek', description: '推理专用模型，数学/代码能力强' },
    { id: 'hunyuan-pro', name: '腾讯混元 Pro', type: 'model', provider: 'hunyuan', description: '腾讯自研大模型，中文理解优秀' },
    { id: 'qwen-max', name: '通义千问 Max', type: 'model', provider: 'qwen', description: '阿里云旗舰模型，中文能力均衡' },
    // 工具/框架
    { id: 'langchain', name: 'LangChain', type: 'framework', description: 'LLM 应用开发框架，生态丰富' },
    { id: 'langgraph', name: 'LangGraph', type: 'framework', description: '状态机工作流引擎，适合复杂 Agent' },
    { id: 'dify', name: 'Dify', type: 'framework', description: '低代码 AI 应用平台' },
    // 编程语言
    { id: 'python', name: 'Python', type: 'language', description: 'AI 生态首选语言' },
    { id: 'typescript', name: 'TypeScript', type: 'language', description: '前端/全栈 AI 应用' },
    { id: 'go', name: 'Go', type: 'language', description: '高性能 Agent 网关/沙盒' },
  ];

  getPresets(): CompareItem[] {
    return this.presets;
  }

  getPresetsByType(type: CompareItem['type']): CompareItem[] {
    return this.presets.filter(p => p.type === type);
  }

  // 生成对比：生产环境只接受真实 AI 结果；静态参考值仅用于开发/测试。
  async generateCompare(req: CompareRequest): Promise<CompareResult> {
    const items = this.presets.filter(p => req.items.includes(p.id));
    if (items.length < 2) {
      throw new Error('At least 2 items required');
    }

    const dimensions: Dimension[] = this.getDimensions(items[0].type);

    try {
      return await this.generateCompareWithAI(items, dimensions);
    } catch (err) {
      logger.warn('compare', `AI 对比生成失败: ${(err as Error).message}`);
      if (process.env.NODE_ENV === 'production') {
        if (err instanceof AppError) throw err;
        throw new AppError(
          503,
          '真实对比数据暂时不可用，请稍后重试',
          'COMPARE_PROVIDER_UNAVAILABLE',
          err instanceof Error ? err.message : String(err)
        );
      }
      const rows: CompareRow[] = dimensions.map(dim => ({
        dimension: dim.key,
        values: items.map(item => this.getDevelopmentReferenceValue(item, dim.key)),
      }));
      return {
        items,
        dimensions,
        rows,
        recommendation: this.generateRecommendation(items),
      };
    }
  }

  // 调用 AI 生成对比（返回与维度对齐的结构化数据）
  private async generateCompareWithAI(items: CompareItem[], dimensions: Dimension[]): Promise<CompareResult> {
    const client = createAIClient();

    const itemsContext = items.map(i => `- ${i.name}（${i.provider || i.type}）：${i.description || ''}`).join('\n');
    const dimContext = dimensions.map(d => `- ${d.key}（${d.label}${d.unit ? '，单位 ' + d.unit : ''}）`).join('\n');

    const prompt = `你是专业的 AI/技术选型顾问。请基于公开事实，对以下项目进行客观对比。
对比项：
${itemsContext}

请针对每个维度，给出每个对比项的取值（数值/布尔/短文本），并判断该维度的「最优项」下标（winner，从 0 开始；若难分高下可填 -1）。
维度列表：
${dimContext}

仅返回如下 JSON，不要任何额外文字：
{
  "rows": [
    { "dimension": "<维度 key>", "values": [<按对比项顺序的取值>], "winner": <最优项下标或 -1> }
  ],
  "recommendation": "<结合场景的推荐总结，中文，含要点>"
}`;

    const completion = await client.chat.completions.create({
      model: aiModelManager.getDefaultProvider()?.defaultModel || 'gpt-4o',
      messages: [
        { role: 'system', content: '你只输出严格 JSON，不解释。' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content) as { rows?: CompareRow[]; recommendation?: string };

    if (process.env.NODE_ENV === 'production' && (!parsed.rows?.length || !parsed.recommendation?.trim())) {
      throw new AppError(502, '真实对比数据返回格式无效', 'COMPARE_INVALID_RESPONSE');
    }

    const rows: CompareRow[] = (parsed.rows && parsed.rows.length)
      ? parsed.rows
      : dimensions.map(dim => ({ dimension: dim.key, values: items.map(i => this.getDevelopmentReferenceValue(i, dim.key)) }));

    return {
      items,
      dimensions,
      rows,
      recommendation: parsed.recommendation || this.generateRecommendation(items),
    };
  }

  private getDimensions(type: CompareItem['type']): Dimension[] {
    switch (type) {
      case 'model':
        return [
          { key: 'provider', label: '厂商' },
          { key: 'context_window', label: '上下文长度', unit: 'tokens' },
          { key: 'max_output', label: '最大输出', unit: 'tokens' },
          { key: 'price_input', label: '输入价格', unit: '$/1M tokens' },
          { key: 'price_output', label: '输出价格', unit: '$/1M tokens' },
          { key: 'multimodal', label: '多模态' },
          { key: 'coding', label: '代码能力' },
          { key: 'reasoning', label: '推理能力' },
          { key: 'chinese', label: '中文理解' },
        ];
      case 'framework':
        return [
          { key: 'language', label: '语言' },
          { key: 'open_source', label: '开源' },
          { key: 'complexity', label: '复杂度' },
          { key: 'ecosystem', label: '生态丰富度' },
          { key: 'learning_curve', label: '学习曲线' },
        ];
      case 'language':
        return [
          { key: 'type', label: '类型' },
          { key: 'ai_ecosystem', label: 'AI 生态' },
          { key: 'performance', label: '执行性能' },
          { key: 'learning_curve', label: '学习曲线' },
        ];
      default:
        return [{ key: 'description', label: '描述' }];
    }
  }

  private getDevelopmentReferenceValue(item: CompareItem, dimKey: string): string | number | boolean {
    // 仅供开发/测试界面联调，不得作为生产实时价格或能力事实展示。
    const developmentReferenceDB: Record<string, Record<string, any>> = {
      'gpt-4o': {
        provider: 'OpenAI', context_window: 128000, max_output: 16384,
        price_input: 5, price_output: 15, multimodal: true, coding: 9, reasoning: 8, chinese: 7
      },
      'claude-3-sonnet': {
        provider: 'Anthropic', context_window: 200000, max_output: 8192,
        price_input: 3, price_output: 15, multimodal: true, coding: 8, reasoning: 9, chinese: 6
      },
      'deepseek-v3': {
        provider: 'DeepSeek', context_window: 128000, max_output: 8192,
        price_input: 0.14, price_output: 0.28, multimodal: false, coding: 8, reasoning: 7, chinese: 9
      },
      'deepseek-r1': {
        provider: 'DeepSeek', context_window: 64000, max_output: 8192,
        price_input: 0.14, price_output: 0.28, multimodal: false, coding: 9, reasoning: 10, chinese: 8
      },
      'hunyuan-pro': {
        provider: '腾讯', context_window: 32768, max_output: 4096,
        price_input: 0.8, price_output: 1.2, multimodal: true, coding: 6, reasoning: 7, chinese: 10
      },
      'qwen-max': {
        provider: '阿里云', context_window: 32768, max_output: 8192,
        price_input: 1.2, price_output: 1.2, multimodal: true, coding: 7, reasoning: 7, chinese: 10
      },
    };
    return developmentReferenceDB[item.id]?.[dimKey] ?? item.specs?.[dimKey] ?? '—';
  }

  private generateRecommendation(items: CompareItem[]): string {
    const modelItems = items.filter(i => i.type === 'model');
    if (modelItems.length >= 2) {
      return `**推荐总结**：\n\n- 预算有限选 **${modelItems.find(m => m.id.includes('deepseek'))?.name || 'DeepSeek V3'}**（性价比最高）\n- 复杂推理选 **${modelItems.find(m => m.id.includes('claude'))?.name || 'Claude 3 Sonnet'}**（推理能力最强）\n- 多模态需求选 **${modelItems.find(m => m.id.includes('gpt4o'))?.name || 'GPT-4o'}**（图像理解最佳）\n- 中文场景选 **${modelItems.find(m => m.id.includes('hunyuan') || m.id.includes('qwen'))?.name || '混元 Pro'}**（中文优化）`;
    }
    return '根据对比维度，建议结合实际使用场景选择最适合的方案。';
  }
}

export const compareService = new CompareService();
