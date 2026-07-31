export const PROJECT_GRADE_PUBLIC_IMPORT_SOURCE = 'public-url-scan';

export interface ImportedProjectDraft {
  projectName: string;
  projectType: 'website';
  projectUrl: string;
  description: string;
}

/**
 * Public scan URLs may contain fragments, tracking parameters, or credentials.
 * Only a stable HTTP(S) location is allowed to cross the anonymous -> account boundary.
 * The authenticated server will validate and scan the registered URL again.
 */
export function normalizeImportedProjectUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const input = value.trim();
  if (!input || input.length > 2048) return null;

  try {
    const parsed = new URL(input);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (parsed.username || parsed.password) return null;

    parsed.hash = '';
    parsed.search = '';
    const normalized = parsed.toString();
    return normalized.length <= 2048 ? normalized : null;
  } catch {
    return null;
  }
}

function projectNameFromUrl(projectUrl: string): string {
  const hostname = new URL(projectUrl).hostname.replace(/^www\./i, '');
  return `${hostname || '网站'} 网址体检`.slice(0, 120);
}

export function buildProjectGradeImportPath(value: unknown): string {
  const projectUrl = normalizeImportedProjectUrl(value);
  if (!projectUrl) return '/project-grade/projects';

  const search = new URLSearchParams({
    source: PROJECT_GRADE_PUBLIC_IMPORT_SOURCE,
    importUrl: projectUrl,
  });
  return `/project-grade/projects?${search.toString()}`;
}

export function parseProjectGradeImport(search: string): ImportedProjectDraft | null {
  const params = new URLSearchParams(search);
  if (params.get('source') !== PROJECT_GRADE_PUBLIC_IMPORT_SOURCE) return null;

  const projectUrl = normalizeImportedProjectUrl(params.get('importUrl'));
  if (!projectUrl) return null;

  return {
    projectName: projectNameFromUrl(projectUrl),
    projectType: 'website',
    projectUrl,
    description: '从 AIbak 智评通免费公开网址体检导入；项目创建后由服务端重新扫描并保存历史。',
  };
}
