import { planSatisfies, PLANS, planRank, getPlan, QuotaResource } from './billing';

describe('billing plan logic', () => {
  it('planRank orders free < pro < max < team', () => {
    expect(planRank('free')).toBeLessThan(planRank('pro'));
    expect(planRank('pro')).toBeLessThan(planRank('max'));
    expect(planRank('max')).toBeLessThan(planRank('team'));
  });

  it('planSatisfies compares tiers correctly', () => {
    expect(planSatisfies('max', 'pro')).toBe(true);
    expect(planSatisfies('team', 'pro')).toBe(true);
    expect(planSatisfies('pro', 'pro')).toBe(true);
    expect(planSatisfies('free', 'pro')).toBe(false);
    expect(planSatisfies('free', 'free')).toBe(true);
  });

  it('plans define daily quota limits', () => {
    expect(getPlan('free').limits.ai_chat).toBeGreaterThan(0);
    expect(getPlan('max').limits.ai_chat).toBe(-1); // unlimited
    expect(getPlan('team').limits.ai_chat).toBe(-1); // unlimited
    expect(Object.keys(PLANS)).toEqual(['free', 'pro', 'max', 'team']);
  });

  it('every plan defines the full quota resource set (incl. new resources)', () => {
    const expected: QuotaResource[] = [
      'ai_chat',
      'rag_query',
      'knowledge_create',
      'mcp_create',
      'learning_path',
      'code_explain',
    ];
    for (const id of ['free', 'pro', 'max', 'team'] as const) {
      const limits = getPlan(id).limits;
      for (const res of expected) {
        expect(limits).toHaveProperty(res);
      }
    }
  });

  it('amounts are stored in cents (no floating point)', () => {
    // 1/10 破局定价：专业版 ¥9.9 => 990 分
    expect(getPlan('pro').priceMonthly).toBe(990);
    expect(getPlan('max').priceMonthly).toBe(1990);
    expect(getPlan('team').priceMonthly).toBe(9900);
    expect(getPlan('max').priceYearly).toBe(19900);
  });
});
