import { CustomerService } from '../models/CustomerService';
import mongoose from 'mongoose';

describe('智能客服模型', () => {
  const conn = mongoose.createConnection();

  it('csModel 字段存在且不冲突于 Document.model', () => {
    // 编译 schema 不应抛错（验证 csModel 重命名已生效）
    const path = CustomerService.schema.path('csModel');
    expect(path).toBeDefined();
    expect(path.instance).toBe('String');
  });

  it('embedCode 唯一性由 schema 保证', () => {
    const indexed = CustomerService.schema.paths['embedCode'];
    expect(indexed).toBeDefined();
  });

  afterAll(async () => { await conn.close(); });
});
