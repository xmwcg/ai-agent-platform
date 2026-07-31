import { Course } from './Course';

describe('Course Schema', () => {
  it('将试看章节和套餐要求定义为课程顶层字段', () => {
    expect(Course.schema.path('sourceCourseId')).toBeDefined();
    expect(Course.schema.path('freePreviewChapters')).toBeDefined();
    expect(Course.schema.path('requiredPlan')).toBeDefined();
    expect(Course.schema.path('isPublished')).toBeDefined();
  });

  it('正确应用课程交付字段默认值', () => {
    const course = new Course({
      title: '课程交付测试',
      description: '验证课程门控字段',
      instructor: 'system',
      category: 'engineering',
      chapters: [],
    });

    expect(course.validateSync()).toBeUndefined();
    expect(course.freePreviewChapters).toBe(2);
    expect(course.requiredPlan).toBe('free');
    expect(course.isPublished).toBe(false);
  });
});
