import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(
  fileURLToPath(new URL('./CustomerServicePage.tsx', import.meta.url)),
  'utf8'
);
const apiSource = readFileSync(
  fileURLToPath(new URL('../services/api.ts', import.meta.url)),
  'utf8'
);

describe('智能客服长耗时请求与重复提交门禁', () => {
  it('客服对话必须覆盖全局 10 秒超时', () => {
    expect(apiSource).toContain('customerService: 30_000');
    expect(apiSource).toMatch(/chatPublic:[\s\S]*API_TIMEOUT_MS\.customerService/);
  });

  it('发送期间必须使用同步互斥锁并禁用输入，避免回车重复提交', () => {
    expect(pageSource).toContain('chatRequestPendingRef.current');
    expect(pageSource).toContain('disabled={chatting}');
    expect(pageSource).toContain('finally {');
  });

  it('后续消息必须携带服务端 sessionId 续接同一会话', () => {
    expect(pageSource).toContain('sessionId: chatSessionId');
    expect(pageSource).toContain('setChatSessionId(res.data.sessionId)');
  });
});
