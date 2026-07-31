const mockDotenvConfig = jest.fn();

jest.mock('dotenv', () => ({
  __esModule: true,
  default: { config: mockDotenvConfig },
}));

import {
  createStaticProductionContractEnv,
  validateStaticProductionContract,
} from './validate-production-contract';

describe('CI production configuration contract', () => {
  it('does not load a production env file while importing the fixture validator', () => {
    expect(mockDotenvConfig).not.toHaveBeenCalled();
  });

  it('validates without real production credentials', () => {
    expect(() => validateStaticProductionContract()).not.toThrow();
  });

  it('uses non-routable placeholders and production-safe mode flags', () => {
    const env = createStaticProductionContractEnv();

    expect(env.NODE_ENV).toBe('production');
    expect(env.ENABLE_MOCK_MODE).toBe('false');
    expect(env.DEFAULT_PAY_PROVIDER).toBe('wechat');
    expect(env.SANDBOX_MODE).toBe('remote');
    expect(env.MONGODB_URI).toContain('.invalid');
    expect(env.REDIS_URL).toContain('.invalid');
    expect(env.SANDBOX_REMOTE_URL).toContain('.invalid');
    expect(env.PUBLIC_BASE_URL).toContain('.invalid');
    expect(env.DEEPSEEK_API_KEY).toContain('placeholder');
  });
});
