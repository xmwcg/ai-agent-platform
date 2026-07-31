import { describe, expect, it } from 'vitest';
import {
  getCourseResourceLabel,
  renderCourseContent,
  renderCourseMarkdown,
  resolveCourseResourceUrl,
} from './course-content';

describe('课程内容交付工具', () => {
  it('将 Markdown 转换为可阅读结构并转义脚本', () => {
    const html = renderCourseMarkdown('# 标题\n\n- 第一项\n- 第二项\n\n```ts\nconst ok = true;\n```\n<script>alert(1)</script>');
    expect(html).toContain('<h1>标题</h1>');
    expect(html).toContain('<ul><li>第一项</li><li>第二项</li></ul>');
    expect(html).toContain('course-code-block');
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  it('在无浏览器 DOM 环境下也不会直接返回不可信 HTML', () => {
    const html = renderCourseContent('<p onclick="alert(1)">教程</p><script>alert(2)</script>');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('<p onclick=');
    expect(html).toContain('&lt;p onclick=');
  });

  it('仅允许 HTTP/HTTPS 课程资源地址', () => {
    expect(resolveCourseResourceUrl('/downloads/demo.zip', 'https://aibak.site')).toBe('https://aibak.site/downloads/demo.zip');
    expect(resolveCourseResourceUrl('https://cdn.example.com/demo.pdf')).toBe('https://cdn.example.com/demo.pdf');
    expect(resolveCourseResourceUrl('javascript:alert(1)')).toBeNull();
    expect(resolveCourseResourceUrl('data:text/html,test')).toBeNull();
  });

  it('覆盖课程资源的真实类型标签', () => {
    expect(getCourseResourceLabel('pdf')).toBe('PDF');
    expect(getCourseResourceLabel('file')).toBe('文件');
    expect(getCourseResourceLabel('code')).toBe('代码');
  });
});
