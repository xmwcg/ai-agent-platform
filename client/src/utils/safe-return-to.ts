const RETURN_TO_BASE = 'https://aibak.site';
const MAX_RETURN_TO_LENGTH = 4096;

/** Accept only same-site absolute paths. Protocol-relative and backslash-normalized hosts are rejected. */
export function resolveSafeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value || value.length > MAX_RETURN_TO_LENGTH || !value.startsWith('/')) return fallback;

  try {
    const parsed = new URL(value, RETURN_TO_BASE);
    if (parsed.origin !== RETURN_TO_BASE) return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginPath(returnTo: string): string {
  const safeReturnTo = resolveSafeReturnTo(returnTo);
  return `/login?returnTo=${encodeURIComponent(safeReturnTo)}`;
}
