import http from 'node:http';
import https from 'node:https';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const execFileAsync = promisify(execFile);
const host = '127.0.0.1';
const port = Number(process.env.CODEX_DASHBOARD_PORT || 4173);
const root = path.dirname(fileURLToPath(import.meta.url));
const scanner = path.join(root, 'scan_agents.py');
const python = process.env.CODEX_DASHBOARD_PYTHON || 'python';
const cacheTtlMs = 30_000;
const requestBodyLimit = 32 * 1024;
const providerResponseLimit = 2 * 1024 * 1024;
let cache = null;
let cacheAt = 0;
let scanPromise = null;

class PublicError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function scan() {
  const { stdout } = await execFileAsync(python, [scanner], {
    windowsHide: true,
    timeout: 120_000,
    maxBuffer: 10 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    encoding: 'utf8',
  });
  const parsed = JSON.parse(stdout.replace(/^\uFEFF/, ''));
  if (parsed?.security?.secretsExposed !== false) {
    throw new Error('安全检查失败：扫描结果未确认脱敏');
  }
  cache = parsed;
  cacheAt = Date.now();
  return parsed;
}

async function getData(force = false) {
  if (!force && cache && Date.now() - cacheAt < cacheTtlMs) return cache;
  if (!scanPromise) scanPromise = scan().finally(() => { scanPromise = null; });
  return scanPromise;
}

function send(res, status, type, body) {
  res.writeHead(status, {
    'content-type': `${type}; charset=utf-8`,
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
  });
  res.end(body);
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > requestBodyLimit) throw new PublicError('请求内容过大', 413);
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
  } catch {
    throw new PublicError('请求 JSON 格式错误');
  }
}

function normalizedHost(hostname) {
  return hostname.toLowerCase().replace(/^\[|\]$/g, '');
}

function isBlockedIpv4(address) {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(x => !Number.isInteger(x) || x < 0 || x > 255)) return true;
  const [a, b, c] = parts;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0 && c === 0) ||
    (a === 192 && b === 0 && c === 2) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113);
}

function isBlockedIp(address) {
  const version = isIP(address);
  if (version === 4) return isBlockedIpv4(address);
  if (version !== 6) return true;
  const value = address.toLowerCase();
  const mapped = value.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return value === '::' || value === '::1' || value.startsWith('fc') || value.startsWith('fd') ||
    /^fe[89ab]/.test(value) || value.startsWith('ff') || value.startsWith('2001:db8:');
}

async function validateTarget(rawUrl) {
  let url;
  try {
    url = new URL(String(rawUrl || '').trim());
  } catch {
    throw new PublicError('Base URL 格式错误');
  }
  if (url.username || url.password || url.hash) throw new PublicError('Base URL 不能包含账号、密码或片段');
  if (url.href.length > 2048) throw new PublicError('Base URL 过长');
  const hostname = normalizedHost(url.hostname);
  const local = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) {
    throw new PublicError('只允许 HTTPS；本机仅允许 http://localhost 或 http://127.0.0.1');
  }
  if (/your[_-]|example\.(com|net|org)$/i.test(hostname)) throw new PublicError('请先填写真实的 Base URL');
  const addresses = await lookup(hostname, { all: true, verbatim: true }).catch(() => []);
  if (!addresses.length) throw new PublicError('Base URL 域名无法解析');
  if (!local && addresses.some(row => isBlockedIp(row.address))) throw new PublicError('禁止访问内网、回环或云元数据地址');
  const allowed = addresses.filter(row => local || !isBlockedIp(row.address));
  const chosen = allowed.find(row => row.family === 4) || allowed[0];
  if (!chosen) throw new PublicError('Base URL 地址不可访问');
  return { url, address: chosen.address, family: chosen.family };
}

function appendEndpoint(baseUrl, endpoint) {
  const url = new URL(baseUrl);
  let pathname = url.pathname.replace(/\/+$/, '');
  if (!pathname.endsWith(endpoint)) pathname += endpoint;
  url.pathname = pathname || endpoint;
  url.search = '';
  url.hash = '';
  return url;
}

function providerRequest(provider, protocol, baseUrl, cursor = '') {
  const base = new URL(baseUrl);
  const headers = { accept: 'application/json', 'user-agent': 'AI-Agent-Observatory/1.0' };
  let url;
  if (provider === 'anthropic') {
    const suffix = /\/v1$/i.test(base.pathname.replace(/\/+$/, '')) ? '/models' : '/v1/models';
    url = appendEndpoint(base, suffix);
    url.searchParams.set('limit', '1000');
    if (cursor) url.searchParams.set('after_id', cursor);
    headers['x-api-key'] = protocol.apiKey;
    headers['anthropic-version'] = '2023-06-01';
  } else if (provider === 'gemini') {
    url = appendEndpoint(base, '/models');
    url.searchParams.set('pageSize', '1000');
    if (cursor) url.searchParams.set('pageToken', cursor);
    headers['x-goog-api-key'] = protocol.apiKey;
  } else if (provider === 'azure') {
    url = new URL('/openai/models', base.origin);
    url.searchParams.set('api-version', '2023-12-01-preview');
    headers['api-key'] = protocol.apiKey;
  } else {
    if (provider === 'deepseek' && /\/anthropic\/?$/i.test(base.pathname)) base.pathname = base.pathname.replace(/\/anthropic\/?$/i, '');
    if (provider === 'baidu' && /\/anthropic\/?$/i.test(base.pathname)) base.pathname = base.pathname.replace(/\/anthropic\/?$/i, '/v2');
    url = appendEndpoint(base, '/models');
    headers.authorization = `Bearer ${protocol.apiKey}`;
  }
  return { url, headers };
}

function providerStatusError(status) {
  if (status === 400) return new PublicError('厂商拒绝模型列表请求，请检查 Base URL 和协议（HTTP 400）', 502);
  if (status === 401) return new PublicError('API Key 无效或无权限（厂商 HTTP 401）', 502);
  if (status === 403) return new PublicError('厂商拒绝访问，请检查 API Key、地域和权限（HTTP 403）', 502);
  if (status === 404) return new PublicError('模型列表接口不存在，请检查 Base URL（HTTP 404）', 502);
  if (status === 429) return new PublicError('厂商请求限流或额度不足（HTTP 429）', 502);
  if (status >= 500) return new PublicError(`厂商模型服务暂时不可用（HTTP ${status}）`, 502);
  return new PublicError(`厂商模型接口返回 HTTP ${status}`, 502);
}

function providerNetworkError(error) {
  const code = String(error?.code || '').toUpperCase();
  if (['ETIMEDOUT', 'ESOCKETTIMEDOUT', 'ENETUNREACH', 'EHOSTUNREACH'].includes(code)) {
    return new PublicError('连接厂商接口超时，请检查本机网络或代理', 504);
  }
  if (code === 'ECONNREFUSED') return new PublicError('厂商接口拒绝连接，请检查 Base URL 或代理', 502);
  if (code === 'ENOTFOUND' || code === 'EAI_AGAIN') return new PublicError('厂商域名解析失败，请检查网络或 DNS', 502);
  if (code.startsWith('CERT_') || code.includes('TLS') || code.includes('SSL')) {
    return new PublicError('厂商接口 TLS 证书校验失败', 502);
  }
  return new PublicError('无法连接厂商模型接口，请检查本机网络、代理或 Base URL', 502);
}

async function requestProviderJson(url, headers) {
  const target = await validateTarget(url.href);
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === 'https:' ? https : http;
    const req = transport.request(target.url, {
      method: 'GET',
      headers,
      timeout: 15_000,
      lookup: (_hostname, options, callback) => options?.all ? callback(null, [{ address: target.address, family: target.family }]) : callback(null, target.address, target.family),
    }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400) {
        res.resume();
        reject(new PublicError('厂商接口重定向已被安全策略阻止', 502));
        return;
      }
      const chunks = [];
      let size = 0;
      res.on('data', chunk => {
        size += chunk.length;
        if (size > providerResponseLimit) req.destroy(new PublicError('厂商响应过大', 502));
        else chunks.push(chunk);
      });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(providerStatusError(res.statusCode));
          return;
        }
        try {
          resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
        } catch {
          reject(new PublicError('厂商返回的不是有效 JSON', 502));
        }
      });
    });
    req.on('timeout', () => req.destroy(new PublicError('连接厂商接口超时，请检查本机网络或代理', 504)));
    req.on('error', error => reject(error instanceof PublicError ? error : providerNetworkError(error)));
    req.end();
  });
}

function modelIds(payload) {
  const candidates = [
    payload, payload?.data, payload?.models, payload?.items, payload?.result,
    payload?.data?.models, payload?.data?.items,
    payload?.result?.data, payload?.result?.models, payload?.result?.items,
    payload?.result?.data?.models, payload?.result?.data?.items,
  ];
  const rows = candidates.find(Array.isArray) || [];
  return rows.map(row => typeof row === 'string' ? row :
    row?.id || row?.name || row?.model || row?.model_id || row?.modelId || row?.model_name || row?.modelName)
    .filter(value => typeof value === 'string' && value.length > 0 && value.length <= 300)
    .map(value => value.replace(/^models\//, ''));
}

async function fetchProviderModels(body) {
  const provider = String(body?.provider || '').trim().toLowerCase();
  const protocol = String(body?.protocol || '').trim().toLowerCase();
  const apiKey = String(body?.apiKey || '').trim();
  const baseUrl = String(body?.baseUrl || '').trim().replace(/\/+$/, '');
  if (!/^[a-z0-9_-]{1,40}$/.test(provider)) throw new PublicError('厂商参数错误');
  if (!apiKey || apiKey.length > 4096) throw new PublicError('请填写有效的 API Key');
  await validateTarget(baseUrl);

  const found = new Set();
  let cursor = '';
  for (let page = 0; page < 20; page += 1) {
    const request = providerRequest(provider, { id: protocol, apiKey }, baseUrl, cursor);
    const payload = await requestProviderJson(request.url, request.headers);
    modelIds(payload).forEach(id => found.add(id));
    const next = provider === 'gemini' ? payload?.nextPageToken :
      (provider === 'anthropic' && payload?.has_more ? payload?.last_id : '');
    if (!next || next === cursor) break;
    cursor = String(next);
  }
  const models = [...found].sort((a, b) => a.localeCompare(b, 'en'));
  if (!models.length) throw new PublicError('厂商已连接，但返回格式暂不支持或当前 API Key 无可见模型', 502);
  return { models, count: models.length };
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${host}:${port}`);
    if (url.pathname === '/api/data') {
      send(res, 200, 'application/json', JSON.stringify(await getData(url.searchParams.get('refresh') === '1')));
      return;
    }
    if (url.pathname === '/api/provider/models') {
      if (req.method !== 'POST') {
        send(res, 405, 'application/json', JSON.stringify({ error: 'Method not allowed' }));
        return;
      }
      send(res, 200, 'application/json', JSON.stringify(await fetchProviderModels(await readJson(req))));
      return;
    }
    if (url.pathname === '/health') {
      send(res, 200, 'text/plain', 'ok');
      return;
    }
    if (url.pathname !== '/' && url.pathname !== '/index.html') {
      send(res, 404, 'text/plain', 'Not found');
      return;
    }
    send(res, 200, 'text/html', await readFile(path.join(root, 'index.html'), 'utf8'));
  } catch (error) {
    const status = Number(error?.status) || 500;
    send(res, status, 'application/json', JSON.stringify({ error: status >= 500 && !(error instanceof PublicError) ? '服务器内部错误' : error?.message || String(error) }));
  }
});

server.listen(port, host, () => console.log(`AI Agent Observatory: http://${host}:${port}`));
