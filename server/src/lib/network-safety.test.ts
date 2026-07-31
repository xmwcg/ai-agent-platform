import {
  createPinnedLookup,
  isBlockedHostname,
  isBlockedNetworkAddress,
  normalizePublicHttpUrl,
  resolvePublicAddresses,
} from './network-safety';

describe('network-safety', () => {
  it.each([
    '127.0.0.1',
    '10.0.0.1',
    '169.254.169.254',
    '192.0.2.1',
    '192.168.1.10',
    '198.51.100.10',
    '::1',
    '::7f00:1',
    '::ffff:0:7f00:1',
    'fc00::1',
    'fec0::1',
    'fe80::1',
    'ff02::1',
    '64:ff9b::7f00:1',
    '2002:7f00:1::',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
  ])('blocks non-public address %s', (address) => {
    expect(isBlockedNetworkAddress(address)).toBe(true);
  });

  it.each(['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111'])(
    'allows public address %s',
    (address) => {
      expect(isBlockedNetworkAddress(address)).toBe(false);
    }
  );

  it.each(['localhost', 'api.localhost', 'printer.local', 'metadata.google.internal'])(
    'blocks local or metadata hostname %s',
    (hostname) => {
      expect(isBlockedHostname(hostname)).toBe(true);
    }
  );

  it('normalizes HTTP(S) URLs and strips fragments', () => {
    expect(normalizePublicHttpUrl('https://Example.com/path?q=1#private').toString()).toBe(
      'https://example.com/path?q=1'
    );
  });

  it.each([
    'ftp://example.com/file',
    'https://user:secret@example.com/',
    'http://localhost:8080/',
    'http://169.254.169.254/latest/meta-data',
  ])('rejects unsafe URL %s', (url) => {
    expect(() => normalizePublicHttpUrl(url)).toThrow();
  });

  it('requires every DNS result to be public', async () => {
    const lookup = jest.fn(async () => [
      { address: '8.8.8.8', family: 4 },
      { address: '10.0.0.2', family: 4 },
    ]);

    await expect(resolvePublicAddresses('example.com', lookup)).rejects.toThrow(
      '目标地址解析到内网、回环或链路本地地址'
    );
  });

  it('returns public DNS addresses and uses a pinned lookup', async () => {
    const lookup = jest.fn(async () => [{ address: '8.8.8.8', family: 4 }]);
    const addresses = await resolvePublicAddresses('example.com', lookup);
    expect(addresses).toEqual([{ address: '8.8.8.8', family: 4 }]);

    const pinnedLookup = createPinnedLookup(addresses[0]);
    const callback = jest.fn();
    pinnedLookup('different.example', {}, callback);
    expect(callback).toHaveBeenCalledWith(null, '8.8.8.8', 4);
  });

  it('does not expose resolver details when DNS lookup fails', async () => {
    const lookup = jest.fn(async () => {
      throw new Error('resolver internal detail');
    });
    await expect(resolvePublicAddresses('example.com', lookup)).rejects.toThrow(
      '目标地址无法安全解析'
    );
  });
});
