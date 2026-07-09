import { validateObject, validate, isEmail, isObjectId, isNonEmptyString, isStringArray, ValidationSchema } from './validation';
import { Request, Response, NextFunction } from 'express';

describe('validation utils', () => {
  it('isNonEmptyString 正确判定', () => {
    expect(isNonEmptyString('ok')).toBe(true);
    expect(isNonEmptyString('  ')).toBe(false);
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString(123)).toBe(false);
  });

  it('isStringArray 正确判定', () => {
    expect(isStringArray(['a', 'b'])).toBe(true);
    expect(isStringArray(['a', 1])).toBe(false);
    expect(isStringArray('a')).toBe(false);
  });

  it('isEmail 正确判定', () => {
    expect(isEmail('a@b.com')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('ab.com')).toBe(false);
  });

  it('isObjectId 正确判定', () => {
    expect(isObjectId('507f1f77bcf86cd799439011')).toBe(true);
    expect(isObjectId('xyz')).toBe(false);
    expect(isObjectId('507f1f77bcf86cd79943901')).toBe(false);
  });
});

describe('validateObject', () => {
  const schema: ValidationSchema = {
    email: { required: true, type: 'string', isEmail: true },
    password: { required: true, type: 'string', minLength: 6, maxLength: 64 },
    name: { required: true, type: 'string', minLength: 1, maxLength: 50 },
    tags: { type: 'stringArray' },
    plan: { type: 'string', oneOf: ['free', 'pro'] },
    teamId: { type: 'string', isObjectId: true },
  };

  it('全部合法通过', () => {
    const r = validateObject(
      { email: 'a@b.com', password: 'secret1', name: 'Tom', tags: ['x'], plan: 'pro', teamId: '507f1f77bcf86cd799439011' },
      schema
    );
    expect(r.valid).toBe(true);
    expect(r.errors).toHaveLength(0);
  });

  it('缺失必填返回错误', () => {
    const r = validateObject({}, schema);
    expect(r.valid).toBe(false);
    expect(r.errors).toContain('email 为必填项');
    expect(r.errors).toContain('password 为必填项');
  });

  it('email 格式错误', () => {
    const r = validateObject({ email: 'bad', password: 'secret1', name: 'Tom' }, schema);
    expect(r.errors).toContain('email 邮箱格式不正确');
  });

  it('password 长度不足', () => {
    const r = validateObject({ email: 'a@b.com', password: '123', name: 'Tom' }, schema);
    expect(r.errors).toContain('password 长度至少 6 个字符');
  });

  it('oneOf 约束', () => {
    const r = validateObject({ email: 'a@b.com', password: 'secret1', name: 'Tom', plan: 'vip' }, schema);
    expect(r.errors).toContain('plan 只能取 free / pro 之一');
  });

  it('objectId 约束', () => {
    const r = validateObject({ email: 'a@b.com', password: 'secret1', name: 'Tom', teamId: 'bad' }, schema);
    expect(r.errors).toContain('teamId 不是合法的 ID');
  });

  it('可选字段缺省不报错', () => {
    const r = validateObject({ email: 'a@b.com', password: 'secret1', name: 'Tom' }, schema);
    expect(r.valid).toBe(true);
  });
});

describe('validate middleware', () => {
  const schema: ValidationSchema = { email: { required: true, type: 'string', isEmail: true } };

  function makeRes(): any {
    return { statusCode: 0, body: undefined, status(c: number) { this.statusCode = c; return this; }, json(b: any) { this.body = b; return this; } };
  }

  it('校验失败返回 400 并带错误码', () => {
    const req = { body: { email: 'bad' } } as Request;
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    validate(schema)(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe('VALIDATION_ERROR');
    expect(next).not.toHaveBeenCalled();
  });

  it('校验通过调用 next', () => {
    const req = { body: { email: 'a@b.com' } } as Request;
    const res = makeRes();
    const next = jest.fn() as unknown as NextFunction;
    validate(schema)(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
