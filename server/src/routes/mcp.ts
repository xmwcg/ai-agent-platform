import { Router, Request, Response } from 'express';
import { mcpService, MCPServerConfig } from '../services/mcp.service';
import { requireAuth, optionalAuth, AuthRequest } from '../middleware/auth';
import { enforceQuota, quotaIncrement } from '../middleware/subscription';
import { sendError } from '../lib/http-error';

const router = Router();

// 获取所有 MCP 服务器
router.get("/", (_req, res) => {
  res.json({
    success: true,
    data: {
      capabilities: [
        { type: "servers", label: "MCP服务器列表", path: "/api/mcp/servers", desc: "查看已注册的MCP服务器" },
        { type: "tools", label: "可用工具", path: "/api/mcp/tools", desc: "查看所有MCP提供的工具" },
      ],
    },
  });
});
router.get('/servers', (req: Request, res: Response) => {
  const servers = mcpService.getServers();
  res.json({ success: true, data: servers });
});

// 批量导入 MCP 服务器配置包（安装包）
router.post('/servers/import', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const b = req.body;
    let configs: MCPServerConfig[] = [];
    if (Array.isArray(b)) configs = b;
    else if (Array.isArray(b?.servers)) configs = b.servers;
    else if (b && b.id && b.name && b.transport) configs = [b];

    if (configs.length === 0) {
      return res.status(400).json({ success: false, error: '未识别到 MCP 配置（需要 MCPServerConfig 对象或数组）' });
    }
    const imported: string[] = [];
    for (const cfg of configs) {
      if (!cfg.id || !cfg.name || !cfg.transport) {
        return res.status(400).json({ success: false, error: '配置缺少 id/name/transport' });
      }
      await mcpService.registerServer({ ...cfg, enabled: cfg.enabled ?? false, status: 'disconnected' });
      imported.push(cfg.id);
    }
    res.json({ success: true, imported: imported.length, ids: imported });
  } catch (err) {
    sendError(res, err);
  }
});

// 导出全部 MCP 服务器配置包
router.get('/servers/export', requireAuth, async (req: Request, res: Response) => {
  const servers = mcpService.getServers().map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    transport: s.transport,
    command: s.command,
    args: s.args,
    url: s.url,
    env: s.env,
    enabled: s.enabled,
  }));
  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', 'attachment; filename="mcp-servers.json"');
    res.setHeader('Content-Type', 'application/json');
    return res.send(JSON.stringify({ schema: 'reasonix.mcp/1.0', servers }, null, 2));
  }
  res.json({ success: true, data: { schema: 'reasonix.mcp/1.0', servers } });
});

// 获取单个服务器详情
router.get('/servers/:id', (req: Request, res: Response) => {
  const server = mcpService.getServer(req.params.id);
  if (!server) {
    return res.status(404).json({ success: false, error: 'Server not found' });
  }
  res.json({ success: true, data: server });
});

// 注册服务器配置（需登录，受套餐配额限制）
router.post('/servers', requireAuth, enforceQuota('mcp_create'), async (req: AuthRequest, res: Response) => {
  try {
    const config: MCPServerConfig = req.body;
    if (!config.id || !config.name || !config.transport) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }
    await mcpService.registerServer(config);
    if (req.user?.id) await quotaIncrement(req.user.id, 'mcp_create');
    res.json({ success: true, data: config });
  } catch (err) {
    sendError(res, err);
  }
});

// 更新服务器配置（需登录）
router.put('/servers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await mcpService.updateServer(req.params.id, req.body);
    const server = mcpService.getServer(req.params.id);
    res.json({ success: true, data: server });
  } catch (err) {
    sendError(res, err);
  }
});

// 设置启用状态（需登录）
router.patch('/servers/:id/enabled', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ success: false, error: 'enabled must be boolean' });
    }
    await mcpService.setEnabled(req.params.id, enabled);
    res.json({ success: true, message: enabled ? '已启用' : '已禁用' });
  } catch (err) {
    sendError(res, err);
  }
});

// 删除服务器配置（需登录）
router.delete('/servers/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await mcpService.removeServer(req.params.id);
    res.json({ success: true, message: 'Deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

// 连接服务器（需登录，受配额限制）
router.post('/servers/:id/connect', requireAuth, enforceQuota('mcp_create'), async (req: AuthRequest, res: Response) => {
  try {
    await mcpService.connect(req.params.id);
    const server = mcpService.getServer(req.params.id);
    res.json({ success: true, data: server });
  } catch (err) {
    sendError(res, err);
  }
});

// 断开连接（需登录）
router.post('/servers/:id/disconnect', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    await mcpService.disconnect(req.params.id);
    res.json({ success: true, message: 'Disconnected' });
  } catch (err) {
    sendError(res, err);
  }
});

// 调用工具（需登录，受配额限制）
router.post('/servers/:id/call', requireAuth, enforceQuota('mcp_call'), async (req: AuthRequest, res: Response) => {
  try {
    const { tool, args } = req.body;
    if (!tool) {
      return res.status(400).json({ success: false, error: 'Tool name required' });
    }
    const result = await mcpService.callTool(req.params.id, tool, args || {});
    if (req.user?.id) await quotaIncrement(req.user.id, 'mcp_call');
    res.json({ success: true, data: result });
  } catch (err) {
    sendError(res, err);
  }
});

// 获取所有可用工具（供 Agent 使用）
router.get('/tools', async (req: Request, res: Response) => {
  try {
    const tools = await mcpService.getAvailableTools();
    res.json({ success: true, data: tools });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
