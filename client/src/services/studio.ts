const TOKEN_KEYS = ['token', 'accessToken', 'authToken'];

function getToken(): string | null {
  for (const k of TOKEN_KEYS) {
    const v = localStorage.getItem(k);
    if (v) return v;
  }
  return null;
}

const BASE = '/api/studio';

export interface ApiResult {
  ok: boolean;
  status: number;
  data: any;
}

async function req(path: string, opts: RequestInit = {}): Promise<ApiResult> {
  const token = getToken();
  const headers: Record<string, string> = { ...(opts.headers as any) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
  const r = await fetch(BASE + path, { ...opts, headers });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, data };
}

export const studioApi = {
  scenes: () => req('/scenes'),
  templates: () => req('/templates'),
  balance: () => req('/balance'),
  create: (payload: any) => req('/create', { method: 'POST', body: JSON.stringify(payload) }),
  job: (id: string) => req(`/job/${id}`),
};

export default studioApi;
