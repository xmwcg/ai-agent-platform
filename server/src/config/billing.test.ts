import { planSatisfies, PLANS, planRank, getPlan, QuotaResource, PER_USE_COST, BYOK_PREFERRED_RESOURCES, PLAN_AI_BUDGET_FEN, COST_WARN_RATIO, PayPerUseResource, PlanId } from './billing';

describe('billing plan logic', () => {
  it('planRank orders free < pro < max < team', () => {
    expect(planRank('free')).toBeLessThan(planRank('pro'));
    expect(planRank('pro')).toBeLessThan(planRank('max'));
    expect(planRank('max')).toBeLessThan(planRank('team'));
  });

  it('planRank returns -1 for invalid planId', () => {
    expect(planRank('invalid' as PlanId)).toBe(-1);
    expect(planRank('' as PlanId)).toBe(-1);
  });

  it('planSatisfies compares tiers correctly', () => {
    expect(planSatisfies('max', 'pro')).toBe(true);
    expect(planSatisfies('team', 'pro')).toBe(true);
    expect(planSatisfies('pro', 'pro')).toBe(true);
    expect(planSatisfies('free', 'pro')).toBe(false);
    expect(planSatisfies('free', 'free')).toBe(true);
  });

  it('planSatisfies handles invalid planIds gracefully', () => {
    expect(planSatisfies('free', 'invalid' as PlanId)).toBe(true);  // free rank 0 >= -1
    expect(planSatisfies('invalid' as PlanId, 'pro')).toBe(false);   // -1 < 1
  });

  it('getPlan returns plan by id', () => {
    expect(getPlan('free').name).toBe('免费版');
    expect(getPlan('max').name).toBe('旗舰版');
  });

  it('plans define daily quota limits', () => {
    expect(getPlan('free').limits.ai_chat).toBeGreaterThan(0);
    expect(getPlan('max').limits.ai_chat).toBe(-1); // unlimited
    expect(getPlan('team').limits.ai_chat).toBe(-1); // unlimited
    expect(Object.keys(PLANS)).toEqual(['free', 'pro', 'max', 'team']);
  });

  it('every plan defines the full quota resource set', () => {
    const expected: QuotaResource[] = [
      'ai_chat',
      'rag_query',
      'rag_upload',
      'knowledge_create',
      'mcp_create',
      'mcp_call',
      'learning_path',
      'code_explain',
      'translate',
      'file_convert',
      'plan_generate',
      'media_gen',
      'cs_query',
      'model_config',
    ];
    for (const id of ['free', 'pro', 'max', 'team'] as ReadonlyArray<PlanId>) {
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

  it('pro plan is highlighted (recommended)', () => {
    expect(getPlan('pro').highlighted).toBe(true);
    expect(getPlan('free').highlighted).toBeUndefined();
    expect(getPlan('max').highlighted).toBeUndefined();
  });

  it('team plan has multiple seats', () => {
    expect(getPlan('team').seats).toBe(20);
    expect(getPlan('pro').seats).toBeUndefined();
  });
});

describe('PER_USE_COST · 按次积分成本', () => {
  it('all pay-per-use resources have positive cost in cents', () => {
    const resources: PayPerUseResource[] = ['media_image', 'media_video', 'media_image2video', 'api_chat'];
    for (const res of resources) {
      expect(PER_USE_COST[res]).toBeGreaterThan(0);
    }
  });

  it('media_video matches media_image2video cost (both ¥2)', () => {
    expect(PER_USE_COST.media_video).toBe(200);
    expect(PER_USE_COST.media_video).toBe(PER_USE_COST.media_image2video);
  });

  it('media_image costs ¥0.2 (cheapest media)', () => {
    expect(PER_USE_COST.media_image).toBe(20);
  });
});

describe('BYOK_PREFERRED_RESOURCES · 优先走自带 Key', () => {
  it('heavy resources prefer BYOK (video/image2video/api_chat)', () => {
    // 方案B：旗舰/企业版下这些资源优先走用户自带Key，平台零边际成本
    expect(BYOK_PREFERRED_RESOURCES).toContain('media_video');
    expect(BYOK_PREFERRED_RESOURCES).toContain('media_image2video');
    expect(BYOK_PREFERRED_RESOURCES).toContain('api_chat');
  });

  it('media_image is NOT in BYOK list (cheap enough to absorb)', () => {
    expect(BYOK_PREFERRED_RESOURCES).not.toContain('media_image');
  });
});

describe('PLAN_AI_BUDGET_FEN · 日 AI 成本预算', () => {
  it('free plan has lowest budget (50 fen = ¥0.5/day)', () => {
    expect(PLAN_AI_BUDGET_FEN.free).toBe(50);
  });

  it('pro plan has medium budget (500 fen = ¥5/day)', () => {
    expect(PLAN_AI_BUDGET_FEN.pro).toBe(500);
  });

  it('max and team plans have unlimited budget (-1)', () => {
    expect(PLAN_AI_BUDGET_FEN.max).toBe(-1);
    expect(PLAN_AI_BUDGET_FEN.team).toBe(-1);
  });

  it('all 4 plans have a budget entry', () => {
    const expected: PlanId[] = ['free', 'pro', 'max', 'team'];
    for (const id of expected) {
      expect(typeof PLAN_AI_BUDGET_FEN[id]).toBe('number');
    }
  });
});

describe('COST_WARN_RATIO · 成本预警阈值', () => {
  it('warns at 70% of budget', () => {
    expect(COST_WARN_RATIO).toBe(0.7);
    expect(COST_WARN_RATIO).toBeGreaterThan(0.5);
    expect(COST_WARN_RATIO).toBeLessThan(1);
  });
});
