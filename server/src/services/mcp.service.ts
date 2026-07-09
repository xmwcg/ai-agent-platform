import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { EventEmitter } from 'events';
import { MCPServer } from '../models/MCPServer';
import { logger } from '../lib/logger';

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
        this.servers.set(doc.id, {
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
        });
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
      logger.error('mcp', `MCP connect failed: ${config.name}`, err.message);
      throw err;
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
