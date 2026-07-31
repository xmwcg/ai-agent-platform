/** 全平台文本 AI 的统一默认配置。 */
export const DEFAULT_TEXT_AI_PROVIDER = 'agnes25' as const;
export const DEFAULT_TEXT_AI_MODEL_ID = 'agnes-2.5-flash' as const;
export const DEFAULT_TEXT_AI_MODEL = `${DEFAULT_TEXT_AI_PROVIDER}/${DEFAULT_TEXT_AI_MODEL_ID}` as const;

/**
 * 所有未显式选择模型的文本 AI 调用都必须从这里取默认值。
 * 不因旧 Agnes、CloudBase 或其他厂商是否配置而改变默认模型，避免三端行为漂移。
 */
export function getPreferredAgnesTextModel(): string {
  return DEFAULT_TEXT_AI_MODEL;
}

export function splitDefaultTextModel(): { provider: typeof DEFAULT_TEXT_AI_PROVIDER; model: typeof DEFAULT_TEXT_AI_MODEL_ID } {
  return { provider: DEFAULT_TEXT_AI_PROVIDER, model: DEFAULT_TEXT_AI_MODEL_ID };
}
