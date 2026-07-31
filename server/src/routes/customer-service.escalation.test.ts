import { shouldEscalate } from './customer-service';

describe('shouldEscalate 转人工判定', () => {
  const clinic = {
    handoffEnabled: true,
    escalationTriggers: ['胸痛', '呼吸困难', '120'],
  };

  it('handoffEnabled 为 false 时恒不转人工', () => {
    expect(shouldEscalate('我胸痛', { handoffEnabled: false, escalationTriggers: ['胸痛'] })).toBe(false);
  });

  it('显式请求转人工', () => {
    expect(shouldEscalate('转人工', clinic, true)).toBe(true);
  });

  it('命中通用触发词转人工', () => {
    expect(shouldEscalate('我要联系客服', clinic)).toBe(true);
  });

  it('命中机器人行业触发词转人工', () => {
    expect(shouldEscalate('突然胸痛怎么办', clinic)).toBe(true);
    expect(shouldEscalate('需要打120急救', clinic)).toBe(true);
  });

  it('未命中任何触发词不转人工', () => {
    expect(shouldEscalate('门诊时间是几点', clinic)).toBe(false);
  });

  it('无触发词配置时仅通用词生效', () => {
    const plain = { handoffEnabled: true, escalationTriggers: [] };
    expect(shouldEscalate('门诊时间', plain)).toBe(false);
    expect(shouldEscalate('转人工', plain)).toBe(true);
  });
});
