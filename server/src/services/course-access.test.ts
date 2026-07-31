import {
  canAccessCourseChapter,
  getCourseAccess,
  normalizeCoursePreviewCount,
  normalizeCourseRequiredPlan,
} from './course-access';

describe('课程权益判定', () => {
  it('付费课程未显式配置套餐时默认要求专业版', () => {
    expect(normalizeCourseRequiredPlan({ price: 2990, requiredPlan: 'free' })).toBe('pro');
  });

  it('免费课程对免费用户开放全文', () => {
    expect(getCourseAccess({ price: 0, requiredPlan: 'max' }, 'free')).toMatchObject({
      level: 'full',
      hasFullAccess: true,
      currentPlan: 'free',
    });
  });

  it('付费课程仅开放配置数量的试看章节', () => {
    const course = { price: 2990, requiredPlan: 'pro' as const, freePreviewChapters: 2, chapters: [{}, {}, {}] };
    expect(getCourseAccess(course, 'free')).toMatchObject({ level: 'preview', freePreviewChapters: 2 });
    expect(canAccessCourseChapter(course, 'free', 0)).toBe(true);
    expect(canAccessCourseChapter(course, 'free', 1)).toBe(true);
    expect(canAccessCourseChapter(course, 'free', 2)).toBe(false);
    expect(canAccessCourseChapter(course, 'pro', 2)).toBe(true);
  });

  it('试看章节数会归一化并限制在课程章节总数内', () => {
    expect(normalizeCoursePreviewCount({ freePreviewChapters: -3, chapters: [{}, {}] })).toBe(0);
    expect(normalizeCoursePreviewCount({ freePreviewChapters: 20, chapters: [{}, {}] })).toBe(2);
  });
});
