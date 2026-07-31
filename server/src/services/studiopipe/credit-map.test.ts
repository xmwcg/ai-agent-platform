import { estimateCost, CREDIT_COSTS } from './credit-map';

describe('创作工坊 - 积分成本预估 (credit-map)', () => {
  it('短视频成片：按主题长度 + 时长精确预估', () => {
    const r = estimateCost({
      sceneId: 'short-video',
      fields: { topic: 'AI短视频带货技巧', durationSec: 30 },
    });
    // chars = max(50, 9*8=72) = 72 -> script = ceil(2*72/1000)=1
    expect(r.breakdown.script).toBe(1);
    expect(r.breakdown.tts).toBe(15); // ceil(0.5*30)
    expect(r.breakdown.asr).toBe(1); // ceil(30/60)
    expect(r.breakdown.bgm).toBe(CREDIT_COSTS.bgm);
    expect(r.breakdown.export).toBe(CREDIT_COSTS.export);
    expect(r.total).toBe(1 + 15 + 1 + 1 + 2);
  });

  it('短视频成片：已给脚本时按脚本字符数计费', () => {
    const r = estimateCost({
      sceneId: 'short-video',
      fields: { script: 'x'.repeat(500), durationSec: 30 },
    });
    expect(r.breakdown.script).toBe(1); // ceil(2*500/1000)=1
    expect(r.total).toBeGreaterThanOrEqual(20);
  });

  it('数字人口播：叠加数字人单价（每 10 秒 8 积分）', () => {
    const r = estimateCost({
      sceneId: 'digital-human',
      fields: { script: 'y'.repeat(500), durationSec: 20 },
    });
    expect(r.breakdown.digitalHuman).toBe(16); // ceil(8*20/10)
    expect(r.breakdown.tts).toBe(10); // ceil(0.5*20)
    // 1(script)+10(tts)+1(asr)+1(bgm)+2(export)+16(dh) = 31
    expect(r.total).toBe(31);
  });

  it('电商图文：按生成图数量线性计费', () => {
    const r = estimateCost({ sceneId: 'ecommerce', fields: { imageCount: 4 } });
    expect(r.breakdown.ecommerceVision).toBe(CREDIT_COSTS.ecommerceVision);
    expect(r.breakdown.ecommerceText).toBe(CREDIT_COSTS.ecommerceText);
    expect(r.breakdown.ecommerceImage).toBe(CREDIT_COSTS.ecommerceImageEach * 4);
    expect(r.total).toBe(3 + 2 + 24);
  });

  it('电商图文：未指定图数量时默认 4 张', () => {
    const r = estimateCost({ sceneId: 'ecommerce', fields: {} });
    expect(r.breakdown.ecommerceImage).toBe(CREDIT_COSTS.ecommerceImageEach * 4);
    expect(r.total).toBe(29);
  });

  it('成本表覆盖全部场景步骤，无漏计为 0 的收费项', () => {
    const costKeys = new Set(Object.keys(CREDIT_COSTS));
    // 校验每张场景用到的收费维度在成本表中都有定义
    expect(costKeys.has('scriptPer1kChars')).toBe(true);
    expect(costKeys.has('ttsPerSecond')).toBe(true);
    expect(costKeys.has('asrPerMinute')).toBe(true);
    expect(costKeys.has('digitalHumanPer10s')).toBe(true);
    expect(costKeys.has('ecommerceVision')).toBe(true);
    expect(costKeys.has('ecommerceText')).toBe(true);
    expect(costKeys.has('ecommerceImageEach')).toBe(true);
  });
});
