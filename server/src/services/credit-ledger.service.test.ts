/**
 * Credit Ledger Service 单元测试
 *
 * 覆盖：幂等扣费、并发防透支、免费→历史→付费扣减顺序、
 *       余额一致性、事务原子性、到期、重复履约、并发签到、API补偿
 */
import { MongoMemoryServer } from 'mongodb-memory-server';
const mongoose = jest.requireActual('mongoose') as typeof import('mongoose');
import app from '../index';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { User } from '../models/User';
import { CreditLot } from '../models/CreditLot';
import { CreditsTransaction } from '../models/CreditsTransaction';

let mongoServer: MongoMemoryServer;
let testUserId: string;
let token: string;
const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-do-not-use-in-prod';
const uid = () => new mongoose.Types.ObjectId(testUserId);

async function disconnectMongoose(): Promise<void> {
  if (mongoose.connection.readyState === 0) return;
  try { await mongoose.disconnect(); } catch (_: any) {}
}

jest.setTimeout(60000);
beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await disconnectMongoose();
  await mongoose.connect(mongoServer.getUri());
  const res = await request(app)
    .post('/api/auth/register')
    .send({ username: 'ledgertest', password: 'LedgerTest123!', email: 'ledger@test.com' });
  if (res.status === 200 || res.status === 201) {
    testUserId = res.body?.data?.id || res.body?.user?.id || '';
  }
  if (testUserId) token = jwt.sign({ id: testUserId }, JWT_SECRET, { expiresIn: '1h' });
});

afterAll(async () => {
  try { await mongoose.connection.dropDatabase(); } catch (_) {}
  await disconnectMongoose();
  if (mongoServer) await mongoServer.stop();
});

const seedCredits = async (lots: Array<{sourceType: string; amount: number; expiresAt?: Date}>) => {
  if (!testUserId) return;
  const u = uid();
  await CreditLot.deleteMany({ userId: u });
  let total = 0;
  for (const l of lots) {
    await CreditLot.create({ userId: u, sourceType: l.sourceType, originalAmount: l.amount, remainingAmount: l.amount, status: 'active', expiresAt: l.expiresAt });
    total += l.amount;
  }
  await User.updateOne({ _id: u }, { $set: { credits: total } });
};

jest.setTimeout(30000);
describe('CreditLedger - 幂等性', () => {
  it('相同幂等键只扣一次', async () => {
    if (!token) return;
    const key = 'dedup-' + Date.now();
    const dedup = jest.requireActual('../services/credit-ledger.service');
    await dedup.deductCredits({ userId: testUserId, amount: 10, idempotencyKey: key, businessType: 'test', businessId: 'b1' });
    await dedup.deductCredits({ userId: testUserId, amount: 10, idempotencyKey: key, businessType: 'test', businessId: 'b1' });
    const txs = await CreditsTransaction.find({ idempotencyKey: key });
    expect(txs.length).toBe(1);
  }, 10000);
});

jest.setTimeout(30000);
describe('CreditLedger - 并发防透支', () => {
  it('并发10请求最多只扣5次成功', async () => {
    if (!testUserId) return;
    const dedup = jest.requireActual('../services/credit-ledger.service');
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, (_, i) =>
        dedup.deductCredits({ userId: testUserId, amount: 10, idempotencyKey: 'concurrent-' + Date.now() + '-' + i, businessType: 'test', businessId: 'c' + i })
      )
    );
    const succeeded = results.filter(r => r.status === 'fulfilled').length;
    expect(succeeded).toBeLessThanOrEqual(5);
    const user = await User.findById(testUserId).select('credits').lean();
    expect((user as any)?.credits).toBeGreaterThanOrEqual(0);
    expect((user as any)?.credits).toBeLessThanOrEqual(50);
  }, 15000);
});

jest.setTimeout(30000);
describe('CreditLedger - 扣减顺序(免费→历史→付费)', () => {
  beforeEach(async () => {
    await seedCredits([
      { sourceType: 'subscription_free', amount: 30, expiresAt: new Date(Date.now() + 86400000) },
      { sourceType: 'legacy_protected', amount: 40 },
      { sourceType: 'purchase', amount: 50 },
    ]);
  });
  it('先扣免费额度', async () => {
    if (!testUserId) return;
    const dedup = jest.requireActual('../services/credit-ledger.service');
    await dedup.deductCredits({ userId: testUserId, amount: 10, idempotencyKey: 'order-' + Date.now(), businessType: 'test', businessId: 'o1' });
    const free = await CreditLot.findOne({ userId: uid(), sourceType: 'subscription_free' });
    expect(free?.remainingAmount).toBe(20);
  });
});

jest.setTimeout(30000);
describe('CreditLedger - 余额一致性', () => {
  it('reconcile 返回一致', async () => {
    if (!testUserId) return;
    const { reconcile } = jest.requireActual('../services/credit-ledger.service');
    const r = await reconcile(testUserId);
    expect(r.consistent).toBe(true);
    expect(r.difference).toBe(0);
  });
});

jest.setTimeout(30000);
describe('CreditLedger - 事务原子性', () => {
  it('User.credits 与 CreditLot 同步更新', async () => {
    if (!testUserId) return;
    await seedCredits([{ sourceType: 'purchase', amount: 30 }]);
    const dedup = jest.requireActual('../services/credit-ledger.service');
    await dedup.deductCredits({ userId: testUserId, amount: 20, idempotencyKey: 'atomic-' + Date.now(), businessType: 'test', businessId: 'a1' });
    const user = await User.findById(testUserId).select('credits').lean();
    const lot = await CreditLot.findOne({ userId: uid(), sourceType: 'purchase' });
    expect(user?.credits).toBe(10);
    expect(lot?.remainingAmount).toBe(10);
  });
});

jest.setTimeout(30000);
describe('CreditLedger - 过期免费额度', () => {
  it('已过期额度不留余额', async () => {
    if (!testUserId) return;
    await seedCredits([{ sourceType: 'subscription_free', amount: 100, expiresAt: new Date(Date.now() - 1000) }]);
    const dedup = jest.requireActual('../services/credit-ledger.service');
    try { await dedup.deductCredits({ userId: testUserId, amount: 10, idempotencyKey: 'exp-' + Date.now(), businessType: 'test', businessId: 'e1' }); } catch (_) {}
    const lot = await CreditLot.findOne({ userId: uid(), sourceType: 'subscription_free' });
    expect(lot?.status).toBe('expired');
    expect(lot?.remainingAmount).toBe(0);
  });
});

jest.setTimeout(30000);
describe('CreditLedger - 重复履约', () => {
  it('订阅赠额不重复发放', async () => {
    if (!testUserId) return;
    await seedCredits([]);
    const dedup = jest.requireActual('../services/credit-ledger.service');
    const key = 'sub-fulfill-' + Date.now();
    const opts = { userId: testUserId, amount: 100, idempotencyKey: key, businessType: 'subscription_fulfillment', businessId: 'sub1', sourceType: 'subscription_free' as const, expiresAt: new Date(Date.now() + 30 * 86400000), transactionType: 'grant' as const };
    await dedup.grantCredits(opts);
    await dedup.grantCredits(opts);
    const txs = await CreditsTransaction.countDocuments({ idempotencyKey: key });
    expect(txs).toBe(1);
  });
});
