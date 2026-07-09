import { ApiKey } from './ApiKey';

describe('ApiKey 密钥 Schema', () => {
  it('包含 creditsEnabled 字段（Boolean，默认 false）', () => {
    const path = ApiKey.schema.path('creditsEnabled');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Boolean');
    expect(path.options.default).toBe(false);
  });

  it('包含 quotaDaily 字段（Number，默认 1000）', () => {
    const path = ApiKey.schema.path('quotaDaily');
    expect(path.options.default).toBe(1000);
  });

  it('prefix 和 keyHash 均为必填 String', () => {
    expect(ApiKey.schema.path('prefix').instance).toBe('String');
    expect(ApiKey.schema.path('keyHash').options.unique).toBe(true);
  });
});
