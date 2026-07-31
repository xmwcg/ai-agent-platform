export type StudioSceneId = 'short-video' | 'digital-human' | 'ecommerce' | 'mixcut' | 'product-article';

export type StepStatus = 'pending' | 'running' | 'done' | 'error' | 'skipped';

export interface StudioInputField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'url' | 'select' | 'image' | 'number' | 'file';
  required?: boolean;
  options?: string[];
  placeholder?: string;
  help?: string;
  /** 仅在指定场景需要的附加说明 */
  min?: number;
  max?: number;
}

export interface StudioScene {
  id: StudioSceneId;
  name: string;
  tagline: string;
  description: string;
  /** 所需会员层级（free 表示所有登录用户可用；pro/max 需对应套餐或单独计费） */
  tier: 'free' | 'pro' | 'max';
  /** 有序步骤 key，对应 studio.service 中的 step runner */
  steps: string[];
  inputs: StudioInputField[];
}

export interface StudioTemplate {
  id: string;
  sceneId: StudioSceneId;
  name: string;
  description: string;
  /** 预填字段，用户可在其上修改 */
  defaults: Record<string, any>;
  subtitleStyle?: SubtitleStyle;
}

export interface SubtitleStyle {
  font: string;
  size: number;
  color: string;
  outline: string;
  position: 'bottom' | 'center';
  /** 抖音风格高亮关键词（可选） */
  highlightWords?: string[];
}

export interface StudioJobInput {
  sceneId: StudioSceneId;
  templateId?: string;
  fields: Record<string, any>;
}

export interface StudioJobOutput {
  videoUrl?: string;
  thumbnailUrl?: string;
  images?: string[];
  copy?: string;
  creditsCost?: number;
}

