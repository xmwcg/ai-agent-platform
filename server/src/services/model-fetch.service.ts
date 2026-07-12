import axios from 'axios';
import crypto from 'crypto';

/**
 * 厂商模型自动获取服务
 * - 调用 OpenAI 兼容的 GET {baseURL}/models 拉取模型清单
 * - 15s 超时 + 内存缓存（按 baseURL+apiKey 哈希），避免反复慢请求/网络错误
 * - 同一 key 并发去重（inflight promise 复用），避免页面多次点击叠加请求
 */

const cache = new Map<string, { at: number; ids: string[] }>();
const inflight = new Map<string, Promise<string[]>>();
const CACHE_TTL_MS = 10 * 60 * 1000;

function keyOf(baseURL: string, apiKey: string): string {
  return crypto.createHash('sha256').update(`${baseURL}|${apiKey}`).digest('hex').slice(0, 16);
}

export async function fetchProviderModels(
  baseURL: string,
  apiKey: string,
  timeoutMs = 15000,
): Promise<string[]> {
  const cleanBase = (baseURL || '').trim().replace(/\/+$/, '');
  if (!cleanBase) throw new Error('baseURL 不能为空');
  const url = cleanBase.endsWith('/models') ? cleanBase : `${cleanBase}/models`;
  const key = keyOf(cleanBase, apiKey || '');

  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.ids;
  const existing = inflight.get(key);
  if (existing) return existing;

  const p = (async () => {
    try {
      const resp = await axios.get(url, {
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined,
        timeout: timeoutMs,
      });
      const data = resp.data;
      const raw: any[] = Array.isArray(data?.data) ? data.data : [];
      const ids = Array.from(
        new Set(
          raw
            .map((m: any) => m?.id || m?.name || (typeof m === 'string' ? m : null))
            .filter(Boolean)
            .map(String),
        ),
      );
      cache.set(key, { at: Date.now(), ids });
      return ids;
    } catch (err: any) {
      const status = err?.response?.status;
      const msg = err?.code === 'ECONNABORTED'
        ? '请求超时（15s），请确认服务可达或网络通畅'
        : status
          ? `厂商返回 ${status}：${err?.response?.data?.error?.message || err.message}`
          : `无法连接（${err?.code || err?.message}）`;
      throw new Error(msg);
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, p);
  return p;
}
