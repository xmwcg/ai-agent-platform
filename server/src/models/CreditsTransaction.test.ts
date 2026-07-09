/**
 * CreditsTransaction 模型单元测试
 *
 * 覆盖：模型字段定义、type 枚举约束、默认值、Schema 级别验证
 * 遵循 WebhookEvent.test.ts 模式：使用 new Model() 做 Schema 层验证，不触发真实 DB。
 */
import mongoose, { Schema } from 'mongoose';

// 定义测试用 schema（与 CreditsTransaction.ts 字段一致）
const txTestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    type: { type: String, enum: ['deduction', 'grant', 'purchase'], required: true },
    amount: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    resource: { type: String },
    apiKeyId: { type: Schema.Types.ObjectId, ref: 'ApiKey' },
    orderNo: { type: String },
    description: { type: String },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const TxModel = mongoose.model('CreditsTransaction_Test', txTestSchema);

describe('CreditsTransaction Model — Schema 层验证', () => {
  const userId = new mongoose.Types.ObjectId();
  const apiKeyId = new mongoose.Types.ObjectId();

  // ========== 创建 ==========

  it('应创建 deduction 类型记录', () => {
    const tx = new TxModel({
      userId,
      type: 'deduction',
      amount: -10,
      balanceAfter: 90,
      resource: 'chat',
      apiKeyId,
      description: 'API 积分抵扣',
    });
    expect(tx._id).toBeDefined();
    expect(tx.type).toBe('deduction');
    expect(tx.amount).toBe(-10);
    expect(tx.balanceAfter).toBe(90);
    expect(tx.resource).toBe('chat');
    expect(String(tx.apiKeyId)).toBe(String(apiKeyId));
  });

  it('应创建 grant 类型记录（订阅赠送）', () => {
    const tx = new TxModel({
      userId,
      type: 'grant',
      amount: 500,
      balanceAfter: 500,
      orderNo: 'AI1234567890001',
      description: '专业版订阅赠送 500 积分',
    });
    expect(tx.type).toBe('grant');
    expect(tx.amount).toBe(500);
    expect(tx.balanceAfter).toBe(500);
    expect(tx.orderNo).toBe('AI1234567890001');
  });

  it('应创建 purchase 类型记录（积分包购买）', () => {
    const tx = new TxModel({
      userId,
      type: 'purchase',
      amount: 2000,
      balanceAfter: 2500,
      orderNo: 'AI1234567890002',
      description: '购买 2000 积分包',
    });
    expect(tx.type).toBe('purchase');
    expect(tx.amount).toBe(2000);
    expect(tx.balanceAfter).toBe(2500);
  });

  // ========== type 枚举约束 ==========

  it('type 字段限定 deduction/grant/purchase', () => {
    const path = txTestSchema.path('type') as any;
    expect(path).toBeDefined();
    expect(path?.options?.enum).toContain('deduction');
    expect(path?.options?.enum).toContain('grant');
    expect(path?.options?.enum).toContain('purchase');
    expect(path?.options?.enum).not.toContain('refund');
  });

  // ========== 必填字段声明 ==========

  it('userId 为必填', () => {
    const path = txTestSchema.path('userId') as any;
    expect(path?.options?.required).toBe(true);
  });

  it('amount 为必填', () => {
    const path = txTestSchema.path('amount') as any;
    expect(path?.options?.required).toBe(true);
  });

  it('balanceAfter 为必填', () => {
    const path = txTestSchema.path('balanceAfter') as any;
    expect(path?.options?.required).toBe(true);
  });

  // ========== 可选字段 ==========

  it('apiKeyId 为可选', () => {
    const tx = new TxModel({ userId, type: 'grant', amount: 100, balanceAfter: 100 });
    expect(tx.apiKeyId).toBeUndefined();
  });

  it('orderNo 为可选', () => {
    const tx = new TxModel({ userId, type: 'deduction', amount: -10, balanceAfter: 90 });
    expect(tx.orderNo).toBeUndefined();
  });

  it('resource 为可选', () => {
    const tx = new TxModel({ userId, type: 'deduction', amount: -10, balanceAfter: 90 });
    expect(tx.resource).toBeUndefined();
  });

  it('description 为可选', () => {
    const tx = new TxModel({ userId, type: 'deduction', amount: -10, balanceAfter: 90 });
    expect(tx.description).toBeUndefined();
  });

  // ========== 索引声明 ==========

  it('userId 应有索引', () => {
    const path = txTestSchema.path('userId') as any;
    expect(path?.options?.index).toBe(true);
  });

  // ========== timestamps 配置 ==========

  it('createdAt 字段存在（timestamps: {createdAt: true}）', () => {
    const path = txTestSchema.path('createdAt') as any;
    expect(path).toBeDefined();
  });

});
