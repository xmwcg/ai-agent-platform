import axios from 'axios';
import { getProviderEndpoint } from '../config/provider-catalog';
import { createPinnedNetworkAgents, resolvePublicAddresses } from '../lib/network-safety';

const MAX_RESPONSE_BYTES = 1024 * 1024;
function extractModelIds(payload: unknown): string[] {
  const value = payload as any;
  const raw: unknown[] = Array.isArray(value?.data)
    ? value.data
    : Array.isArray(value?.models)
      ? value.models
      : [];
  return Array.from(new Set(raw
    .map((model: any) => model?.id || model?.name || (typeof model === 'string' ? model : undefined))
    .filter(Boolean)
    .map((id) => String(id).replace(/^models\//, ''))
    .filter((id) => id.length > 0 && id.length <= 200)))
    .slice(0, 500);
}

export interface FetchCatalogModelsInput {
  providerId: string;
  endpointId?: string;
  apiKey: string;
  timeoutMs?: number;
}

/**
 * 只对服务端权威目录中的官方 HTTPS Endpoint 发起模型列表请求。
 * API Key 仅存在于本次调用栈，不落库、不写 Redis、不写日志，也不缓存响应正文。
 */
export async function fetchCatalogProviderModels(input: FetchCatalogModelsInput): Promise<string[]> {
  const resolved = getProviderEndpoint(input.providerId, input.endpointId);
  if (!resolved) throw new Error('未知厂商或 Endpoint');
  if (!resolved.provider.supportsModelFetch) throw new Error('该厂商仅提供接入参考，暂不支持在线获取模型列表');
  const apiKey = String(input.apiKey || '').trim();
  if (!apiKey || apiKey.length > 4096) throw new Error('API Key 不能为空或长度不合法');

  const base = new URL(resolved.endpoint.baseUrl);
  if (base.protocol !== 'https:') throw new Error('仅允许 HTTPS 厂商接口');
  const target = new URL(
    `${base.toString().replace(/\/+$/, '')}/${resolved.endpoint.modelListPath.replace(/^\/+/, '')}`
  );
  if (target.origin !== base.origin) throw new Error('模型列表路径越界');

  const addresses = await resolvePublicAddresses(target.hostname);
  const agents = createPinnedNetworkAgents(addresses[0]);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...resolved.endpoint.extraHeaders,
  };
  const params: Record<string, string> = {};
  if (resolved.endpoint.authMode === 'bearer') headers.Authorization = `Bearer ${apiKey}`;
  if (resolved.endpoint.authMode === 'x-api-key') headers['x-api-key'] = apiKey;
  if (resolved.endpoint.authMode === 'query-key') params.key = apiKey;

  try {
    const response = await axios.get(target.toString(), {
      headers,
      params,
      timeout: Math.min(Math.max(input.timeoutMs || 30000, 1000), 30000),
      maxRedirects: 0,
      maxContentLength: MAX_RESPONSE_BYTES,
      maxBodyLength: MAX_RESPONSE_BYTES,
      responseType: 'json',
      httpsAgent: agents.httpsAgent,
      validateStatus: (status) => status >= 200 && status < 300,
      transitional: { silentJSONParsing: false, forcedJSONParsing: true },
    });
    return extractModelIds(response.data);
  } catch (error: any) {
    if (error?.code === 'ECONNABORTED' || error?.code === 'ETIMEDOUT') {
      throw new Error('厂商接口请求超时');
    }
    if (error?.code === 'ERR_FR_TOO_MANY_REDIRECTS' || (error?.response?.status >= 300 && error?.response?.status < 400)) {
      throw new Error('厂商接口返回重定向，安全策略已拒绝');
    }
    if (error?.code === 'ERR_BAD_RESPONSE' && /maxContentLength/i.test(String(error?.message || ''))) {
      throw new Error('厂商响应超过 1MB 限制');
    }
    const status = Number(error?.response?.status);
    if (status) throw new Error(`厂商接口返回 HTTP ${status}`);
    if (error instanceof Error && /目标地址|未知厂商|仅允许|模型列表/.test(error.message)) throw error;
    throw new Error('无法安全连接厂商接口: ' + ((error instanceof Error) ? error.message.slice(0, 200) : String(error).slice(0, 200)));
  } finally {
    agents.destroy();
  }
}
