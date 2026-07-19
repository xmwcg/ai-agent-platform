import { Router, Request, Response } from 'express';
import { route } from '../gateway/ai-gateway.service';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';
import { logger } from '../lib/logger';

const router = Router();

// 支持的编程语言
type ProgrammingLanguage =
  | 'javascript' | 'typescript' | 'python' | 'java' | 'cpp' | 'c' | 'go' | 'rust' | 'html' | 'css' | 'sql' | 'shell';

// 解释级别
type ExplanationLevel = 'brief' | 'detailed' | 'teaching';

// 代码解释接口
interface CodeExplanationRequest {
  code: string;
  language: ProgrammingLanguage;
  level: ExplanationLevel;
  context?: string; // 上下文（可选）
}

// 代码解释服务
class CodeExplanationService {
  // 构建解释提示词
  private buildPrompt(code: string, language: string, level: string, context?: string): string {
    let prompt = '';

    switch (level) {
      case 'brief':
        prompt = `Please provide a brief explanation of the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplain what this code does in 2-3 sentences.`;
        break;

      case 'detailed':
        prompt = `Please provide a detailed explanation of the following ${language} code:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nExplain:\n1. What the code does\n2. How it works (line by line)\n3. Key concepts used\n4. Potential issues or improvements`;
        break;

      case 'teaching':
        prompt = `Act as a programming teacher and explain the following ${language} code to a beginner:\n\n\`\`\`${language}\n${code}\n\`\`\`\n\nProvide:\n1. **Simple Explanation**: What the code does in simple terms\n2. **Line-by-Line Breakdown**: Explain each important line\n3. **Key Concepts**: Define important concepts used\n4. **Related Knowledge**: Link to related topics in the knowledge base\n5. **Practice Suggestion**: What the learner should practice next\n\nUse beginner-friendly language and examples.`;
        break;
    }

    if (context) {
      prompt += `\n\nAdditional Context: ${context}`;
    }

    return prompt;
  }

  // 解释代码
  async explainCode(
    code: string,
    language: ProgrammingLanguage,
    level: ExplanationLevel = 'detailed',
    context?: string
  ): Promise<{ explanation: string; concepts: string[] }> {
    try {
      const prompt = this.buildPrompt(code, language, level, context);
      const completion = await route({
        model: 'agnes/agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content: 'You are an expert programmer and teacher. Provide clear, accurate code explanations.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        maxTokens: 2000
      });

      const explanation = completion.reply || 'No explanation generated';

      // 提取关键概念（简单实现）
      const concepts = this.extractConcepts(explanation);

      return { explanation, concepts };
    } catch (error) {
      logger.error('code-explanation', '解释代码失败', error);
      throw error;
    }
  }

  // 提取关键概念（简单实现）
  private extractConcepts(explanation: string): string[] {
    // 简单提取：查找常见的编程概念关键词
    const conceptKeywords = [
      'function', 'variable', 'loop', 'condition', 'array', 'object',
      'class', 'method', 'inheritance', 'async', 'promise', 'callback',
      'api', 'database', 'query', 'algorithm', 'recursion', 'iteration'
    ];

    const concepts: string[] = [];
    const lowerExplanation = explanation.toLowerCase();

    conceptKeywords.forEach(keyword => {
      if (lowerExplanation.includes(keyword) && !concepts.includes(keyword)) {
        concepts.push(keyword);
      }
    });

    return concepts;
  }

  // 生成代码示例
  async generateExample(
    concept: string,
    language: ProgrammingLanguage
  ): Promise<string> {
    try {
      const completion = await route({
        model: 'agnes/agnes-2.0-flash',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful coding assistant.'
          },
          {
            role: 'user',
            content: `Generate a simple ${language} code example demonstrating the concept of "${concept}". Include comments explaining the code.`
          }
        ],
        temperature: 0.5
      });

      return completion.reply || '';
    } catch (error) {
      logger.error('code-explanation', '生成示例失败', error);
      throw error;
    }
  }
}

// 导出服务实例
const codeExplanationService = new CodeExplanationService();

// API 路由

// 解释代码
router.post('/explain', optionalAuth, enforceQuota('code_explain'), async (req: AuthRequest, res: Response) => {
  try {
    const { code, language, level = 'detailed', context } = req.body;

    if (!code) {
      return res.status(400).json({ error: 'Code is required' });
    }

    if (!language) {
      return res.status(400).json({ error: 'Programming language is required' });
    }

    const result = await codeExplanationService.explainCode(
      code,
      language,
      level,
      context
    );

    if (req.user?.id) {
      await quotaIncrement(req.user.id, 'code_explain');
    }

    res.json({
      success: true,
      explanation: result.explanation,
      concepts: result.concepts
    });
  } catch (error) {
    logger.error('code-explanation', '解释接口失败', error);
    sendError(res, error);
  }
});

// 生成代码示例
router.post('/example', optionalAuth, enforceQuota('code_explain'), async (req: AuthRequest, res: Response) => {
  try {
    const { concept, language } = req.body;

    if (!concept || !language) {
      return res.status(400).json({ error: 'Concept and language are required' });
    }

    const example = await codeExplanationService.generateExample(concept, language);

    if (req.user?.id) {
      await quotaIncrement(req.user.id, 'code_explain');
    }

    res.json({
      success: true,
      concept,
      language,
      example
    });
  } catch (error) {
    logger.error('code-explanation', '生成示例接口失败', error);
    sendError(res, error);
  }
});

// 获取支持的编程语言
router.get('/languages', (req: Request, res: Response) => {
  const languages = [
    { value: 'javascript', label: 'JavaScript' },
    { value: 'typescript', label: 'TypeScript' },
    { value: 'python', label: 'Python' },
    { value: 'java', label: 'Java' },
    { value: 'cpp', label: 'C++' },
    { value: 'go', label: 'Go' },
    { value: 'rust', label: 'Rust' },
    { value: 'html', label: 'HTML' },
    { value: 'css', label: 'CSS' },
    { value: 'sql', label: 'SQL' },
    { value: 'shell', label: 'Shell' }
  ];

  res.json({
    success: true,
    languages
  });
});

export default router;
