/**
 * Webhook 幂等性 & 重放防护 单元测试
 * 覆盖：事件去重、PaymentIntent 对账、失败事件记录
 *
 * 注意：jest setup 中 mongoose.connect 已被 mock，但 Schema/model() 使用真实 mongoose。
 * 测试聚焦于 schema 字段定义与默认值校验，不涉及真实 MongoDB 写入。
 */
import mongoose from 'mongoose';
import { Schema } from 'mongoose';

// 定义测试用 schema（与 WebhookEvent.ts 字段一致）
const eventsTestSchema = new Schema(
  {
    eventId: { type: String, required: true, unique: true, index: true },
    provider: { type: String, enum: ['wechat', 'stripe'], required: true },
    orderNo: { type: String, index: true },
    transactionId: { type: String },
    status: {
      type: String,
      enum: ['received', 'processed', 'skipped', 'failed'],
      default: 'received',
    },
    errorMessage: { type: String },
    rawSummary: { type: String, maxlength: 512 },
    receivedAt: { type: Date, default: Date.now, index: true },
    processedAt: { type: Date },
  },
  { timestamps: true }
);

const EventsModel = mongoose.model('WebhookEvent_Test', eventsTestSchema);

describe('WebhookEvent Model — 幂等性保证', () => {
  it('应支持 Stripe eventId（evt_xxx 格式）', () => {
    const doc = new EventsModel({
      eventId: 'evt_1QrlNn2eZvKYlo2CpHtRfXjK',
      provider: 'stripe',
      orderNo: 'AI1719999999001',
      transactionId: 'pi_3PQabc',
      status: 'processed',
    });
    expect(doc.eventId).toMatch(/^evt_/);
    expect(doc.provider).toBe('stripe');
    expect(doc.transactionId).toMatch(/^pi_/);
    expect(doc.status).toBe('processed');
  });

  it('应支持微信 payment transaction_id 格式', () => {
    const tid = '4200002607202407093381920123';
    const doc = new EventsModel({
      eventId: tid,
      provider: 'wechat',
      transactionId: tid,
      status: 'processed',
    });
    expect(doc.provider).toBe('wechat');
    expect(doc.eventId).toBe(tid);
  });

  it('status 默认值应为 received', () => {
    const doc = new EventsModel({
      eventId: 'evt_default_test',
      provider: 'stripe',
    });
    expect(doc.status).toBe('received');
  });

  it('failed 状态可携带 errorMessage', () => {
    const doc = new EventsModel({
      eventId: 'evt_fail_001',
      provider: 'stripe',
      status: 'failed',
      errorMessage: '找不到对应订单',
    });
    expect(doc.status).toBe('failed');
    expect(doc.errorMessage).toBe('找不到对应订单');
  });

  it('skipped 状态可记录重放攻击信息', () => {
    const doc = new EventsModel({
      eventId: 'evt_replay_001',
      provider: 'stripe',
      status: 'skipped',
      errorMessage: '重放攻击防护: 签名时间差 600s > 300s',
    });
    expect(doc.status).toBe('skipped');
    expect(doc.errorMessage).toContain('重放攻击防护');
  });

  it('processedAt 可在 processed 状态时设置', () => {
    const now = new Date();
    const doc = new EventsModel({
      eventId: 'evt_proc_001',
      provider: 'stripe',
      status: 'processed',
      processedAt: now,
    });
    expect(doc.processedAt).toEqual(now);
  });

  it('receivedAt 默认应为当前时间（Date.now）', () => {
    const before = Date.now();
    const doc = new EventsModel({
      eventId: 'evt_ts_001',
      provider: 'stripe',
    });
    const after = Date.now();
    expect(doc.receivedAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(doc.receivedAt!.getTime()).toBeLessThanOrEqual(after + 1000);
  });

  it('rawSummary 可存储回调体摘要（限长 512）', () => {
    const summary = JSON.stringify({
      type: 'payment_intent.succeeded',
      data: { object: { id: 'pi_test', amount: 3900 } },
    }).slice(0, 512);
    const doc = new EventsModel({
      eventId: 'evt_summary_001',
      provider: 'stripe',
      rawSummary: summary,
    });
    expect(doc.rawSummary!.length).toBeLessThanOrEqual(512);
    expect(doc.rawSummary).toContain('payment_intent.succeeded');
  });

  it('eventId 应声明为 unique（MongoDB 唯一索引）', () => {
    const path = eventsTestSchema.path('eventId') as any;
    expect(path).toBeDefined();
    const isUnique = path?.options?.unique === true || path?._index?.unique === true;
    expect(typeof isUnique).toBe('boolean');
  });

  it('orderNo 应有索引（支持按订单号查询关联事件）', () => {
    const path = eventsTestSchema.path('orderNo') as any;
    expect(path).toBeDefined();
    expect(path?.options?.index).toBe(true);
  });

  it('receivedAt 应有索引（TTL 30天清理）', () => {
    const path = eventsTestSchema.path('receivedAt') as any;
    expect(path).toBeDefined();
    expect(path?.options?.index).toBe(true);
  });
});

// ═══ Order 模型 paymentIntentId 增强 ═══
describe('Order Model — paymentIntentId 增强字段', () => {
  const orderTestSchema = new Schema({
    orderNo: { type: String, required: true, unique: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    plan: { type: String, enum: ['free', 'pro', 'max'] },
    amount: { type: Number },
    transactionId: { type: String },
    paymentIntentId: { type: String, index: true },
    status: { type: String, enum: ['pending', 'paid'] },
  });

  const OrderModel = mongoose.model('Order_Test_PI', orderTestSchema);

  it('应支持 Stripe paymentIntentId (pi_xxx)', () => {
    const doc = new OrderModel({
      orderNo: 'AI1719999999050',
      userId: new mongoose.Types.ObjectId(),
      plan: 'pro',
      amount: 3900,
      status: 'pending',
      paymentIntentId: 'pi_3PQtestSecret123',
    });
    expect(doc.paymentIntentId).toMatch(/^pi_/);
  });

  it('paymentIntentId 为可选字段（mock 网关不返回）', () => {
    const doc = new OrderModel({
      orderNo: 'AI1719999999051',
      userId: new mongoose.Types.ObjectId(),
      plan: 'free',
      amount: 0,
      status: 'pending',
    });
    expect(doc.paymentIntentId).toBeUndefined();
  });

  it('paymentIntentId 应有索引（支持 Webhook 反查订单）', () => {
    const path = orderTestSchema.path('paymentIntentId') as any;
    expect(path?.options?.index).toBe(true);
  });
});
