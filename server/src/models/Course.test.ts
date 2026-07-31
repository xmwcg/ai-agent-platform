import { Course } from './Course';

describe('Course 课程权益 Schema', () => {
  it('将发布状态、免费试看章节数和所需套餐定义为三个顶层字段', () => {
    const published = Course.schema.path('isPublished');
    const preview = Course.schema.path('freePreviewChapters');
    const requiredPlan = Course.schema.path('requiredPlan');

    expect(published).toBeDefined();
    expect(published.instance).toBe('Boolean');
    expect(published.options.default).toBe(false);

    expect(preview).toBeDefined();
    expect(preview.instance).toBe('Number');
    expect(preview.options.default).toBe(2);
    expect(preview.options.min).toBe(0);

    expect(requiredPlan).toBeDefined();
    expect(requiredPlan.instance).toBe('String');
    expect(requiredPlan.options.enum).toEqual(['free', 'pro', 'max']);
    expect(requiredPlan.options.default).toBe('free');
  });

  it('不再保留错误的 isPublished 子字段定义', () => {
    expect(Course.schema.path('isPublished.freePreviewChapters')).toBeUndefined();
    expect(Course.schema.path('isPublished.requiredPlan')).toBeUndefined();
  });

  it('允许显式配置 0 个免费试看章节', () => {
    const course = new Course({
      title: '付费课程',
      description: '仅登录付费用户可访问',
      instructor: 'owner-1',
      category: '商业化',
      freePreviewChapters: 0,
      requiredPlan: 'pro',
    });

    expect(course.freePreviewChapters).toBe(0);
    expect(course.requiredPlan).toBe('pro');
    expect(course.isPublished).toBe(false);
  });
});
