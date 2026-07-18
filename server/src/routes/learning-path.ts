import { Router, Request, Response } from 'express';
import { createAIClient } from '../config/ai-models';
import { Course } from '../models/Course';
import { AuthRequest, optionalAuth } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { AppError, sendError } from '../lib/http-error';

const router = Router();

type Level = 'beginner' | 'intermediate' | 'advanced';

interface Milestone {
  week: number;
  title: string;
  description: string;
  courses: { id: string; title: string; completed?: boolean }[];
  quiz?: { title: string; passed?: boolean };
}

export interface LearningPath {
  id: string;
  title: string;
  description: string;
  targetLevel: Level;
  estimatedWeeks: number;
  milestones: Milestone[];
  generatedBy: 'ai' | 'template';
}

/** 明确由用户选择的预置路径模板；生产 AI 生成接口失败时不得伪装成生成成功。 */
const TEMPLATES: Record<Level, LearningPath> = {
  beginner: {
    id: 'tpl-beginner',
    title: 'AI 应用入门路径',
    description: '零基础到能熟练使用 AI 工具完成日常工作与学习，涵盖对话、知识管理与基础编程。',
    targetLevel: 'beginner',
    estimatedWeeks: 6,
    generatedBy: 'template',
    milestones: [
      {
        week: 1,
        title: '第 1-2 周：AI 对话与提示词',
        description: '掌握与 AI 高效对话的方法，理解提示词工程基础。',
        courses: [],
        quiz: { title: '提示词基础测验', passed: false },
      },
      {
        week: 3,
        title: '第 3-4 周：知识中枢管理',
        description: '建立个人知识库，使用 RAG 检索增强自己的资料。',
        courses: [],
      },
      {
        week: 5,
        title: '第 5-6 周：代码助手初探',
        description: '用 AI 代码解释器读懂并改写简单脚本。',
        courses: [],
        quiz: { title: '代码助手测验', passed: false },
      },
    ],
  },
  intermediate: {
    id: 'tpl-intermediate',
    title: 'AI 生产力进阶路径',
    description: '将 AI 融入工作流，掌握 RAG、Agent 插件与多模型协作。',
    targetLevel: 'intermediate',
    estimatedWeeks: 10,
    generatedBy: 'template',
    milestones: [
      {
        week: 1,
        title: '第 1-3 周：RAG 与工作流',
        description: '构建专属知识检索管线，提升回答准确性。',
        courses: [],
        quiz: { title: 'RAG 原理测验', passed: false },
      },
      {
        week: 4,
        title: '第 4-6 周：Agent 与插件',
        description: '通过 MCP 插件扩展 AI 能力，连接外部工具。',
        courses: [],
      },
      {
        week: 7,
        title: '第 7-10 周：模型对比与选型',
        description: '学会根据任务对比不同模型的性价比与适用场景。',
        courses: [],
        quiz: { title: '模型选型测验', passed: false },
      },
    ],
  },
  advanced: {
    id: 'tpl-advanced',
    title: 'AI 工程师成长路径',
    description: '从原理到生产部署，掌握 LLM 全生命周期管理与 AI Agent 开发。',
    targetLevel: 'advanced',
    estimatedWeeks: 12,
    generatedBy: 'template',
    milestones: [
      {
        week: 1,
        title: '第 1-3 周：大模型基础',
        description: 'Transformer 原理、主流模型对比、Prompt 工程进阶。',
        courses: [],
        quiz: { title: '大模型基础测验', passed: false },
      },
      {
        week: 4,
        title: '第 4-7 周：微调与 RAG 系统',
        description: 'LoRA/QLoRA 微调、RAG 系统搭建与评估。',
        courses: [],
      },
      {
        week: 8,
        title: '第 8-10 周：生产部署',
        description: 'vLLM、模型量化、高并发推理服务。',
        courses: [],
        quiz: { title: '部署测验', passed: false },
      },
      {
        week: 11,
        title: '第 11-12 周：AI Agent 开发',
        description: 'LangChain/LangGraph、工具调用、MCP 集成。',
        courses: [],
      },
    ],
  },
};

// 预置模板（无需 AI）

// ─── 根路由：返回学习路径能力入口 ───
router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      capabilities: [
        { type: "list", label: "学习路径列表", path: "/api/learning-path", desc: "查看所有学习路径" },
        { type: "templates", label: "路径模板", path: "/api/learning-path/templates", desc: "查看预设学习路径模板" },
        { type: "create", label: "创建路径", path: "/api/learning-path", desc: "创建自定义学习路径", method: "POST" },
      ],
    },
  });
});
router.get('/templates', (req: Request, res: Response) => {
  const level = (req.query.level as Level) || 'beginner';
  const tpl = TEMPLATES[level] || TEMPLATES.beginner;
  res.json({ success: true, data: tpl });
});

export function isLearningPathTemplateFallbackAllowed(env = process.env.NODE_ENV): boolean {
  return env !== 'production';
}

function parseGeneratedLearningPath(rawText: string, requestedLevel: Level): LearningPath {
  let raw: any;
  try {
    raw = JSON.parse(rawText);
  } catch (error) {
    throw new AppError(
      502,
      'AI 返回的学习路径格式无效，请稍后重试',
      'LEARNING_PATH_INVALID_RESPONSE',
      error instanceof Error ? error.message : String(error),
    );
  }

  const validLevel = raw?.targetLevel === 'beginner'
    || raw?.targetLevel === 'intermediate'
    || raw?.targetLevel === 'advanced';
  const validMilestones = Array.isArray(raw?.milestones)
    && raw.milestones.length > 0
    && raw.milestones.every((milestone: any) => (
      Number.isFinite(Number(milestone?.week))
      && Number(milestone.week) > 0
      && typeof milestone?.title === 'string'
      && milestone.title.trim().length > 0
      && typeof milestone?.description === 'string'
      && Array.isArray(milestone?.courses)
    ));

  if (
    typeof raw?.title !== 'string'
    || raw.title.trim().length === 0
    || typeof raw?.description !== 'string'
    || !validLevel
    || !Number.isFinite(Number(raw?.estimatedWeeks))
    || Number(raw.estimatedWeeks) <= 0
    || !validMilestones
  ) {
    throw new AppError(
      502,
      'AI 返回的学习路径格式无效，请稍后重试',
      'LEARNING_PATH_INVALID_RESPONSE',
    );
  }

  return {
    id: `ai-${Date.now()}`,
    title: raw.title.trim(),
    description: raw.description.trim(),
    targetLevel: validLevel ? raw.targetLevel : requestedLevel,
    estimatedWeeks: Number(raw.estimatedWeeks),
    milestones: raw.milestones,
    generatedBy: 'ai',
  };
}

export async function generateLearningPathWithAI(input: {
  level: Level;
  goal?: string;
  interests?: string;
  courseList: { id: string; title: string; level: string; category: string }[];
}): Promise<LearningPath> {
  const { level, goal, interests, courseList } = input;
  const system = `你是一名资深学习路径设计师。根据用户目标与可用课程库，生成一份个性化学习路径。
要求：
- 以 JSON 返回，结构：{ "title": string, "description": string, "targetLevel": "beginner"|"intermediate"|"advanced", "estimatedWeeks": number, "milestones": [{ "week": number, "title": string, "description": string, "courses": [{ "id": string, "title": string }], "quiz"?: { "title": string } }] }
- milestones 的 courses 必须尽量引用提供的课程库（使用其 id 与 title），若确实无合适课程可留空数组。
- 仅返回 JSON，不要额外说明。`;
  const user = `用户水平：${level}
学习目标：${goal || '全面提升 AI 应用能力'}
兴趣方向：${interests || '不限'}
可用课程库（JSON）：${JSON.stringify(courseList)}`;

  let content: string;
  try {
    const client = createAIClient();
    const completion = await client.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });
    content = completion.choices[0]?.message?.content || '';
  } catch (error) {
    throw new AppError(
      503,
      '学习路径 AI 服务暂时不可用，请稍后重试',
      'LEARNING_PATH_PROVIDER_UNAVAILABLE',
      error instanceof Error ? error.message : String(error),
    );
  }

  if (!content.trim()) {
    throw new AppError(
      502,
      'AI 返回的学习路径格式无效，请稍后重试',
      'LEARNING_PATH_INVALID_RESPONSE',
    );
  }
  return parseGeneratedLearningPath(content, level);
}

// AI 生成个性化路径（引用真实课程库）
router.post(
  '/generate',
  optionalAuth,
  enforceQuota('learning_path'),
  async (req: AuthRequest, res: Response) => {
    const { level = 'beginner', goal, interests } = req.body as {
      level?: Level;
      goal?: string;
      interests?: string;
    };
    try {
      const normalizedLevel: Level = ['beginner', 'intermediate', 'advanced'].includes(level)
        ? level
        : 'beginner';
      const courses = await Course.find({ isPublished: true })
        .select('title level category')
        .limit(60)
        .lean();
      const courseList = courses.map((c: any) => ({
        id: String(c._id),
        title: c.title,
        level: c.level,
        category: c.category,
      }));

      let path: LearningPath;
      try {
        path = await generateLearningPathWithAI({
          level: normalizedLevel,
          goal,
          interests,
          courseList,
        });
      } catch (error) {
        if (!isLearningPathTemplateFallbackAllowed()) throw error;
        path = TEMPLATES[normalizedLevel];
      }

      if (req.user?.id) {
        await quotaIncrement(req.user.id, 'learning_path');
      }
      res.json({ success: true, data: path });
    } catch (err) {
      sendError(res, err);
    }
  }
);

export default router;
