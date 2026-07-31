import { describe, expect, it } from 'vitest';
import {
  buildProjectGradeImportPath,
  normalizeImportedProjectUrl,
  parseProjectGradeImport,
} from './project-import';

describe('ProjectGrade public scan import contract', () => {
  it('carries only a stable HTTP(S) URL into the authenticated workspace', () => {
    const path = buildProjectGradeImportPath('https://www.example.com/app?token=secret#section');
    const parsed = parseProjectGradeImport(path.slice(path.indexOf('?')));

    expect(parsed).toEqual({
      projectName: 'example.com 网址体检',
      projectType: 'website',
      projectUrl: 'https://www.example.com/app',
      description: '从 AIbak 智评通免费公开网址体检导入；项目创建后由服务端重新扫描并保存历史。',
    });
    expect(path).not.toContain('secret');
  });

  it('rejects external schemes, credentials, and forged import sources', () => {
    expect(normalizeImportedProjectUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeImportedProjectUrl('https://user:pass@example.com')).toBeNull();
    expect(parseProjectGradeImport('?source=other&importUrl=https%3A%2F%2Fexample.com')).toBeNull();
  });

  it('falls back to the workspace when the public result URL is invalid', () => {
    expect(buildProjectGradeImportPath('//evil.example')).toBe('/project-grade/projects');
    expect(buildProjectGradeImportPath('')).toBe('/project-grade/projects');
  });
});
