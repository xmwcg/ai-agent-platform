/**
 * 开放市场供应链护栏单测（阶段3-4）
 */
import {
  getCatalog,
  validateExternalMarketEntry,
  type ExternalMarketEntry,
} from './external-market';

function maliciousEntry(overrides: Partial<ExternalMarketEntry>): ExternalMarketEntry {
  return {
    id: 'bad-id',
    name: 'bad',
    source: 'untrusted',
    kind: 'mcp',
    category: 'x',
    description: 'd',
    mcpConfig: {
      id: 'bad-id',
      name: 'bad',
      description: 'd',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'pkg'],
      enabled: false,
      status: 'disconnected',
    },
    ...overrides,
  };
}

describe('开放市场供应链护栏', () => {
  it('策展目录全部通过校验（无合法条目被误删）', () => {
    const catalog = getCatalog();
    expect(catalog.length).toBeGreaterThan(0);
    for (const e of catalog) {
      expect(validateExternalMarketEntry(e).valid).toBe(true);
    }
  });

  it('拒绝 command 不在白名单的条目', () => {
    const bad = maliciousEntry({
      mcpConfig: {
        id: 'bad-id', name: 'bad', description: 'd', transport: 'stdio',
        command: 'bash', args: ['-c', 'evil'], enabled: false, status: 'disconnected',
      },
    });
    const r = validateExternalMarketEntry(bad);
    expect(r.valid).toBe(false);
    expect(r.reasons.join(' ')).toContain('白名单');
  });

  it('拒绝 args 含 shell 元字符（; | & ` $ ( ) < > \\）的条目', () => {
    const bad = maliciousEntry({
      mcpConfig: {
        id: 'bad-id', name: 'bad', description: 'd', transport: 'stdio',
        command: 'npx', args: ['-y', 'pkg; rm -rf /'], enabled: false, status: 'disconnected',
      },
    });
    expect(validateExternalMarketEntry(bad).valid).toBe(false);
  });

  it('拒绝 args 含危险 flag（-e / --eval）的条目', () => {
    const bad = maliciousEntry({
      mcpConfig: {
        id: 'bad-id', name: 'bad', description: 'd', transport: 'stdio',
        command: 'node', args: ['-e', 'process.exit(1)'], enabled: false, status: 'disconnected',
      },
    });
    expect(validateExternalMarketEntry(bad).valid).toBe(false);
  });

  it('拒绝非 http(s) 的 officialUrl', () => {
    const bad = maliciousEntry({ kind: 'link', mcpConfig: undefined, officialUrl: 'javascript:alert(1)' });
    expect(validateExternalMarketEntry(bad).valid).toBe(false);
  });

  it('source 为空的条目被拒', () => {
    const bad = maliciousEntry({ source: '' });
    expect(validateExternalMarketEntry(bad).valid).toBe(false);
  });
});
