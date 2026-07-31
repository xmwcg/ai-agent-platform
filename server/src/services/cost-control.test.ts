/**
 * cost-control.service 单元测试
 * 覆盖：成本估算、计量累计、预警阀门（ok/warn/block）、无限预算放行
 * 注：测试环境下 redisClient 为 MemoryRedis 真实实例（自带内存 Map），可直接存取。
 */
import { redisClient } from '../config/database';
import {
  recordAiCost,
  getDailyCost,
  checkCostValve,
  estimateCostFen,
} from './cost-control.service';

beforeEach(async () => {
  // 清空 redis 存储，避免用例间串扰
  const keys = redisClient.keys ? redisClient.keys('*') : [];
  for (const k of keys) await redisClient.del(k);
});

describe('estimateCostFen', () => {
  it('输入1M/输出1M token ≈ ¥3 = 300 分', () => {
    expect(estimateCostFen(1_000_000, 1_000_000)).toBeCloseTo(300, 5);
  });
  it('零用量返回 0', () => {
    expect(estimateCostFen(0, 0)).toBe(0);
  });
});

describe('recordAiCost / getDailyCost', () => {
  it('累计用量写入并通过 getDailyCost 读回', async () => {
    const total = await recordAiCost('u1', 25);
    expect(total).toBe(25);
    expect(await getDailyCost('u1')).toBe(25);
  });
});

describe('checkCostValve', () => {
  it('免费版预算50分：用量40分(>=70%) → warn，仍允许', async () => {
    await recordAiCost('u1', 40);
    const r = await checkCostValve('u1', 'free');
    expect(r.level).toBe('warn');
    expect(r.allowed).toBe(true);
    expect(r.usedFen).toBe(40);
    expect(r.budgetFen).toBe(50);
  });

  it('免费版预算50分：用量60分(>=100%) → block，禁止', async () => {
    await recordAiCost('u1', 60);
    const r = await checkCostValve('u1', 'free');
    expect(r.level).toBe('block');
    expect(r.allowed).toBe(false);
  });

  it('旗舰版预算-1（无限）→ 始终允许', async () => {
    await recordAiCost('u1', 999999);
    const r = await checkCostValve('u1', 'max');
    expect(r.allowed).toBe(true);
    expect(r.level).toBe('ok');
  });
});
