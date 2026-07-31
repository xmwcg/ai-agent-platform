import fs from 'fs';
import path from 'path';

export type NexMindCoursePlan = 'pro' | 'max';

export interface NexMindCourseDefinition {
  id: string;
  title: string;
  description: string;
  price: number;
  requiredPlan: NexMindCoursePlan;
  category: string;
  tags: string[];
}

export interface CourseImportChapter {
  title: string;
  description: string;
  order: number;
  duration: number;
  content: string;
  resources: Array<{ title: string; type: 'pdf' | 'code' | 'link' | 'file'; url: string }>;
}

export interface CourseImportPayload {
  sourceCourseId: string;
  title: string;
  description: string;
  instructor: string;
  level: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  tags: string[];
  price: number;
  requiredPlan: NexMindCoursePlan;
  freePreviewChapters: number;
  chapters: CourseImportChapter[];
}

export const NEXMIND_COURSE_CATALOG: NexMindCourseDefinition[] = [
  { id: '01-saas-fullstack', title: 'SaaS全栈开发实战 — 从零到上线', description: '基于 AIbak 真实源码学习架构、认证、支付、前端与生产部署。', price: 2990, requiredPlan: 'pro', category: '全栈开发', tags: ['SaaS', 'React', 'Express', 'MongoDB'] },
  { id: '02-python-engineering', title: 'Python工程化工具开发实战', description: '从脚本到可安装、可测试、可销售的 Python 工具产品。', price: 1990, requiredPlan: 'pro', category: 'Python工程化', tags: ['Python', 'CLI', 'YAML', '工程化'] },
  { id: '03-ai-application', title: '企业级AI应用开发实战', description: '基于 AIbak 的 RAG、知识库、模型网关和 Agent 工作流构建企业 AI 应用。', price: 3990, requiredPlan: 'pro', category: 'AI应用', tags: ['AI', 'RAG', 'Agent', '知识库'] },
  { id: '04-devops-deployment', title: 'DevOps生产部署实战', description: '覆盖容器化、CI/CD、Kubernetes、Cloudflare Tunnel 与生产运维。', price: 3990, requiredPlan: 'max', category: 'DevOps', tags: ['Docker', 'CI/CD', 'Kubernetes', 'Cloudflare'] },
  { id: '05-security-encryption', title: '安全加密与认证体系实战', description: '从认证、加密、权限、审计到企业安全架构的完整实践。', price: 2990, requiredPlan: 'pro', category: '安全', tags: ['认证', '加密', '权限', '审计'] },
  { id: '06-enterprise-network', title: '企业网络管理与授权系统实战', description: '基于金网通真实产品学习网络扫描、设备指纹、授权与支付交付。', price: 2990, requiredPlan: 'pro', category: '企业网络', tags: ['网络扫描', 'License', '企业软件'] },
  { id: '07-obsidian-sync-engine', title: 'Obsidian知识库同步引擎开发实战', description: '构建安全过滤、增量同步、自动分类和索引生成的知识同步引擎。', price: 1990, requiredPlan: 'pro', category: '知识工程', tags: ['Obsidian', 'NexMind Flow', '知识库'] },
  { id: '08-realtime-translation', title: '多语言实时翻译平台实战', description: '基于 TranSync 学习实时翻译、语音、扩展、支付和跨端部署。', price: 4990, requiredPlan: 'max', category: '实时翻译', tags: ['TranSync', 'Next.js', '语音', '实时翻译'] },
  { id: '09-project-grade', title: '智评通 — AI项目质量评估实战', description: '学习代码扫描、证据投影、评分、报告和 CI 发布门禁。', price: 3990, requiredPlan: 'pro', category: '质量工程', tags: ['ProjectGrade', '代码质量', 'CI'] },
];

const MAX_TOPIC_BYTES = 2 * 1024 * 1024;
const MAX_COURSE_BYTES = 20 * 1024 * 1024;

function cleanDirectoryTitle(value: string): string {
  return value.replace(/^\d+[.-]?\s*/, '').replace(/[-_]+/g, ' ').trim();
}

function ensureInside(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new Error(`课程路径越界：${candidate}`);
  }
}

function estimateDuration(content: string): number {
  const readableCharacters = content.replace(/```[\s\S]*?```/g, '').replace(/\s+/g, '').length;
  return Math.max(8, Math.ceil(readableCharacters / 600) * 5);
}

export function buildCourseImportPayload(
  coursesRoot: string,
  definition: NexMindCourseDefinition,
): CourseImportPayload {
  const root = fs.realpathSync(coursesRoot);
  const requestedCourseDir = path.join(root, definition.id);
  const courseDir = fs.realpathSync(requestedCourseDir);
  ensureInside(root, courseDir);

  const chapterDirectories = fs.readdirSync(courseDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.isSymbolicLink())
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

  if (chapterDirectories.length === 0) {
    throw new Error(`课程没有章节目录：${definition.id}`);
  }

  let totalBytes = 0;
  const chapters = chapterDirectories.map((chapterEntry, chapterIndex): CourseImportChapter => {
    const chapterDir = path.join(courseDir, chapterEntry.name);
    ensureInside(courseDir, chapterDir);
    const topicFiles = fs.readdirSync(chapterDir, { withFileTypes: true })
      .filter((entry) => entry.isFile() && !entry.isSymbolicLink() && entry.name.toLowerCase().endsWith('.md'))
      .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN', { numeric: true }));

    if (topicFiles.length === 0) {
      throw new Error(`章节没有 Markdown 课时：${definition.id}/${chapterEntry.name}`);
    }

    const topicContents = topicFiles.map((topicEntry) => {
      const topicPath = path.join(chapterDir, topicEntry.name);
      ensureInside(chapterDir, topicPath);
      const stat = fs.statSync(topicPath);
      if (stat.size > MAX_TOPIC_BYTES) {
        throw new Error(`单个课时超过 2MB：${topicPath}`);
      }
      totalBytes += stat.size;
      if (totalBytes > MAX_COURSE_BYTES) {
        throw new Error(`课程正文超过 20MB：${definition.id}`);
      }
      return fs.readFileSync(topicPath, 'utf8').trim();
    });

    const content = topicContents.join('\n\n---\n\n');
    return {
      title: cleanDirectoryTitle(chapterEntry.name),
      description: `包含 ${topicFiles.length} 个真实项目课时`,
      order: chapterIndex + 1,
      duration: estimateDuration(content),
      content,
      resources: [],
    };
  });

  return {
    sourceCourseId: definition.id,
    title: definition.title,
    description: definition.description,
    instructor: 'NexMind by AIbak',
    level: 'intermediate',
    category: definition.category,
    tags: definition.tags,
    price: definition.price,
    requiredPlan: definition.requiredPlan,
    freePreviewChapters: 2,
    chapters,
  };
}

export function selectCourseDefinitions(ids?: string[]): NexMindCourseDefinition[] {
  if (!ids?.length) return NEXMIND_COURSE_CATALOG;
  const requested = new Set(ids);
  const selected = NEXMIND_COURSE_CATALOG.filter((course) => requested.has(course.id));
  const missing = ids.filter((id) => !selected.some((course) => course.id === id));
  if (missing.length) throw new Error(`未知课程 ID：${missing.join(', ')}`);
  return selected;
}
