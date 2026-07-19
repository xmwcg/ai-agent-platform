export interface ModelProvider {
  id: string;
  name: string;
  apiBaseUrl: string;
  apiKeyPlaceholder: string;
  models: string[];
  category: 'international' | 'domestic';
  description?: string;
  /** 自动识别的能力标签：推理思考 / 视觉理解 / 图片生成 */
  capabilities?: { reasoning?: boolean; vision?: boolean; image?: boolean };
  /** 是否为 OpenAI 兼容、支持 /models 自动拉取模型清单 */
  supportsAutoFetch?: boolean;
}

export const PROVIDER_PRESETS: ModelProvider[] = [
  // 国际厂商
  {
    id: 'openai', name: 'OpenAI', category: 'international',
    apiBaseUrl: 'https://api.openai.com/v1',
    apiKeyPlaceholder: 'sk-proj-...',
    models: ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-4', 'gpt-3.5-turbo', 'o1-preview', 'o1-mini'],
    description: '最强通用大模型，支持多模态与工具调用',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'anthropic', name: 'Anthropic Claude', category: 'international',
    apiBaseUrl: 'https://api.anthropic.com/v1',
    apiKeyPlaceholder: 'sk-ant-api03-...',
    models: ['claude-sonnet-4-20250514', 'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229', 'claude-3-haiku-20240307'],
    description: '安全性领先，长文本与代码能力突出',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'google', name: 'Google Gemini', category: 'international',
    apiBaseUrl: 'https://generativelanguage.googleapis.com/v1beta',
    apiKeyPlaceholder: 'AIza...',
    models: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'],
    description: '多模态原生支持，搜索增强',
    capabilities: { reasoning: true, vision: true, image: true },
    supportsAutoFetch: true,
  },
  {
    id: 'mistral', name: 'Mistral AI', category: 'international',
    apiBaseUrl: 'https://api.mistral.ai/v1',
    apiKeyPlaceholder: 'mistral-...',
    models: ['mistral-large-latest', 'mistral-medium-latest', 'mistral-small-latest', 'codestral-latest'],
    description: '欧洲领先开源模型，性价比高',
    capabilities: { reasoning: false, vision: false, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'cohere', name: 'Cohere', category: 'international',
    apiBaseUrl: 'https://api.cohere.ai/v1',
    apiKeyPlaceholder: 'COHERE-API-KEY',
    models: ['command-r-plus', 'command-r', 'command'],
    description: '企业级 RAG 和嵌入模型',
    capabilities: { reasoning: false, vision: false, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'groq', name: 'Groq', category: 'international',
    apiBaseUrl: 'https://api.groq.com/openai/v1',
    apiKeyPlaceholder: 'gsk_...',
    models: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
    description: '最快推理速度，开源模型加速',
    capabilities: { reasoning: false, vision: false, image: false },
    supportsAutoFetch: true,
  },

  // 国内厂商
  {
    id: 'deepseek', name: 'DeepSeek', category: 'domestic',
    apiBaseUrl: 'https://api.deepseek.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    description: '国产开源旗舰，代码与推理能力领先',
    capabilities: { reasoning: true, vision: false, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'hunyuan', name: '腾讯混元', category: 'domestic',
    apiBaseUrl: 'https://hunyuan.tencentcloudapi.com',
    apiKeyPlaceholder: 'TC3 SecretId + SecretKey',
    models: ['hunyuan-turbos-latest', 'hunyuan-pro', 'hunyuan-standard', 'hunyuan-lite'],
    description: '腾讯自研大模型，多模态支持',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: false,
  },
  {
    id: 'tongyi', name: '阿里通义千问', category: 'domestic',
    apiBaseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['qwen-max', 'qwen-plus', 'qwen-turbo', 'qwen-long', 'qwen-coder-plus'],
    description: '阿里云旗舰，长文本场景领先',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'wenxin', name: '百度文心一言', category: 'domestic',
    apiBaseUrl: 'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat',
    apiKeyPlaceholder: 'Access Token 或 API Key',
    models: ['ernie-4.0-turbo-8k', 'ernie-3.5-8k', 'ernie-speed-8k', 'ernie-lite-8k'],
    description: '百度自研，中文理解能力强',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'zhipu', name: '智谱 GLM', category: 'domestic',
    apiBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    apiKeyPlaceholder: 'your-api-key',
    models: ['glm-4-plus', 'glm-4-air', 'glm-4-flash', 'glm-4v-plus'],
    description: '清华系，多模态与Agent能力',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'baichuan', name: '百川智能', category: 'domestic',
    apiBaseUrl: 'https://api.baichuan-ai.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['Baichuan4', 'Baichuan3-Turbo', 'Baichuan2-Turbo'],
    description: '医疗与法律场景专业优化',
    capabilities: { reasoning: false, vision: false, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'moonshot', name: 'Moonshot Kimi', category: 'domestic',
    apiBaseUrl: 'https://api.moonshot.cn/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    description: '超长上下文，文档分析强',
    capabilities: { reasoning: true, vision: false, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'minimax', name: 'MiniMax', category: 'domestic',
    apiBaseUrl: 'https://api.minimax.chat/v1',
    apiKeyPlaceholder: 'eyJhbGciOi...',
    models: ['abab6.5s-chat', 'abab5.5-chat'],
    description: '语音与多模态能力突出',
    capabilities: { reasoning: false, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'stepfun', name: '阶跃星辰', category: 'domestic',
    apiBaseUrl: 'https://api.stepfun.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['step-2-16k', 'step-1-8k', 'step-1v-32k'],
    description: '国产多模态新势力',
    capabilities: { reasoning: true, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'yi', name: '零一万物 Yi', category: 'domestic',
    apiBaseUrl: 'https://api.lingyiwanwu.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['yi-large', 'yi-medium', 'yi-spark', 'yi-vision'],
    description: '李开复团队，视觉理解能力',
    capabilities: { reasoning: false, vision: true, image: false },
    supportsAutoFetch: true,
  },
  {
    id: 'iflytek', name: '讯飞星火', category: 'domestic',
    apiBaseUrl: 'https://spark-api-open.xf-yun.com/v1',
    apiKeyPlaceholder: 'sk-...',
    models: ['spark-lite', 'spark-pro', 'spark-max', 'spark-4.0-ultra'],
    description: '讯飞自研，语音与教育场景领先',
    capabilities: { reasoning: true, vision: false, image: false },
    supportsAutoFetch: true,
  },
];

/** 能力标签渲染辅助 */
export function capabilityTags(caps?: { reasoning?: boolean; vision?: boolean; image?: boolean }): { text: string; color: string }[] {
  if (!caps) return [];
  const out: { text: string; color: string }[] = [];
  if (caps.reasoning) out.push({ text: '推理思考', color: 'purple' });
  if (caps.vision) out.push({ text: '视觉理解', color: 'blue' });
  if (caps.image) out.push({ text: '图片生成', color: 'green' });
  return out;
}

export const NOTE_OPTIONS = [
  { value: 'personal', label: '个人使用' },
  { value: 'company', label: '公司办公' },
  { value: 'education', label: '教育培训' },
  { value: 'medical', label: '医疗健康' },
  { value: 'finance', label: '金融投资' },
  { value: 'legal', label: '法律服务' },
  { value: 'ecommerce', label: '电商零售' },
  { value: 'manufacturing', label: '制造业' },
  { value: 'media', label: '媒体内容' },
  { value: 'gaming', label: '游戏娱乐' },
  { value: 'research', label: '学术研究' },
  { value: 'government', label: '政务办公' },
];
