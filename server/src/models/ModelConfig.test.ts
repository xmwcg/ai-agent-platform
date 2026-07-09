import { ModelConfig } from './ModelConfig';

describe('ModelConfig 模型配置 Schema', () => {
  it('包含 pinned 字段（Boolean，默认 false），用于运营置顶自定义模型', () => {
    const path = ModelConfig.schema.path('pinned');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Boolean');
    expect(path.options.default).toBe(false);
  });

  it('isDefault 字段默认为 false', () => {
    const path = ModelConfig.schema.path('isDefault');
    expect(path.options.default).toBe(false);
  });

  it('enabled 字段默认为 true', () => {
    const path = ModelConfig.schema.path('enabled');
    expect(path.options.default).toBe(true);
  });

  it('models 字段为字符串数组', () => {
    const path = ModelConfig.schema.path('models');
    expect(path).toBeDefined();
    expect(path.instance).toBe('Array');
  });
});
