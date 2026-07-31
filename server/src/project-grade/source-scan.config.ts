import type { ProjectGradeSourceScanLimits } from './source-scan.types';

export const PROJECT_GRADE_SOURCE_SCAN_VERSION = 'authorized-source-snapshot/0.1.0';

export const PROJECT_GRADE_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

export const PROJECT_GRADE_SOURCE_IGNORED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'vendor',
]);

export const DEFAULT_PROJECT_GRADE_SOURCE_SCAN_LIMITS: ProjectGradeSourceScanLimits = {
  maxFiles: 5_000,
  maxFileBytes: 1024 * 1024,
  maxTotalBytes: 25 * 1024 * 1024,
  timeoutMs: 10_000,
};

export function mergeProjectGradeSourceScanLimits(
  overrides: Partial<ProjectGradeSourceScanLimits> = {}
): ProjectGradeSourceScanLimits {
  const merged = { ...DEFAULT_PROJECT_GRADE_SOURCE_SCAN_LIMITS, ...overrides };
  for (const [key, value] of Object.entries(merged)) {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new Error(`Invalid ProjectGrade source scan limit: ${key}`);
    }
  }
  return merged;
}
