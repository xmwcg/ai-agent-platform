import {
  generateApiKey,
  hashKey,
  isWithinQuota,
  remainingQuota,
  applyUsage,
  resetQuotaIfNeeded,
  ApiKeyQuotaState,
} from './apikey.service';

function makeKey(over: Partial<ApiKeyQuotaState> = {}): ApiKeyQuotaState {
  return { quotaDaily: 3, usedToday: 0, lastReset: new Date(), ...over };
}

describe('API Key 生成与配额计量', () => {
  it('生成密钥前缀与哈希稳定可校验', () => {
    const { plain, prefix, hash } = generateApiKey();
    expect(plain.startsWith('rx_live_')).toBe(true);
    expect(prefix.length).toBeGreaterThan(8);
    expect(hashKey(plain)).toBe(hash);
    expect(hashKey(plain + 'x')).not.toBe(hash);
  });

  it('配额内允许、超配额拒绝', () => {
    const key = makeKey({ usedToday: 0 });
    expect(isWithinQuota(key)).toBe(true);
    const full = makeKey({ usedToday: 3 });
    expect(isWithinQuota(full)).toBe(false);
  });

  it('剩余额度计算正确', () => {
    expect(remainingQuota(makeKey({ usedToday: 1 }))).toBe(2);
    expect(remainingQuota(makeKey({ usedToday: 3 }))).toBe(0);
  });

  it('跨日自动重置用量', () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const key = makeKey({ usedToday: 3, lastReset: yesterday });
    expect(resetQuotaIfNeeded(key)).toBe(true);
    expect(key.usedToday).toBe(0);
  });

  it('当日不重置', () => {
    const key = makeKey({ usedToday: 2 });
    expect(resetQuotaIfNeeded(key)).toBe(false);
    expect(key.usedToday).toBe(2);
  });

  it('applyUsage 累加用量', () => {
    const key = makeKey();
    applyUsage(key, 2);
    expect(key.usedToday).toBe(2);
  });
});
