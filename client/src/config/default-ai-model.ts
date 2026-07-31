/** 全平台文本 AI 默认模型：Agnes 2.5 免费模型。 */
export const DEFAULT_TEXT_AI_MODEL = 'agnes25/agnes-2.5-flash';
export const LEGACY_AGNES_TEXT_MODEL = 'agnes/agnes-2.0-flash';

/** 仅用于持久化数据升级；模型选择器仍保留旧 Agnes 模型供用户手动选择。 */
export function migrateLegacyTextModel(model?: string): string {
  if (!model) return DEFAULT_TEXT_AI_MODEL;
  return model.toLowerCase() === LEGACY_AGNES_TEXT_MODEL
    ? DEFAULT_TEXT_AI_MODEL
    : model;
}
