import { buildTraceEvent, selectTracerMode, getTracer, measure } from './trace';

describe('trace pure functions', () => {
  describe('buildTraceEvent', () => {
    it('构造事件含必需字段', () => {
      const e = buildTraceEvent({ name: 'test', userId: 'u1', durationMs: 12, status: 'ok' });
      expect(e.traceId).toMatch(/^trace_/);
      expect(e.name).toBe('test');
      expect(e.userId).toBe('u1');
      expect(e.durationMs).toBe(12);
      expect(e.status).toBe('ok');
      expect(typeof e.timestamp).toBe('string');
    });
    it('支持自定义 id 生成器', () => {
      const e = buildTraceEvent({ name: 'x' }, () => 'fixed-id');
      expect(e.traceId).toBe('fixed-id');
    });
  });

  describe('selectTracerMode', () => {
    it('默认 noop', () => {
      expect(selectTracerMode({})).toBe('noop');
    });
    it('显式覆盖优先', () => {
      expect(selectTracerMode({ TRACER_MODE: 'langfuse' })).toBe('langfuse');
      expect(selectTracerMode({ TRACER_MODE: 'noop' })).toBe('noop');
    });
    it('按环境变量自动识别 langfuse', () => {
      expect(
        selectTracerMode({
          LANGFUSE_PUBLIC_KEY: 'p',
          LANGFUSE_SECRET_KEY: 's',
          LANGFUSE_HOST: 'h',
        })
      ).toBe('langfuse');
      expect(selectTracerMode({ LANGFUSE_PUBLIC_KEY: 'p' })).toBe('noop'); // 缺字段
    });
  });

  describe('getTracer', () => {
    it('noop 始终可用', () => {
      expect(getTracer({}).isConfigured()).toBe(true);
      expect(getTracer({}).mode).toBe('noop');
    });
    it('langfuse 仅在完整配置时可用', () => {
      const t = getTracer({ LANGFUSE_PUBLIC_KEY: 'p', LANGFUSE_SECRET_KEY: 's', LANGFUSE_HOST: 'h' });
      expect(t.mode).toBe('langfuse');
      expect(t.isConfigured()).toBe(true);
    });
  });

  describe('measure', () => {
    it('返回原函数结果并上报（不抛错）', async () => {
      const res = await measure('op', async () => 42, { userId: 'u1' });
      expect(res).toBe(42);
    });
    it('异常时仍上报 error 并向上抛出', async () => {
      await expect(
        measure('op', async () => {
          throw new Error('boom');
        })
      ).rejects.toThrow('boom');
    });
  });
});
