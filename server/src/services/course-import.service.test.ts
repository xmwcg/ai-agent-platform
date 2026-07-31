import fs from 'fs';
import os from 'os';
import path from 'path';
import { buildCourseImportPayload, selectCourseDefinitions } from './course-import.service';

describe('NexMind 课程导入构建器', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'nexmind-course-'));
    const course = path.join(root, '02-python-engineering');
    fs.mkdirSync(path.join(course, '01-工程基础'), { recursive: true });
    fs.mkdirSync(path.join(course, '02-配置管理'), { recursive: true });
    fs.writeFileSync(path.join(course, '01-工程基础', '1.1-第一课.md'), '# 第一课\n\n真实正文', 'utf8');
    fs.writeFileSync(path.join(course, '01-工程基础', '1.2-第二课.md'), '# 第二课\n\n练习与答案', 'utf8');
    fs.writeFileSync(path.join(course, '02-配置管理', '2.1-YAML.md'), '# YAML\n\n配置校验', 'utf8');
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('按章节和课时顺序合并真实 Markdown 正文', () => {
    const definition = selectCourseDefinitions(['02-python-engineering'])[0];
    const payload = buildCourseImportPayload(root, definition);

    expect(payload.sourceCourseId).toBe('02-python-engineering');
    expect(payload.price).toBe(1990);
    expect(payload.requiredPlan).toBe('pro');
    expect(payload.freePreviewChapters).toBe(2);
    expect(payload.chapters).toHaveLength(2);
    expect(payload.chapters[0].title).toBe('工程基础');
    expect(payload.chapters[0].content).toContain('# 第一课');
    expect(payload.chapters[0].content).toContain('# 第二课');
    expect(payload.chapters[1].content).toContain('配置校验');
  });

  it('拒绝未知课程 ID，避免导入错误目录', () => {
    expect(() => selectCourseDefinitions(['../../secret'])).toThrow('未知课程 ID');
  });
});
