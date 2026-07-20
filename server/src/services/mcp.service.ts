import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventEmitter } from 'events';
import fs from 'fs';
import path from 'path';
import { MCPServer } from '../models/MCPServer';
import { logger } from '../lib/logger';

// ── P0 止血：stdio 命令白名单（消除服务端任意命令执行）──
// 仅允许管理员在 MCP_ALLOWED_STDIO_COMMANDS 中显式声明的命令；
// 默认仅 'node' / 'npx'，杜绝 `bash -c`、任意二进制等危险调用。
const ALLOWED_STDIO_COMMANDS = (process.env.MCP_ALLOWED_STDIO_COMMANDS || 'node,npx')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

function isAllowedStdioCommand(command?: string): boolean {
  if (!command) return false;
  const base = command.split(/[\\/]/).pop() || command; // 取 basename，防止通过绝对路径绕过
  return ALLOWED_STDIO_COMMANDS.includes(base);
}

// P0 止血 + 可连性修复：把 `npx -y @modelcontextprotocol/server-xxx` 这类命令，
// 在「对应包已预装进镜像」时规范化为 `node node_modules/<pkg>/dist/index.js`。
// 这样运行时无需 npx/npm（Dockerfile 已将其移除以缩小攻击面），离线即可拉起 MCP 子进程。
// 若包未预装，则保持原命令（错误信息会清晰提示，而非笼统的「网络错误」）。
function normalizeStdioCommand(
  command?: string,
  args?: string[]
): { command?: string; args?: string[] } {
  if (command !== 'npx' || !args || args.length === 0) return { command, args };
  const hasFlag = args[0] === '-y' || args[0] === '--yes';
  const pkg = hasFlag ? args[1] : args[0];
  if (!pkg || !pkg.startsWith('@modelcontextprotocol/server-')) return { command, args };
  const entry = path.join(process.cwd(), 'node_modules', pkg, 'dist', 'index.js');
  if (!fs.existsSync(entry)) return { command, args };
  const rest = hasFlag ? args.slice(2) : args.slice(1);
  return { command: 'node', args: [entry, ...rest] };
}

export interface MCPServerConfig {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse';
  command?: string;        // stdio: 命令
  args?: string[];        // stdio: 参数
  url?: string;            // sse: URL
  env?: Record<string, string>;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  tools?: MCPTool[];
  connectedAt?: number;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema?: any;
}

export interface MCPCallResult {
  content: { type: string; text: string }[];
  isError?: boolean;
}

class MCPService extends EventEmitter {
  private servers: Map<string, MCPServerConfig> = new Map();
  private clients: Map<string, Client> = new Map();
  private static instance: MCPService;

  static getInstance(): MCPService {
    if (!MCPService.instance) {
      MCPService.instance = new MCPService();
    }
    return MCPService.instance;
  }

  /** 启动时从数据库加载已保存的服务器配置（仅加载静态配置，运行时状态复位） */
  async loadFromDB(): Promise<void> {
    try {
      const docs = await MCPServer.find().lean();
      for (const doc of docs) {
        const config: MCPServerConfig = {
          id: doc.id,
          name: doc.name,
          description: doc.description,
          transport: doc.transport,
          command: doc.command,
          args: doc.args,
          url: doc.url,
          env: doc.env,
          enabled: doc.enabled,
          status: 'disconnected',
        };
        // 规范化 stdio 命令（npx -> node，仅当包已预装）；变更后写回 DB，保证持久一致
        const norm = normalizeStdioCommand(config.command, config.args);
        if (norm.command !== config.command || norm.args !== config.args) {
          logger.info('mcp', `规范化为 node 命令: ${config.name} (${config.command} -> node)`);
          config.command = norm.command;
          config.args = norm.args;
          this.servers.set(config.id, config);
          await this.persist(config.id);
        } else {
          this.servers.set(config.id, config);
        }
      }
      logger.info('mcp', `Loaded ${docs.length} MCP server config(s) from database`);
    } catch (err: any) {
      logger.warn('mcp', `Failed to load MCP servers from DB: ${err.message}`);
    }
  }

  /** 将当前服务器静态配置持久化到数据库（upsert） */
  private async persist(id: string): Promise<void> {
    const config = this.servers.get(id);
    if (!config) return;
    try {
      await MCPServer.updateOne(
        { id },
        {
          $set: {
            id: config.id,
            name: config.name,
            description: config.description,
            transport: config.transport,
            command: config.command,
            args: config.args,
            url: config.url,
            env: config.env,
            enabled: config.enabled,
          },
        },
        { upsert: true }
      );
    } catch (err: any) {
      logger.warn('mcp', `Failed to persist MCP server: ${err.message}`);
    }
  }

  // 注册服务器配置
  async registerServer(config: MCPServerConfig): Promise<void> {
    this.servers.set(config.id, { ...config, status: 'disconnected' });
    await this.persist(config.id);
  }

  // 更新服务器配置
  async updateServer(id: string, patch: Partial<MCPServerConfig>): Promise<void> {
    const existing = this.servers.get(id);
    if (!existing) throw new Error(`Server ${id} not found`);
    this.servers.set(id, { ...existing, ...patch, id, status: 'disconnected' });
    await this.persist(id);
  }

  // 删除服务器配置
  async removeServer(id: string): Promise<void> {
    await this.disconnect(id).catch(() => {});
    this.servers.delete(id);
    try {
      await MCPServer.deleteOne({ id });
    } catch (err: any) {
      logger.warn('mcp', `Failed to delete MCP server from DB: ${err.message}`);
    }
  }

  // 设置启用状态
  async setEnabled(id: string, enabled: boolean): Promise<void> {
    const existing = this.servers.get(id);
    if (!existing) throw new Error(`Server ${id} not found`);
    existing.enabled = enabled;
    this.servers.set(id, existing);
    await this.persist(id);
  }

  // 获取所有服务器
  getServers(): MCPServerConfig[] {
    return Array.from(this.servers.values());
  }

  // 获取单个服务器
  getServer(id: string): MCPServerConfig | undefined {
    return this.servers.get(id);
  }

  // 连接服务器（stdio）
  async connectStdio(id: string): Promise<void> {
    const config = this.servers.get(id);
    if (!config || config.transport !== 'stdio') {
      throw new Error(`Server ${id} not found or not stdio transport`);
    }

    // P0 止血：命令白名单校验（拒绝未显式声明的命令，含绝对路径绕过）
    if (!isAllowedStdioCommand(config.command)) {
      config.status = 'error';
      this.servers.set(id, config);
      logger.error('mcp', `stdio 命令 "${config.command}" 不在白名单，拒绝连接（允许：${ALLOWED_STDIO_COMMANDS.join(', ')}）`);
      throw new Error(`MCP stdio 命令 "${config.command}" 不在白名单，已被拒绝（允许的命令：${ALLOWED_STDIO_COMMANDS.join(', ')}）`);
    }

    try {
      config.status = 'connecting';
      this.servers.set(id, config);

      const transport = new StdioClientTransport({
        command: config.command!,
        args: config.args || [],
        env: { ...process.env, ...config.env }
      });

      const client = new Client({ name: 'ai-agent-platform', version: '0.1.0' }, { capabilities: {} });
      await client.connect(transport);

      // 列出工具
      const toolsResult = await client.listTools();
      config.tools = (toolsResult.tools || []) as MCPTool[];
      config.status = 'connected';
      config.connectedAt = Date.now();
      this.clients.set(id, client);
      this.servers.set(id, config);

      logger.info('mcp', `MCP server connected: ${config.name} (${toolsResult.tools?.length || 0} tools)`);
      this.emit('connected', id, config);
    } catch (err: any) {
      config.status = 'error';
      this.servers.set(id, config);
      const detail = err?.code === 'ENOENT'
        ? `命令 "${config.command}" 无法执行。此插件需要在服务器上预装对应的 MCP 服务包。请联系管理员使用「一键安装」功能或手动安装。详情：${err.message}`
        : (err?.message || String(err));
      logger.error('mcp', `MCP connect failed: ${config.name}`, err?.message);
      throw new Error(`MCP 连接失败（${config.name}）：${detail}`);
    }
  }

  // 连接服务器（SSE）
  async connectSSE(id: string): Promise<void> {
    const config = this.servers.get(id);
    if (!config || config.transport !== 'sse') {
      throw new Error(`Server ${id} not found or not SSE transport`);
    }

    try {
      config.status = 'connecting';
      this.servers.set(id, config);

      const transport = new SSEClientTransport(new URL(config.url!));

      const client = new Client({ name: 'ai-agent-platform', version: '0.1.0' }, { capabilities: {} });
      await client.connect(transport);

      const toolsResult = await client.listTools();
      config.tools = (toolsResult.tools || []) as MCPTool[];
      config.status = 'connected';
      config.connectedAt = Date.now();
      this.clients.set(id, client);
      this.servers.set(id, config);

      logger.info('mcp', `MCP SSE connected: ${config.name}`);
      this.emit('connected', id, config);
    } catch (err: any) {
      config.status = 'error';
      this.servers.set(id, config);
      logger.error('mcp', `MCP SSE connect failed: ${config.name}`, err.message);
      throw err;
    }
  }

  // 连接服务器（自动判断类型）
  async connect(id: string): Promise<void> {
    const config = this.servers.get(id);
    if (!config) throw new Error(`Server ${id} not found`);
    if (config.transport === 'stdio') {
      return this.connectStdio(id);
    } else {
      return this.connectSSE(id);
    }
  }

  // 断开连接
  async disconnect(id: string): Promise<void> {
    const client = this.clients.get(id);
    if (client) {
      await client.close();
      this.clients.delete(id);
    }
    const config = this.servers.get(id);
    if (config) {
      config.status = 'disconnected';
      config.tools = undefined;
      this.servers.set(id, config);
    }
    this.emit('disconnected', id);
  }

  // 调用工具
  async callTool(serverId: string, toolName: string, args: any): Promise<MCPCallResult> {
    const client = this.clients.get(serverId);
    if (!client) throw new Error(`Server ${serverId} not connected`);

    try {
      const result = await client.callTool({ name: toolName, arguments: args });
      return result as MCPCallResult;
    } catch (err: any) {
      logger.error('mcp', `MCP tool call failed: ${serverId}/${toolName}`, err.message);
      throw err;
    }
  }

  // 获取服务器所有工具（供 Agent 调用）
  async getAvailableTools(): Promise<{ serverId: string; serverName: string; tools: MCPTool[] }[]> {
    const result: { serverId: string; serverName: string; tools: MCPTool[] }[] = [];
    for (const [id, config] of this.servers.entries()) {
      if (config.status === 'connected' && config.tools) {
        result.push({ serverId: id, serverName: config.name, tools: config.tools });
      }
    }
    return result;
  }
}

export const mcpService = MCPService.getInstance();
