import { buildCourseEntitlementMigrationPipeline } from './migrate-course-entitlements';

describe('课程权益兼容迁移', () => {
  it('使用聚合更新同时归一化三个顶层字段', () => {
    const pipeline = buildCourseEntitlementMigrationPipeline();
    expect(pipeline).toHaveLength(1);
    expect(pipeline[0]).toEqual(expect.objectContaining({
      $set: expect.objectContaining({
        isPublished: expect.any(Object),
        freePreviewChapters: expect.any(Object),
        requiredPlan: expect.any(Object),
      }),
    }));
  });

  it('迁移定义不包含删除字段或回写错误嵌套结构', () => {
    const serialized = JSON.stringify(buildCourseEntitlementMigrationPipeline());
    expect(serialized).not.toContain('$unset');
    expect(serialized).not.toContain('isPublished.freePreviewChapters":');
    expect(serialized).not.toContain('isPublished.requiredPlan":');
  });
});
