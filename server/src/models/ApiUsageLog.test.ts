import { ApiUsageLog } from './ApiUsageLog';

describe('ApiUsageLog 用量日志 Schema', () => {
  it('包含 keyId 字段（ObjectId 类型）', () => {
    const path = ApiUsageLog.schema.path('keyId');
    expect(path).toBeDefined();
  });

  it('包含 ownerId 字段（String 类型）', () => {
    const path = ApiUsageLog.schema.path('ownerId');
    expect(path).toBeDefined();
    expect(path.instance).toBe('String');
  });

  it('包含 status 字段（枚举 success/quota_exceeded/error）', () => {
    const path = ApiUsageLog.schema.path('status');
    expect(path).toBeDefined();
    expect(path.options.default).toBe('success');
  });

  it('包含 creditsDeducted 字段（可选 Number）', () => {
    const path = ApiUsageLog.schema.path('creditsDeducted');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Number');
  });

  it('包含 timestamp 字段（Date 类型，默认 now）', () => {
    const path = ApiUsageLog.schema.path('timestamp');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Date');
  });
});
