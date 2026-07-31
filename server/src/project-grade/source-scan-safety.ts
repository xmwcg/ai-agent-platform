import path from 'path';

export const PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH = 1000;

export function normalizeProjectGradeSourceRelativePath(value: unknown): string | null {
  if (typeof value !== 'string' || !value || value !== value.trim()) return null;
  if (value.length > PROJECT_GRADE_SOURCE_PATH_MAX_LENGTH || value.includes('\0')) return null;

  const portablePath = value.replace(/\\/g, '/');
  const segments = portablePath.split('/');
  if (
    path.win32.isAbsolute(value) ||
    path.posix.isAbsolute(portablePath) ||
    /^[A-Za-z]:/.test(value) ||
    segments.some((segment) => !segment || segment === '.' || segment === '..')
  ) {
    return null;
  }

  return portablePath;
}
