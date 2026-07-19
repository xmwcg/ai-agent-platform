import { EventEmitter } from 'events';
export interface MCPServerConfig {
    id: string;
    name: string;
    description?: string;
    transport: 'stdio' | 'sse';
    command?: string;
    args?: string[];
    url?: string;
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
    content: {
        type: string;
        text: string;
    }[];
    isError?: boolean;
}
declare class MCPService extends EventEmitter {
    private servers;
    private clients;
    private static instance;
    static getInstance(): MCPService;
    /** 启动时从数据库加载已保存的服务器配置（仅加载静态配置，运行时状态复位） */
    loadFromDB(): Promise<void>;
    /** 将当前服务器静态配置持久化到数据库（upsert） */
    private persist;
    registerServer(config: MCPServerConfig): Promise<void>;
    updateServer(id: string, patch: Partial<MCPServerConfig>): Promise<void>;
    removeServer(id: string): Promise<void>;
    setEnabled(id: string, enabled: boolean): Promise<void>;
    getServers(): MCPServerConfig[];
    getServer(id: string): MCPServerConfig | undefined;
    connectStdio(id: string): Promise<void>;
    connectSSE(id: string): Promise<void>;
    connect(id: string): Promise<void>;
    disconnect(id: string): Promise<void>;
    callTool(serverId: string, toolName: string, args: any): Promise<MCPCallResult>;
    getAvailableTools(): Promise<{
        serverId: string;
        serverName: string;
        tools: MCPTool[];
    }[]>;
}
export declare const mcpService: MCPService;
export {};
//# sourceMappingURL=mcp.service.d.ts.map