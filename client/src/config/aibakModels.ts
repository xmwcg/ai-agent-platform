// 平台免费额度：CloudBase 小程序成长计划云函数提供的 4 个免费模型。
// 文本对话（hy3 / hy3-preview）与图像生成（文生图 / 图生图）统一经
// client/src/services/api.ts 的 aibakAPI（后端 /api/aibak/chat、/api/aibak/image）调用，
// 后端再转发到 CloudBase 云函数，不消耗任何付费 API Key。
//
// 单一数据源：FreeExperienceFab 与 AiChat 均从此处导入，避免模型 id 散落。

export type AibakModelKind = 'text' | 't2i' | 'i2i';

export interface AibakModelDef {
  /** 送后端 /api/aibak/* 的 model 字段值 */
  id: string;
  /** 前端展示名 */
  label: string;
  /** text=文本对话；t2i=文生图；i2i=图生图 */
  kind: AibakModelKind;
  /** 选择器分组名 */
  group: string;
  /** 能力描述 */
  desc: string;
}

export const AIBAK_FREE_MODELS: AibakModelDef[] = [
  { id: 'hy3', label: 'hy3（文本大模型）', kind: 'text', group: '免费额度 · 文本对话', desc: '文本大模型 · 免费' },
  { id: 'hy3-preview', label: 'hy3-preview（文本大模型）', kind: 'text', group: '免费额度 · 文本对话', desc: '文本大模型预览版 · 免费' },
  { id: 'HY-Image-3.0-Plus-4090-Tob-v1.0', label: 'HY-Image-3.0-Plus（文生图）', kind: 't2i', group: '免费额度 · 图像生成', desc: '文生图 · 免费' },
  { id: 'HY-Image-v3.0-I2I-ToB-v1.0.1', label: 'HY-Image-v3.0-I2I（图生图）', kind: 'i2i', group: '免费额度 · 图像生成', desc: '图生图 · 免费' },
];

/** 图像生成可选尺寸 */
export const AIBAK_IMAGE_SIZES = [
  { label: '1024×1024（方形）', value: '1024x1024' },
  { label: '1280×720（横屏）', value: '1280x720' },
  { label: '720×1280（竖屏）', value: '720x1280' },
  { label: '1280×1280（大正方）', value: '1280x1280' },
];

export function getAibakModel(id: string): AibakModelDef | undefined {
  return AIBAK_FREE_MODELS.find((m) => m.id === id);
}

export function isAibakFreeModel(id: string): boolean {
  return AIBAK_FREE_MODELS.some((m) => m.id === id);
}
