import { describe, expect, it } from 'vitest';

import { NAVIGATION_GROUPS, SITE_FEATURES, featureByPath } from './site-features';

describe('ProjectGrade feature registration', () => {
  it('keeps the internal-baseline workspace discoverable without advertising external scanning', () => {
    const projectGrade = SITE_FEATURES.find((feature) => feature.id === 'project-grade');
    const toolsGroup = NAVIGATION_GROUPS.find((group) => group.key === 'tools');

    expect(projectGrade).toMatchObject({
      title: 'AIbak 智评通',
      path: '/project-grade',
      group: '工具与分析',
      authRequired: false,
      icon: 'chart',
    });
    expect(projectGrade?.description).toContain('AIbak 内部基线');
    expect(projectGrade?.description).not.toMatch(/外部|URL|Git|CI|生产环境/);
    expect(toolsGroup?.featureIds).toContain('project-grade');
    expect(featureByPath('/project-grade/projects/project-1')).toBe(projectGrade);
  });
});
