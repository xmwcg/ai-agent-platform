import { sendError, AppError } from './http-error';

function makeRes() {
  const res: any = {};
  res.statusCode = 0;
  res.body = undefined;
  res.status = (code: number) => {
    res.statusCode = code;
    return res;
  };
  res.json = (payload: any) => {
    res.body = payload;
    return res;
  };
  return res;
}

describe('http-error sendError', () => {
  const OLD_ENV = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = OLD_ENV;
  });

  it('AppError: 返回 safeMessage 与 code，不泄露内部 detail', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    const err = new AppError(400, '参数无效', 'BAD_PARAM', '内部:MongoDB连接失败 at /etc/secret');
    sendError(res, err);
    expect(res.statusCode).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error).toBe('参数无效');
    expect(res.body.code).toBe('BAD_PARAM');
    expect(res.body.error).not.toContain('MongoDB');
  });

  it('非 AppError 在 production 返回通用语，不透传 message', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    sendError(res, new Error('DB at mongodb://user:pass@host/secret crashed'));
    expect(res.statusCode).toBe(500);
    expect(res.body.error).toBe('服务器内部错误，请稍后重试');
    expect(res.body.error).not.toContain('mongodb://');
  });

  it('非 AppError 在 development 透传 message 便于排查', () => {
    process.env.NODE_ENV = 'development';
    const res = makeRes();
    sendError(res, new Error('具体报错信息'));
    expect(res.body.error).toBe('具体报错信息');
  });

  it('test 环境透传 message', () => {
    process.env.NODE_ENV = 'test';
    const res = makeRes();
    sendError(res, new Error('测试可见错误'));
    expect(res.body.error).toBe('测试可见错误');
  });

  it('非 Error 类型被安全包裹', () => {
    process.env.NODE_ENV = 'production';
    const res = makeRes();
    sendError(res, 'raw string');
    expect(res.statusCode).toBe(500);
    expect(res.body.code).toBe('INTERNAL_ERROR');
  });
});
