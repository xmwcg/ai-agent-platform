/**
 * 阶段0 测试安全网（characterization test）
 * ───────────────────────────────────────────────────────────────────────
 * 目的：在阶段1b 为 mcp.service.ts 的 connectStdio 增加「命令白名单 + 管理员显式
 * 授权」之前，先锁定其当前行为：
 *   - connectStdio 把来自 DB 配置的 command/args 直接传给 StdioClientTransport，
 *     不做任何白名单/授权校验 → P0 高危（服务端命令执行）。
 *   - 非 stdio 传输、找不到服务器时抛错。
 *   - 连接失败时状态置 error 并向上抛出。
 *
 * 其中「任意命令（含危险命令）均可连接」属于阶段1b 待消除的高危行为，本文件以现状
 * 断言之作为基线；阶段1b 落地后这些用例需改写为「仅白名单命令可连接 / 越权被拒绝」。
 */

import { mcpService } from './mcp.service';

// 捕获 StdioClientTransport 的构造参数（验证 command/args 是否被原样透传）
jest.mock('@modelcontextprotocol/sdk/client/stdio.js', () => ({
  StdioClientTransport: jest.fn((opts: any) => ({ opts })),
}));
jest.mock('@modelcontextprotocol/sdk/client/sse.js', () => ({
  SSEClientTransport: jest.fn((url: any) => ({ url })),
}));
jest.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    listTools: jest.fn().mockResolvedValue({ tools: [{ name: 't1', description: 'd' }] }),
    callTool: jest.fn(),
    close: jest.fn().mockResolvedValue(undefined),
  })),
}));
jest.mock('../models/MCPServer', () => ({
  __esModule: true,
  MCPServer: {
    find: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue([]) }),
    updateOne: jest.fn().mockResolvedValue({}),
    deleteOne: jest.fn().mockResolvedValue({}),
  },
}));

const stdioMod = require('@modelcontextprotocol/sdk/client/stdio.js');
const clientMod = require('@modelcontextprotocol/sdk/client/index.js');
const mcpMod = require('../models/MCPServer');

function stdioConfig(id: string, command: string, args: string[]) {
  return {
    id,
    name: id,
    transport: 'stdio' as const,
    command,
    args,
    enabled: true,
    status: 'disconnected' as const,
  };
}

describe('mcp.service · connectStdio（P0 高危：无白名单的命令透传）', () => {
  beforeEach(() => {
    stdioMod.StdioClientTransport.mockClear();
    (mcpService as any).servers.clear();
    (mcpService as any).clients.clear();
  });

  it('白名单内的命令（node）可正常连接，command/args 原样透传', async () => {
    await mcpService.registerServer(stdioConfig('s1', 'node', ['-e', 'console.log(1)']));
    await mcpService.connectStdio('s1');

    expect(stdioMod.StdioClientTransport.mock.calls).toHaveLength(1);
    const opts = stdioMod.StdioClientTransport.mock.calls[0][0];
    expect(opts.command).toBe('node');
    expect(opts.args).toEqual(['-e', 'console.log(1)']);
    expect(mcpService.getServer('s1')!.status).toBe('connected');
    expect(mcpService.getServer('s1')!.tools).toEqual([{ name: 't1', description: 'd' }]);
  });

  it('阶段1b：非白名单命令（含危险命令）被拒绝，不再真正执行', async () => {
    await mcpService.registerServer(stdioConfig('s2', 'bash', ['-c', 'rm -rf /']));
    await expect(mcpService.connectStdio('s2')).rejects.toThrow(/白名单/);
    expect(mcpService.getServer('s2')!.status).toBe('error');
    // 证明 StdioClientTransport 未被构造（命令未真正 spawn）
    expect(stdioMod.StdioClientTransport.mock.calls).toHaveLength(0);
  });

  it('阶段1b：通过绝对路径绕过白名单的命令同样被拒绝', async () => {
    await mcpService.registerServer(stdioConfig('s6', '/usr/bin/curl', ['http://x']));
    await expect(mcpService.connectStdio('s6')).rejects.toThrow(/白名单/);
  });

  it('非 stdio 传输调用 connectStdio 应抛错', async () => {
    await mcpService.registerServer({
      id: 's3',
      name: 's3',
      transport: 'sse',
      url: 'http://x',
      enabled: true,
      status: 'disconnected',
    });
    await expect(mcpService.connectStdio('s3')).rejects.toThrow(/not stdio/i);
  });

  it('找不到服务器调用 connectStdio 应抛错', async () => {
    await expect(mcpService.connectStdio('nope')).rejects.toThrow(/not found/i);
  });

  it('白名单内的命令若 MCP 握手失败，状态置为 error 并向上抛出', async () => {
    clientMod.Client.mockImplementationOnce(() => ({
      connect: jest.fn().mockRejectedValue(new Error('MCP handshake failed')),
      listTools: jest.fn(),
      close: jest.fn().mockResolvedValue(undefined),
    }));

    await mcpService.registerServer(stdioConfig('s4', 'node', ['-e', 'console.log(1)']));
    await expect(mcpService.connectStdio('s4')).rejects.toThrow(/MCP handshake failed/);
    expect(mcpService.getServer('s4')!.status).toBe('error');
  });

  it('registerServer 将配置持久化到数据库', async () => {
    await mcpService.registerServer(stdioConfig('s5', 'node', ['-v']));
    expect(mcpMod.MCPServer.updateOne).toHaveBeenCalledWith(
      { id: 's5' },
      expect.objectContaining({
        $set: expect.objectContaining({ id: 's5', command: 'node' }),
      }),
      { upsert: true }
    );
  });
});
