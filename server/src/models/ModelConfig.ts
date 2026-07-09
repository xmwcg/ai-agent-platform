import mongoose, { Schema, Document } from 'mongoose';

/** 大模型配置（借鉴 Dify 模型管理，支持动态增删与运行时切换） */
export interface IModelConfig extends Document {
  name: string;                 // 配置显示名，如「我的 DeepSeek」
  provider: string;             // openai / anthropic / deepseek / hunyuan / custom / qwen / zhipu ...
  baseURL: string;              // API 基础地址
  apiKey: string;               // 密钥（加密存储由上层负责，这里明文落库演示）
  models: string[];             // 可用模型列表
  defaultModel: string;         // 默认模型
  enabled: boolean;             // 是否启用
  isDefault: boolean;           // 是否为平台默认
  pinned: boolean;              // 是否置顶（运营自定义模型时优先展示）
  description?: string;
  createdBy: string;            // 创建者用户 ID
  createdAt: Date;
  updatedAt: Date;
}

const ModelConfigSchema = new Schema<IModelConfig>(
  {
    name: { type: String, required: true, trim: true },
    provider: { type: String, required: true },
    baseURL: { type: String, required: true },
    apiKey: { type: String, required: true },
    models: { type: [String], default: [] },
    defaultModel: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    isDefault: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    description: { type: String },
    createdBy: { type: String, required: true },
  },
  { timestamps: true }
);

export const ModelConfig = mongoose.model<IModelConfig>('ModelConfig', ModelConfigSchema);
