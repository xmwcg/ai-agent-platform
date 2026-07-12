import mongoose, { Schema, Document } from 'mongoose';

/** 大模型配置（借鉴 Dify 模型管理，支持动态增删与运行时切换） */
export interface IModelConfig extends Document {
  name: string;                 // 配置显示名，如「我的 DeepSeek」
  provider: string;             // openai / anthropic / deepseek / hunyuan / custom / qwen / zhipu ...
  baseURL: string;              // API 基础地址
  apiKey: string;               // 密钥（AES-256-GCM 加密落库，由 lib/crypto 处理，DB 中仅存密文）
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
    provider: { type: String, required: true, index: true },
    baseURL: { type: String, required: true },
    apiKey: { type: String, required: true },
    models: { type: [String], default: [] },
    defaultModel: { type: String, required: true },
    enabled: { type: Boolean, default: true, index: true },
    isDefault: { type: Boolean, default: false },
    pinned: { type: Boolean, default: false },
    description: { type: String },
    createdBy: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// 复合索引：按 createdBy + enabled 查询（用户列出自己的启用模型配置）
ModelConfigSchema.index({ createdBy: 1, enabled: 1 });
// 复合索引：启用的模型配置按 provider 分组（运行时动态加载）
ModelConfigSchema.index({ enabled: 1, provider: 1 });

export const ModelConfig = mongoose.model<IModelConfig>('ModelConfig', ModelConfigSchema);
