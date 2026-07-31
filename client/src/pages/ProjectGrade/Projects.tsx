/**
 * ProjectGrade 工作台入口。
 * 公开免费体检只把经过清洗的 URL 带到这里；项目创建后由鉴权服务端重新扫描，
 * 不信任也不持久化匿名页面提交的评分或证据。
 */
import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ProjectGradePage from '@/pages/ProjectGradePage';
import { parseProjectGradeImport } from './project-import';

export default function ProjectGradeProjects() {
  const location = useLocation();
  const navigate = useNavigate();
  const importedDraft = useMemo(() => parseProjectGradeImport(location.search), [location.search]);
  const consumeImportedDraft = useCallback(() => {
    navigate('/project-grade/projects', { replace: true });
  }, [navigate]);

  return (
    <ProjectGradePage
      initialProjectDraft={importedDraft || undefined}
      onImportedDraftConsumed={consumeImportedDraft}
    />
  );
}
