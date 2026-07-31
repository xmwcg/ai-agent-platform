import {
  normalizeProjectGradeSourceRelativePath,
  PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH,
} from './source-scan-safety';

describe('ProjectGrade source scan persisted path boundary', () => {
  it.each([
    ['src/index.ts', 'src/index.ts'],
    ['src/routes/project-grade.ts', 'src/routes/project-grade.ts'],
    ['src\\routes\\project-grade.ts', 'src/routes/project-grade.ts'],
  ])('normalizes an authorized relative path %s', (input, expected) => {
    expect(normalizeProjectGradeSourceRelativePath(input)).toBe(expected);
  });

  it.each([
    ['empty string', ''],
    ['Windows absolute path', 'C:\\private\\secret.ts'],
    ['Windows drive-relative path', 'C:private\\secret.ts'],
    ['UNC path', '\\\\server\\share\\secret.ts'],
    ['Unix absolute path', '/private/secret.ts'],
    ['parent traversal', '../private/secret.ts'],
    ['embedded parent traversal', 'src/../private/secret.ts'],
    ['current-directory segment', './src/index.ts'],
    ['empty path segment', 'src//index.ts'],
    ['leading whitespace', ' src/index.ts'],
    ['trailing whitespace', 'src/index.ts '],
    ['NUL byte', 'src/secret\0.ts'],
    ['overlong path', 'a'.repeat(PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH + 1)],
  ])('rejects %s', (_label, input) => {
    expect(normalizeProjectGradeSourceRelativePath(input)).toBeNull();
  });

  it.each([undefined, null, 0, false, {}, []])('rejects non-string input %p', (input) => {
    expect(normalizeProjectGradeSourceRelativePath(input)).toBeNull();
  });
});
