/**
 * 调用链可观测性单测（纯函数：buildTraceEvent / selectTracerMode）
 */
import { buildTraceEvent, selectTracerMode } from './trace';

describe('buildTraceEvent', () => {
  it('补全 traceId / timestamp 并保留输入字段', () => {
    const ev = buildTraceEvent(
      { name: 'chat', userId: 'u1', durationMs: 12, status: 'ok', input: 'q', output: 'a' },
      () => 'fixed-id'
    );
    expect(ev.traceId).toBe('fixed-id');
    expect(ev.name).toBe('chat');
    expect(ev.userId).toBe('u1');
    expect(ev.durationMs).toBe(12);
    expect(ev.status).toBe('ok');
    expect(ev.input).toBe('q');
    expect(ev.output).toBe('a');
    expect(typeof ev.timestamp).toBe('string');
  });

  it('默认 status 为 ok', () => {
    const ev = buildTraceEvent({ name: 'x' });
    expect(ev.status).toBe('ok');
  });
});

describe('selectTracerMode', () => {
  it('默认（无任何配置）返回 noop', () => {
    expect(selectTracerMode({})).toBe('noop');
  });

  it('显式 TRACER_MODE=langfuse 生效', () => {
    expect(selectTracerMode({ TRACER_MODE: 'langfuse' })).toBe('langfuse');
  });

  it('显式 TRACER_MODE=noop 生效', () => {
    expect(selectTracerMode({ TRACER_MODE: 'noop' })).toBe('noop');
  });

  it('仅当三要素齐全时自动启用 langfuse', () => {
    expect(
      selectTracerMode({ LANGFUSE_PUBLIC_KEY: 'a', LANGFUSE_SECRET_KEY: 'b', LANGFUSE_HOST: 'c' })
    ).toBe('langfuse');
    // 缺任一要素 → 退回 noop
    expect(selectTracerMode({ LANGFUSE_PUBLIC_KEY: 'a' })).toBe('noop');
    expect(selectTracerMode({ LANGFUSE_SECRET_KEY: 'b', LANGFUSE_HOST: 'c' })).toBe('noop');
  });
});
