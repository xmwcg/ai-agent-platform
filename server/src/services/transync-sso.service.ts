import crypto from 'crypto';

export const TRANSYNC_TICKET_TTL_SECONDS = 90;
export const TRANSYNC_STATE_TTL_SECONDS = 5 * 60;

export interface TranSyncTicketPayload {
  version: 1;
  subject: string;
  email: string;
  emailVerified: boolean;
  name: string;
  avatar?: string;
  role: 'user' | 'admin';
  plan: 'free' | 'pro' | 'max' | 'team';
  membershipExpiresAt?: string;
  state: string;
  next: string;
  issuedAt: string;
  expiresAt: string;
}

function isLoopback(hostname: string): boolean {
  return ['localhost', '127.0.0.1', '[::1]'].includes(hostname);
}

export function normalizeTranSyncOrigin(value: string | undefined, nodeEnv = process.env.NODE_ENV): string | null {
  const candidate = value?.trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    const localHttp = nodeEnv !== 'production' && url.protocol === 'http:' && isLoopback(url.hostname);
    if (url.protocol !== 'https:' && !localHttp) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    if (url.pathname.replace(/\/+$/, '') !== '') return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function sanitizeTranSyncNext(value: unknown): string {
  if (typeof value !== 'string') return '/app';
  const candidate = value.trim();
  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\')) return '/app';
  try {
    const parsed = new URL(candidate, 'https://translate.aibak.site');
    if (parsed.origin !== 'https://translate.aibak.site') return '/app';
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return '/app';
  }
}

export function isValidSsoState(value: unknown): value is string {
  return typeof value === 'string' && /^[A-Za-z0-9_-]{32,256}$/.test(value);
}

export function createAuthorizationCode(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function ticketStorageKey(code: string): string {
  return `sso:transync:${crypto.createHash('sha256').update(code).digest('hex')}`;
}

export function secretMatches(expected: string | undefined, provided: unknown): boolean {
  if (!expected || expected.length < 48 || typeof provided !== 'string') return false;
  const expectedBuffer = Buffer.from(expected);
  const providedBuffer = Buffer.from(provided);
  return expectedBuffer.length === providedBuffer.length && crypto.timingSafeEqual(expectedBuffer, providedBuffer);
}
