export type ProviderCategory = 'domestic' | 'international';
export type ProviderAuthMode = 'bearer' | 'x-api-key' | 'query-key';

export interface ProviderProtocol {
  id: string;
  name: string;
  description: string;
}

export interface ProviderEndpoint {
  id: string;
  name: string;
  region: string;
  baseUrl: string;
  modelListPath: string;
  authMode: ProviderAuthMode;
  extraHeaders?: Record<string, string>;
}

export interface ProviderCatalogEntry {
  id: string;
  name: string;
  category: ProviderCategory;
  protocols: ProviderProtocol[];
  endpoints: ProviderEndpoint[];
  keyFormat: string;
  recommendedModels: string[];
  capabilities: string[];
  supportsModelFetch: boolean;
  officialWebsite: string;
  registrationUrl: string;
  apiKeyGuideUrl: string;
  officialDocsUrl: string;
  apiKeySteps: string[];
  commonErrors: string[];
  reviewedAt: string;
}

const openAICompatible: ProviderProtocol = {
  id: 'openai-compatible',
  name: 'OpenAI Compatible',
  description: '使用 Authorization: Bearer API_KEY，并兼容 /models、/chat/completions 等接口。',
};

export const PROVIDER_CATALOG: ProviderCatalogEntry[] = [
  {
    id: 'openai', name: 'OpenAI', category: 'international', protocols: [openAICompatible],
    endpoints: [{ id: 'global', name: '全球 API', region: 'Global', baseUrl: 'https://api.openai.com/v1', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'sk-…', recommendedModels: ['gpt-4.1', 'gpt-4.1-mini', 'o4-mini'],
    capabilities: ['chat', 'reasoning', 'vision', 'audio', 'embeddings'], supportsModelFetch: true,
    officialWebsite: 'https://openai.com/', registrationUrl: 'https://platform.openai.com/signup',
    apiKeyGuideUrl: 'https://platform.openai.com/api-keys', officialDocsUrl: 'https://platform.openai.com/docs/api-reference/models/list',
    apiKeySteps: ['登录 OpenAI Platform', '进入 API Keys', '创建新密钥并立即安全保存'],
    commonErrors: ['401：密钥无效或已撤销', '429：额度不足或触发速率限制', '地区不可用：检查账号和服务地区'], reviewedAt: '2026-07-17',
  },
  {
    id: 'anthropic', name: 'Anthropic Claude', category: 'international',
    protocols: [{ id: 'anthropic', name: 'Anthropic Messages API', description: '使用 x-api-key 与 anthropic-version 请求头。' }],
    endpoints: [{ id: 'global', name: '全球 API', region: 'Global', baseUrl: 'https://api.anthropic.com/v1', modelListPath: '/models', authMode: 'x-api-key', extraHeaders: { 'anthropic-version': '2023-06-01' } }],
    keyFormat: 'sk-ant-…', recommendedModels: ['claude-sonnet-4-5', 'claude-haiku-4-5'],
    capabilities: ['chat', 'reasoning', 'vision', 'tool-use'], supportsModelFetch: true,
    officialWebsite: 'https://www.anthropic.com/', registrationUrl: 'https://console.anthropic.com/',
    apiKeyGuideUrl: 'https://console.anthropic.com/settings/keys', officialDocsUrl: 'https://docs.anthropic.com/en/api/models-list',
    apiKeySteps: ['登录 Anthropic Console', '进入 Settings / API Keys', '创建密钥并配置计费'],
    commonErrors: ['401：x-api-key 无效', '403：账号或地区无访问权限', '429：速率或消费限制'], reviewedAt: '2026-07-17',
  },
  {
    id: 'gemini', name: 'Google Gemini', category: 'international',
    protocols: [{ id: 'gemini', name: 'Gemini API', description: 'Google Generative Language API；模型查询使用 key 参数。' }],
    endpoints: [{ id: 'global', name: 'Google AI API', region: 'Global', baseUrl: 'https://generativelanguage.googleapis.com/v1beta', modelListPath: '/models', authMode: 'query-key' }],
    keyFormat: 'AIza…', recommendedModels: ['gemini-2.5-pro', 'gemini-2.5-flash'],
    capabilities: ['chat', 'reasoning', 'vision', 'audio', 'video'], supportsModelFetch: true,
    officialWebsite: 'https://ai.google.dev/', registrationUrl: 'https://aistudio.google.com/',
    apiKeyGuideUrl: 'https://aistudio.google.com/app/apikey', officialDocsUrl: 'https://ai.google.dev/api/models',
    apiKeySteps: ['登录 Google AI Studio', '打开 Get API key', '在允许的项目中创建 API Key'],
    commonErrors: ['400：模型或参数不受支持', '403：Key、项目或地区权限不足', '429：免费或付费配额耗尽'], reviewedAt: '2026-07-17',
  },
  {
    id: 'deepseek', name: 'DeepSeek', category: 'domestic', protocols: [openAICompatible],
    endpoints: [{ id: 'cn', name: '官方 API', region: '中国大陆', baseUrl: 'https://api.deepseek.com/v1', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'sk-…', recommendedModels: ['deepseek-v4-flash', 'deepseek-v4-pro'],
    capabilities: ['chat', 'reasoning', 'tool-use'], supportsModelFetch: true,
    officialWebsite: 'https://www.deepseek.com/', registrationUrl: 'https://platform.deepseek.com/',
    apiKeyGuideUrl: 'https://platform.deepseek.com/api_keys', officialDocsUrl: 'https://api-docs.deepseek.com/api/list-models',
    apiKeySteps: ['登录 DeepSeek 开放平台', '进入 API keys', '创建密钥并确认账户余额'],
    commonErrors: ['401：认证失败', '402：余额不足', '429：请求频率过高'], reviewedAt: '2026-07-17',
  },
  {
    id: 'dashscope', name: '阿里云百炼 / 通义千问', category: 'domestic', protocols: [openAICompatible],
    endpoints: [{ id: 'cn', name: '北京地域兼容接口', region: '中国大陆', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'sk-…', recommendedModels: ['qwen-plus', 'qwen-max', 'qwen-turbo'],
    capabilities: ['chat', 'reasoning', 'vision', 'audio', 'embeddings'], supportsModelFetch: true,
    officialWebsite: 'https://bailian.console.aliyun.com/', registrationUrl: 'https://account.aliyun.com/register/register.htm',
    apiKeyGuideUrl: 'https://help.aliyun.com/zh/model-studio/get-api-key', officialDocsUrl: 'https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope',
    apiKeySteps: ['登录阿里云百炼', '开通模型服务', '在 API-KEY 管理中创建密钥'],
    commonErrors: ['InvalidApiKey：密钥或地域不匹配', 'Model.AccessDenied：模型未开通', 'Throttling：触发限流'], reviewedAt: '2026-07-17',
  },
  {
    id: 'moonshot', name: 'Moonshot Kimi', category: 'domestic', protocols: [openAICompatible],
    endpoints: [{ id: 'cn', name: '官方 API', region: '中国大陆', baseUrl: 'https://api.moonshot.cn/v1', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'sk-…', recommendedModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2'],
    capabilities: ['chat', 'reasoning', 'long-context'], supportsModelFetch: true,
    officialWebsite: 'https://platform.moonshot.cn/', registrationUrl: 'https://platform.moonshot.cn/',
    apiKeyGuideUrl: 'https://platform.moonshot.cn/console/api-keys', officialDocsUrl: 'https://platform.moonshot.cn/docs/api-reference',
    apiKeySteps: ['登录 Moonshot 开放平台', '完成实名认证与充值', '在 API Key 管理中创建密钥'],
    commonErrors: ['401：Key 无效', '429：并发或速率受限', '余额不足：请检查账户余额'], reviewedAt: '2026-07-17',
  },
  {
    id: 'zhipu', name: '智谱 AI / GLM', category: 'domestic', protocols: [openAICompatible],
    endpoints: [{ id: 'cn', name: '开放平台 API', region: '中国大陆', baseUrl: 'https://open.bigmodel.cn/api/paas/v4', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'id.secret', recommendedModels: ['glm-4.5', 'glm-4-flash'],
    capabilities: ['chat', 'reasoning', 'vision', 'tool-use'], supportsModelFetch: true,
    officialWebsite: 'https://open.bigmodel.cn/', registrationUrl: 'https://open.bigmodel.cn/login',
    apiKeyGuideUrl: 'https://open.bigmodel.cn/usercenter/apikeys', officialDocsUrl: 'https://open.bigmodel.cn/dev/api',
    apiKeySteps: ['登录智谱开放平台', '完成认证并开通模型', '进入 API Keys 创建密钥'],
    commonErrors: ['1001/1002：认证失败', '1113：余额不足', '1302：并发超限'], reviewedAt: '2026-07-17',
  },
  {
    id: 'volcengine', name: '火山方舟 / 豆包', category: 'domestic', protocols: [openAICompatible],
    endpoints: [{ id: 'cn-beijing', name: '北京地域', region: '中国大陆-北京', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', modelListPath: '/models', authMode: 'bearer' }],
    keyFormat: 'UUID/字符串密钥', recommendedModels: ['doubao-seed-1-6', 'deepseek-v3'],
    capabilities: ['chat', 'reasoning', 'vision', 'embeddings'], supportsModelFetch: false,
    officialWebsite: 'https://www.volcengine.com/product/ark', registrationUrl: 'https://console.volcengine.com/',
    apiKeyGuideUrl: 'https://www.volcengine.com/docs/82379/1263270', officialDocsUrl: 'https://www.volcengine.com/docs/82379/1298454',
    apiKeySteps: ['登录火山引擎控制台', '开通方舟并创建推理接入点', '创建 API Key 并使用接入点 ID'],
    commonErrors: ['EndpointNotFound：接入点 ID 错误', 'AccessDenied：权限或地域不匹配', 'LimitExceeded：配额超限'], reviewedAt: '2026-07-17',
  },
];

export function getProvider(providerId: string): ProviderCatalogEntry | undefined {
  return PROVIDER_CATALOG.find((provider) => provider.id === providerId);
}

export function getProviderEndpoint(providerId: string, endpointId?: string): { provider: ProviderCatalogEntry; endpoint: ProviderEndpoint } | undefined {
  const provider = getProvider(providerId);
  if (!provider) return undefined;
  const endpoint = provider.endpoints.find((item) => item.id === endpointId) || provider.endpoints[0];
  return endpoint ? { provider, endpoint } : undefined;
}

export function publicProviderCatalog(): ProviderCatalogEntry[] {
  return PROVIDER_CATALOG.map((provider) => ({
    ...provider,
    protocols: provider.protocols.map((protocol) => ({ ...protocol })),
    endpoints: provider.endpoints.map((endpoint) => ({ ...endpoint, extraHeaders: endpoint.extraHeaders ? { ...endpoint.extraHeaders } : undefined })),
  }));
}
