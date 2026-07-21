import dns from 'dns';
import http from 'http';
import https from 'https';
import net from 'net';

export interface PublicNetworkAddress {
  address: string;
  family: number;
}

export type PublicAddressLookup = (hostname: string) => Promise<ReadonlyArray<PublicNetworkAddress>>;

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
]);

function normalizeHostname(hostname: string): string {
  return hostname.trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
}

function isPrivateIpv4(address: string): boolean {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return true;
  }

  const [a, b, c] = parts;
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 192 && b === 0 && (c === 0 || c === 2)) ||
    (a === 192 && b === 88 && c === 99) ||
    (a === 198 && (b === 18 || b === 19)) ||
    (a === 198 && b === 51 && c === 100) ||
    (a === 203 && b === 0 && c === 113) ||
    a >= 224
  );
}

function extractMappedIpv4(address: string): string | undefined {
  const dotted = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  if (dotted) return dotted;

  const hex = address.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!hex) return undefined;
  const high = Number.parseInt(hex[1], 16);
  const low = Number.parseInt(hex[2], 16);
  return `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;
}

export function isBlockedNetworkAddress(address: string): boolean {
  const normalized = normalizeHostname(address).split('%')[0];
  const family = net.isIP(normalized);
  if (family === 4) return isPrivateIpv4(normalized);
  if (family !== 6) return true;

  if (normalized === '::' || normalized === '::1') return true;
  if (/^::(?:[0-9a-f]{1,4}:){0,1}[0-9a-f]{1,4}$/i.test(normalized)) return true;
  if (/^::ffff:/i.test(normalized)) return true;
  if (/^(fc|fd)/.test(normalized)) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (/^fe[c-f]/.test(normalized)) return true;
  if (/^ff/.test(normalized)) return true;
  if (/^64:ff9b(?::|$)/.test(normalized)) return true;
  if (/^100(?::|$)/.test(normalized)) return true;
  if (/^2001:(?:0|10|20)(?::|$)/.test(normalized)) return true;
  if (/^2001:db8(?::|$)/.test(normalized)) return true;
  if (/^2002(?::|$)/.test(normalized)) return true;

  const mapped = extractMappedIpv4(normalized);
  return mapped ? isPrivateIpv4(mapped) : false;
}

export function isBlockedHostname(hostname: string): boolean {
  const cleanHost = normalizeHostname(hostname);
  return (
    !cleanHost ||
    BLOCKED_HOSTNAMES.has(cleanHost) ||
    cleanHost.endsWith('.localhost') ||
    cleanHost.endsWith('.local')
  );
}

export function normalizePublicHttpUrl(input: string | URL): URL {
  let target: URL;
  try {
    target = input instanceof URL ? new URL(input.toString()) : new URL(input);
  } catch {
    throw new Error('目标地址必须是有效的 HTTP(S) URL');
  }

  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    throw new Error('仅允许 HTTP(S) 公网地址');
  }
  if (target.username || target.password) {
    throw new Error('目标地址不得包含用户名或密码');
  }
  if (isBlockedHostname(target.hostname)) {
    throw new Error('目标地址不在允许的公网范围内');
  }
  const literalHost = normalizeHostname(target.hostname);
  if (net.isIP(literalHost) && isBlockedNetworkAddress(literalHost)) {
    throw new Error('目标地址不在允许的公网范围内');
  }

  target.hash = '';
  return target;
}

const systemLookup: PublicAddressLookup = async (hostname) => {
  return dns.promises.lookup(hostname, { all: true, verbatim: true });
};

export async function resolvePublicAddresses(
  hostname: string,
  lookup: PublicAddressLookup = systemLookup
): Promise<PublicNetworkAddress[]> {
  const cleanHost = normalizeHostname(hostname);
  if (isBlockedHostname(cleanHost)) {
    throw new Error('目标地址不在允许的公网范围内');
  }

  const literalFamily = net.isIP(cleanHost);
  let addresses: ReadonlyArray<PublicNetworkAddress>;
  try {
    addresses = literalFamily
      ? [{ address: cleanHost, family: literalFamily }]
      : await lookup(cleanHost);
  } catch {
    throw new Error('目标地址无法安全解析');
  }

  if (!addresses.length || addresses.some((item) => isBlockedNetworkAddress(item.address))) {
    throw new Error('目标地址解析到内网、回环或链路本地地址，已拒绝请求');
  }

  return addresses.map((item) => ({ address: item.address, family: item.family }));
}

export function createPinnedLookup(address: PublicNetworkAddress) {
  return ((
    _hostname: string,
    options: unknown,
    callback?: (
      err: NodeJS.ErrnoException | null,
      address: string | Array<{ address: string; family: number }>,
      family?: number
    ) => void
  ) => {
    const cb = typeof options === 'function' ? options : callback;
    if (!cb) return;
    const wantsAll = Boolean(options && typeof options === 'object' && 'all' in options && options.all);
    if (wantsAll) {
      cb(null, [{ address: address.address, family: address.family }]);
      return;
    }
    cb(null, address.address, address.family);
  }) as any;
}

export function createPinnedNetworkAgents(address: PublicNetworkAddress): {
  httpAgent: http.Agent;
  httpsAgent: https.Agent;
  destroy: () => void;
} {
  const lookup = createPinnedLookup(address);
  const httpAgent = new http.Agent({ keepAlive: false, lookup });
  const httpsAgent = new https.Agent({ keepAlive: false, lookup });
  return {
    httpAgent,
    httpsAgent,
    destroy: () => {
      httpAgent.destroy();
      httpsAgent.destroy();
    },
  };
}
