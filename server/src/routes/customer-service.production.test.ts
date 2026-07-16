import { isCustomerServiceMockModeEnabled } from './customer-service';

describe('智能客服生产安全门禁', () => {
  const OLD_ENV = process.env;

  afterEach(() => {
    process.env = OLD_ENV;
  });

  it('生产环境即使误配 ENABLE_MOCK_MODE=true 也不会进入 Mock 分支', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'production',
      ENABLE_MOCK_MODE: 'true',
    };

    expect(isCustomerServiceMockModeEnabled()).toBe(false);
  });

  it('Mock 仅允许开发测试环境显式启用', () => {
    process.env = {
      ...OLD_ENV,
      NODE_ENV: 'test',
      ENABLE_MOCK_MODE: 'true',
    };

    expect(isCustomerServiceMockModeEnabled()).toBe(true);
  });
});
