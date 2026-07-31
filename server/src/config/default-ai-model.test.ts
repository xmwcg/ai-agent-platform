import {
  DEFAULT_TEXT_AI_MODEL,
  DEFAULT_TEXT_AI_MODEL_ID,
  DEFAULT_TEXT_AI_PROVIDER,
  getPreferredAgnesTextModel,
  splitDefaultTextModel,
} from './default-ai-model';

describe('全平台默认文本模型', () => {
  it('固定为 Agnes 2.5 Flash，不受环境变量和旧 Agnes 配置影响', () => {
    expect(DEFAULT_TEXT_AI_PROVIDER).toBe('agnes25');
    expect(DEFAULT_TEXT_AI_MODEL_ID).toBe('agnes-2.5-flash');
    expect(DEFAULT_TEXT_AI_MODEL).toBe('agnes25/agnes-2.5-flash');
    expect(getPreferredAgnesTextModel()).toBe(DEFAULT_TEXT_AI_MODEL);
    expect(splitDefaultTextModel()).toEqual({
      provider: DEFAULT_TEXT_AI_PROVIDER,
      model: DEFAULT_TEXT_AI_MODEL_ID,
    });
  });
});
