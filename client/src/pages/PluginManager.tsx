import { useState, useEffect, useMemo } from 'react';
import {
  Card, Typography, Button, Space, Switch, Tag, Spin, Empty,
  Modal, Form, Input, Select, message, Badge, Tooltip, Popconfirm,
  Tabs, Collapse, Alert, Popover, Divider, Row, Col
} from 'antd';
import {
  PlusOutlined, SettingOutlined, CloudServerOutlined,
  CloseOutlined, ReloadOutlined, DeleteOutlined,
  ApiOutlined, ToolOutlined, ThunderboltOutlined,
  SearchOutlined, DownloadOutlined, CheckCircleOutlined,
  QuestionCircleOutlined, StarOutlined, ExperimentOutlined,
  GlobalOutlined, HomeOutlined, SafetyCertificateOutlined,
  RocketOutlined, AppstoreOutlined, FireOutlined,
  InfoCircleOutlined, EyeOutlined, CopyOutlined
} from '@ant-design/icons';
import { mcpAPI, extractApiError } from '@/services/api';
import {
  MCP_PRESETS, MCPServerPreset,
  CATEGORY_LABELS, CATEGORY_COLORS
} from '@/data/mcp-presets';

const { Title, Paragraph, Text } = Typography;
const { TextArea } = Input;
const { Panel } = Collapse;

interface MCPTool {
  name: string;
  description: string;
}

interface MCPServer {
  id: string;
  name: string;
  description?: string;
  transport: 'stdio' | 'sse';
  command?: string;
  args?: string;
  url?: string;
  env?: string;
  enabled: boolean;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  tools?: MCPTool[];
  connectedAt?: number;
  installNote?: string;
}

// ─── 传输类型选项 ───
const TRANSPORT_OPTIONS = [
  { label: 'npx (Node.js 包运行)', value: 'npx' },
  { label: 'uvx (Python 包运行)', value: 'uvx' },
  { label: 'node (Node.js 脚本)', value: 'node' },
  { label: 'python / python3', value: 'python' },
  { label: 'docker (容器运行)', value: 'docker' },
  { label: 'go (Go 编译运行)', value: 'go' },
  { label: '自定义命令', value: '__custom__' },
];

// ─── 参数预设选项 ───
const ARGS_PRESETS = [
  { label: '-y @modelcontextprotocol/server-filesystem /path', value: '-y @modelcontextprotocol/server-filesystem /path' },
  { label: '-y @modelcontextprotocol/server-github', value: '-y @modelcontextprotocol/server-github' },
  { label: '-y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/db', value: '-y @modelcontextprotocol/server-postgres postgresql://user:pass@localhost:5432/db' },
  { label: '-y @modelcontextprotocol/server-memory', value: '-y @modelcontextprotocol/server-memory' },
  { label: '-y @modelcontextprotocol/server-fetch', value: '-y @modelcontextprotocol/server-fetch' },
  { label: '-y @modelcontextprotocol/server-sqlite /path/to/db.db', value: '-y @modelcontextprotocol/server-sqlite /path/to/db.db' },
  { label: '-y @modelcontextprotocol/server-sequential-thinking', value: '-y @modelcontextprotocol/server-sequential-thinking' },
  { label: '-y @modelcontextprotocol/server-brave-search', value: '-y @modelcontextprotocol/server-brave-search' },
  { label: '-y @modelcontextprotocol/server-google-maps', value: '-y @modelcontextprotocol/server-google-maps' },
  { label: '-y tavily-mcp', value: '-y tavily-mcp' },
  { label: '-y exa-mcp-server', value: '-y exa-mcp-server' },
  { label: '-y firecrawl-mcp', value: '-y firecrawl-mcp' },
  { label: '-y @playwright/mcp@latest', value: '-y @playwright/mcp@latest' },
  { label: '-y @upstash/context7-mcp', value: '-y @upstash/context7-mcp' },
  { label: '-y @anthropic-ai/mcp-puppeteer', value: '-y @anthropic-ai/mcp-puppeteer' },
  { label: '-y @anthropic-ai/mcp-server-docker', value: '-y @anthropic-ai/mcp-server-docker' },
  { label: '-y @sentry/mcp', value: '-y @sentry/mcp' },
  { label: '-y @notionhq/notion-mcp-server', value: '-y @notionhq/notion-mcp-server' },
  { label: '-y @orengrinker/jira-mcp-server', value: '-y @orengrinker/jira-mcp-server' },
  { label: '-y @linear/mcp', value: '-y @linear/mcp' },
  { label: '-y @cloudflare/mcp-server-cloudflare', value: '-y @cloudflare/mcp-server-cloudflare' },
  { label: '-y @supabase/mcp-server-supabase', value: '-y @supabase/mcp-server-supabase' },
  { label: '-y @cloudbase/cloudbase-mcp', value: '-y @cloudbase/cloudbase-mcp' },
  { label: '-y @amap/mcp-server-amap', value: '-y @amap/mcp-server-amap' },
  { label: '-y @anthropic-ai/mcp-perplexity', value: '-y @anthropic-ai/mcp-perplexity' },
  { label: '-y @anthropic-ai/mcp-server-replicate', value: '-y @anthropic-ai/mcp-server-replicate' },
  { label: '-y @anthropic-ai/mcp-server-elevenlabs', value: '-y @anthropic-ai/mcp-server-elevenlabs' },
  { label: '-y @anthropic-ai/mcp-server-everart', value: '-y @anthropic-ai/mcp-server-everart' },
  { label: '-y @anthropic-ai/mcp-server-slack', value: '-y @anthropic-ai/mcp-server-slack' },
  { label: '-y @anthropic-ai/mcp-server-kubernetes', value: '-y @anthropic-ai/mcp-server-kubernetes' },
  { label: '-y @modelcontextprotocol/server-time', value: '-y @modelcontextprotocol/server-time' },
  { label: 'mcp-server-git --repository /path/to/repo', value: 'mcp-server-git --repository /path/to/repo' },
];

// ─── SSE URL 预设 ───
const SSE_URL_PRESETS = [
  { label: 'https://apis.map.qq.com/mcp （腾讯地图）', value: 'https://apis.map.qq.com/mcp' },
  { label: 'https://api.map.baidu.com/mcp （百度地图）', value: 'https://api.map.baidu.com/mcp' },
  { label: 'https://dashscope.aliyuncs.com/mcp （通义千问）', value: 'https://dashscope.aliyuncs.com/mcp' },
  { label: 'https://api.modelscope.cn/mcp （魔搭）', value: 'https://api.modelscope.cn/mcp' },
  { label: 'https://lighthouse.tencentcloudapi.com/mcp （腾讯云Lighthouse）', value: 'https://lighthouse.tencentcloudapi.com/mcp' },
  { label: 'https://reader.jina.ai （Jina Reader）', value: 'https://reader.jina.ai' },
  { label: 'https://tcb.cloud.tencent.com/mcp-server/stock （A股行情）', value: 'https://tcb.cloud.tencent.com/mcp-server/stock' },
  { label: 'https://api.rpgsmart.com/mcp （Rpgsmart）', value: 'https://api.rpgsmart.com/mcp' },
  { label: 'http://localhost:3001/sse （本地SSE）', value: 'http://localhost:3001/sse' },
];

// ─── 环境变量预设 ───
const ENV_PRESETS = [
  { label: 'TAVILY_API_KEY=tvly-... (Tavily Search)', value: 'TAVILY_API_KEY=tvly-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'EXA_API_KEY=... (Exa Search)', value: 'EXA_API_KEY=your_exa_api_key_here' },
  { label: 'BRAVE_API_KEY=BSA-... (Brave Search)', value: 'BRAVE_API_KEY=BSA_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'FIRECRAWL_API_KEY=fc-... (Firecrawl)', value: 'FIRECRAWL_API_KEY=fc-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'JINA_API_KEY=jina-... (Jina AI)', value: 'JINA_API_KEY=jina_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'PERPLEXITY_API_KEY=pplx-... (Perplexity)', value: 'PERPLEXITY_API_KEY=pplx-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'GITHUB_PERSONAL_ACCESS_TOKEN=ghp-...', value: 'GITHUB_PERSONAL_ACCESS_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxx' },
  { label: 'CONTEXT7_API_KEY=ctx7-...', value: 'CONTEXT7_API_KEY=ctx7_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'SENTRY_AUTH_TOKEN=sntrys-...', value: 'SENTRY_AUTH_TOKEN=sntrys_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'LINEAR_API_KEY=lin_api-...', value: 'LINEAR_API_KEY=lin_api_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'SLACK_BOT_TOKEN=xoxb-...', value: 'SLACK_BOT_TOKEN=xoxb-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'SUPABASE_ACCESS_TOKEN=sbp-...', value: 'SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'CLOUDFLARE_API_TOKEN=...', value: 'CLOUDFLARE_API_TOKEN=your_cf_api_token_here' },
  { label: 'REPLICATE_API_TOKEN=r8-...', value: 'REPLICATE_API_TOKEN=r8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'ELEVENLABS_API_KEY=...', value: 'ELEVENLABS_API_KEY=your_api_key_here' },
  { label: 'EVERART_API_KEY=...', value: 'EVERART_API_KEY=your_api_key_here' },
  { label: 'AMAP_API_KEY=... (高德地图)', value: 'AMAP_API_KEY=你的高德Key' },
  { label: 'TENCENT_MAP_KEY=... (腾讯地图)', value: 'TENCENT_MAP_KEY=你的腾讯地图Key' },
  { label: 'BAIDU_MAP_AK=... (百度地图)', value: 'BAIDU_MAP_AK=你的百度地图AK' },
  { label: 'DASHSCOPE_API_KEY=sk-... (阿里百炼)', value: 'DASHSCOPE_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'MODELSCOPE_API_TOKEN=ms-...', value: 'MODELSCOPE_API_TOKEN=ms_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx' },
  { label: 'TCB_ENV_ID=... (云开发)', value: 'TCB_ENV_ID=your-env-id' },
  { label: 'TENCENT_SECRET_ID=YOUR_TENCENT_SECRET_ID', value: 'TENCENT_SECRET_ID=YOUR_TENCENT_SECRET_ID\nTENCENT_SECRET_KEY=YOUR_TENCENT_SECRET_KEY' },
  { label: 'GOOGLE_MAPS_API_KEY=...', value: 'GOOGLE_MAPS_API_KEY=your_google_api_key_here' },
  { label: 'RPGSMART_API_KEY=...', value: 'RPGSMART_API_KEY=your_api_key_here' },
  { label: 'JIRA_HOST=https://your-domain.atlassian.net\nJIRA_EMAIL=...\nJIRA_API_TOKEN=...', value: 'JIRA_HOST=https://your-domain.atlassian.net\nJIRA_EMAIL=your-email@example.com\nJIRA_API_TOKEN=your_jira_api_token' },
  { label: 'OPENAPI_MCP_HEADERS=...(Notion)', value: 'OPENAPI_MCP_HEADERS={"Authorization":"Bearer ntn_xxxxxxxxxxxxxxxxxxxxxxxxxxxx","Notion-Version":"2022-06-28"}' },
];

// ─── 服务器 ID 预设 ───
const ID_PRESETS = MCP_PRESETS.map(p => ({ label: `${p.id} — ${p.name}`, value: p.id }));

// ─── 名称预设 ───
const NAME_PRESETS = MCP_PRESETS.map(p => ({ label: p.name, value: p.name }));

// ────────────────────────────────────────────────────────────────────

export default function PluginManager() {
  const [servers, setServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<Record<string, boolean>>({});
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<MCPServer | null>(null);
  const [saving, setSaving] = useState(false);
  const [form] = Form.useForm();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [presetSearch, setPresetSearch] = useState('');
  const [presetGalleryOpen, setPresetGalleryOpen] = useState(true);
  const [selectedPreset, setSelectedPreset] = useState<MCPServerPreset | null>(null);

  // ─── 过滤预设 ───
  const filteredPresets = useMemo(() => {
    let list = MCP_PRESETS;
    if (activeCategory !== 'all') {
      list = list.filter(p => p.category === activeCategory);
    }
    if (presetSearch.trim()) {
      const q = presetSearch.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [activeCategory, presetSearch]);

  const loadServers = async () => {
    setLoading(true);
    try {
      const res: any = await mcpAPI.list();
      setServers(res.data || []);
    } catch (e) {
      message.error(extractApiError(e, '加载 MCP 服务器失败'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadServers(); }, []);

  const openModal = (server: MCPServer | null) => {
    setEditing(server);
    setSelectedPreset(null);
    setModalVisible(true);
    if (server) {
      setTimeout(() => form.setFieldsValue({
        id: server.id,
        name: server.name,
        transport: server.transport,
        transportType: server.command || 'npx',
        command: server.command,
        args: server.args,
        url: server.url,
        env: server.env,
      }), 50);
    } else {
      form.resetFields();
    }
  };

  /** 从预设预填表单 */
  const openFromPreset = (preset: MCPServerPreset) => {
    setEditing(null);
    setSelectedPreset(preset);
    setModalVisible(true);
    setTimeout(() => {
      const transport = preset.transport === 'sse' ? 'sse' : 'stdio';
      form.setFieldsValue({
        id: preset.id,
        name: preset.name,
        transport,
        command: preset.command,
        args: preset.args,
        url: preset.url || '',
        env: preset.env || '',
      });
    }, 50);
  };

  /** 一键安装预设 */
  const handleQuickInstall = async (preset: MCPServerPreset) => {
    // 检查是否已存在
    const exists = servers.find(s => s.id === preset.id);
    if (exists) {
      message.warning(`服务器「${preset.name}」已存在，请编辑而非重复安装`);
      return;
    }
    setSaving(true);
    try {
      const transport = preset.transport === 'sse' ? 'sse' : 'stdio';
      const payload: any = {
        id: preset.id,
        name: preset.name,
        transport,
        enabled: true,
        description: preset.description,
      };
      if (preset.transport === 'stdio') {
        payload.command = preset.command;
        payload.args = (preset.args || '').split(/\s+/).filter(Boolean);
      } else {
        payload.url = preset.url;
      }
      if (preset.env) {
        const envObj: Record<string, string> = {};
        preset.env.split('\n').forEach(line => {
          const idx = line.indexOf('=');
          if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        });
        payload.env = envObj;
      }
      await mcpAPI.create(payload);
      message.success(`✅「${preset.name}」安装成功！请点击「连接」启动`);
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '快速安装失败'));
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = async (id: string) => {
    setConnecting(prev => ({ ...prev, [id]: true }));
    try {
      await mcpAPI.connect(id);
      message.success('连接成功');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '连接失败'));
    } finally {
      setConnecting(prev => ({ ...prev, [id]: false }));
    }
  };

  const handleDisconnect = async (id: string) => {
    try {
      await mcpAPI.disconnect(id);
      message.success('已断开');
      loadServers();
    } catch (e) {
      message.error(extractApiError(e, '断开失败'));
    }
  };

  const handleToggle = async (server: MCPServer) => {
    const newEnabled = !server.enabled;
    try {
      await mcpAPI.setEnabled(server.id, newEnabled);
      message.success(newEnabled ? '已启用' : '已禁用');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '操作失败'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await mcpAPI.remove(id);
      message.success('已删除');
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '删除失败'));
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);
      const payload: any = {
        id: values.id,
        name: values.name,
        transport: values.transport,
        enabled: true,
      };
      if (values.transport === 'stdio') {
        payload.command = values.command;
        payload.args = (values.args || '').split(/\s+/).filter(Boolean);
      } else {
        payload.url = values.url;
      }
      if (values.env) {
        const envObj: Record<string, string> = {};
        values.env.split('\n').forEach((line: string) => {
          const idx = line.indexOf('=');
          if (idx > 0) envObj[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        });
        payload.env = envObj;
      }
      if (selectedPreset) {
        payload.description = selectedPreset.description;
      }
      if (editing) {
        await mcpAPI.update(editing.id, payload);
        message.success('更新成功');
      } else {
        await mcpAPI.create(payload);
        message.success('添加成功');
      }
      setModalVisible(false);
      setSelectedPreset(null);
      loadServers();
    } catch (err) {
      message.error(extractApiError(err, '保存失败'));
    } finally {
      setSaving(false);
    }
  };

  const statusColor: Record<string, string> = {
    connected: 'green',
    disconnected: 'default',
    error: 'red',
    connecting: 'orange',
  };
  const statusLabel: Record<string, string> = {
    connected: '已连接',
    disconnected: '未连接',
    error: '错误',
    connecting: '连接中...',
  };

  const difficultyLabel: Record<string, { color: string; text: string }> = {
    easy: { color: 'green', text: '简单' },
    medium: { color: 'orange', text: '中等' },
    hard: { color: 'red', text: '复杂' },
  };

  // ─── 获取选中预设的安装步骤 ───
  const selectedPresetData = useMemo(() => {
    if (selectedPreset) return selectedPreset;
    const currentId = form.getFieldValue('id');
    if (currentId) return MCP_PRESETS.find(p => p.id === currentId);
    return null;
  }, [selectedPreset, form]);

  // ─── Tab 项 ───
  const categoryTabs = [
    { key: 'all', label: '全部', icon: <AppstoreOutlined /> },
    { key: 'china', label: '🇨🇳 国内主流', icon: <HomeOutlined /> },
    { key: 'international', label: '🌐 国际官方', icon: <GlobalOutlined /> },
    { key: 'search', label: '🔍 AI 搜索', icon: <SearchOutlined /> },
    { key: 'database', label: '🗄️ 数据库', icon: <CloudServerOutlined /> },
    { key: 'dev-tools', label: '🛠️ 开发工具', icon: <ToolOutlined /> },
    { key: 'platform', label: '☁️ 云平台', icon: <RocketOutlined /> },
    { key: 'media', label: '🎬 AI 媒体', icon: <FireOutlined /> },
  ];

  return (
    <div>
      {/* ═══ 顶部信息卡 ═══ */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space>
            <Title level={3} style={{ margin: 0 }}>🔌 MCP 插件管理</Title>
            <Badge count={servers.filter(s => s.status === 'connected').length} showZero color="green">
              <Text type="secondary">已连接</Text>
            </Badge>
          </Space>
          <Space>
            <Tooltip title="展开 MCP 预设库">
              <Button
                icon={<AppstoreOutlined />}
                onClick={() => setPresetGalleryOpen(!presetGalleryOpen)}
              >
                {presetGalleryOpen ? '收起预设库' : 'MCP 预设库'}
              </Button>
            </Tooltip>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => openModal(null)}>
              添加服务器
            </Button>
          </Space>
        </div>
        <Paragraph type="secondary" style={{ marginBottom: 0, marginTop: 8 }}>
          管理 MCP (Model Context Protocol) 服务器，扩展 AI Agent 的工具调用能力。
          已安装 <Text strong>{servers.length}</Text> 个服务器，
          已连接 <Text strong>{servers.filter(s => s.status === 'connected').length}</Text> 个，
          共 <Text strong>{servers.reduce((sum, s) => sum + (s.tools?.length || 0), 0)}</Text> 个可用工具。
          点击「MCP 预设库」可浏览和快速安装 {MCP_PRESETS.length} 款国内外主流 MCP 插件。
        </Paragraph>
      </Card>

      {/* ═══ MCP 预设画廊 ═══ */}
      {presetGalleryOpen && (
        <Card
          style={{ marginBottom: 16 }}
          title={
            <Space>
              <ThunderboltOutlined style={{ color: '#faad14' }} />
              <Text strong style={{ fontSize: 16 }}>MCP 预设库</Text>
              <Tag color="gold">{MCP_PRESETS.length} 款插件</Tag>
            </Space>
          }
        >
          <Alert
            message="MCP 预设库汇聚了国内外主流 MCP 服务器，涵盖搜索、数据库、开发工具、云平台、AI 媒体、国内服务等类别。点击「快速安装」一键导入配置，或点击「详情」查看功能和安装步骤。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />

          {/* 分类标签 + 搜索 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
            <Space wrap size={[4, 4]}>
              {categoryTabs.map(tab => (
                <Tag
                  key={tab.key}
                  color={activeCategory === tab.key ? 'blue' : 'default'}
                  style={{ cursor: 'pointer', padding: '4px 12px', fontSize: 13 }}
                  onClick={() => setActiveCategory(tab.key)}
                >
                  {tab.label}
                </Tag>
              ))}
            </Space>
            <Input.Search
              placeholder="搜索 MCP 插件..."
              allowClear
              style={{ width: 260 }}
              value={presetSearch}
              onChange={e => setPresetSearch(e.target.value)}
              onSearch={v => setPresetSearch(v)}
            />
          </div>

          {/* 预设卡片列表 */}
          {filteredPresets.length === 0 ? (
            <Empty description="没有匹配的 MCP 插件" />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 12 }}>
              {filteredPresets.map(preset => {
                const diff = difficultyLabel[preset.difficulty];
                const isInstalled = servers.some(s => s.id === preset.id);
                return (
                  <Card
                    key={preset.id}
                    size="small"
                    hoverable
                    style={{
                      borderLeft: `3px solid ${isInstalled ? '#52c41a' : 'var(--ant-primary-6, #1890ff)'}`,
                    }}
                    bodyStyle={{ padding: 14 }}
                  >
                    {/* 头部 */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                      <Space size={6}>
                        <Text strong style={{ fontSize: 14 }}>{preset.name}</Text>
                        <Tag color={CATEGORY_COLORS[preset.category]} style={{ fontSize: 11 }}>
                          {CATEGORY_LABELS[preset.category]}
                        </Tag>
                        <Tooltip title={`难度：${diff.text}`}>
                          <Tag color={diff.color} style={{ fontSize: 11 }}>{diff.text}</Tag>
                        </Tooltip>
                      </Space>
                      <div>
                        {isInstalled ? (
                          <Tag color="success" style={{ fontSize: 11 }}><CheckCircleOutlined /> 已安装</Tag>
                        ) : (
                          <Tag style={{ fontSize: 11 }}>{preset.transport.toUpperCase()}</Tag>
                        )}
                      </div>
                    </div>

                    {/* 描述 */}
                    <Paragraph
                      type="secondary"
                      style={{ fontSize: 12, marginBottom: 8, lineHeight: '1.5' }}
                      ellipsis={{ rows: 2 }}
                    >
                      {preset.description}
                    </Paragraph>

                    {/* 标签 */}
                    <div style={{ marginBottom: 8 }}>
                      <Space size={4} wrap>
                        {preset.tags.map(t => (
                          <Tag key={t} style={{ fontSize: 10, margin: '1px' }}>{t}</Tag>
                        ))}
                      </Space>
                    </div>

                    {/* 核心功能 */}
                    <div style={{ marginBottom: 10 }}>
                      <Text type="secondary" style={{ fontSize: 11, display: 'block', marginBottom: 4 }}>核心功能：</Text>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {preset.features.slice(0, 4).map((f, i) => (
                          <Tag key={i} color="processing" style={{ fontSize: 10, margin: 0 }}>{f}</Tag>
                        ))}
                        {preset.features.length > 4 && (
                          <Tooltip title={preset.features.slice(4).join('、')}>
                            <Tag style={{ fontSize: 10, margin: 0 }}>+{preset.features.length - 4}</Tag>
                          </Tooltip>
                        )}
                      </div>
                    </div>

                    {/* 按钮区 */}
                    <div style={{ display: 'flex', gap: 8 }}>
                      {isInstalled ? (
                        <Button size="small" disabled icon={<CheckCircleOutlined />} style={{ flex: 1 }}>已安装</Button>
                      ) : (
                        <Tooltip title={preset.envRequired?.length ? `需要配置：${preset.envRequired.join(', ')}` : '无需额外配置'}>
                          <Button
                            type="primary"
                            size="small"
                            icon={<DownloadOutlined />}
                            style={{ flex: 1 }}
                            onClick={() => handleQuickInstall(preset)}
                            loading={saving}
                          >
                            快速安装
                          </Button>
                        </Tooltip>
                      )}
                      <Button
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => openFromPreset(preset)}
                      >
                        详情/自定义安装
                      </Button>
                    </div>

                    {/* 环境变量提示 */}
                    {preset.envRequired && preset.envRequired.length > 0 && (
                      <div style={{
                        marginTop: 8,
                        padding: '4px 8px',
                        background: '#fffbe6',
                        borderRadius: 4,
                        fontSize: 11,
                        color: '#ad6800',
                      }}>
                        <InfoCircleOutlined style={{ marginRight: 4 }} />
                        安装后需配置：<Text code style={{ fontSize: 10 }}>
                          {preset.envRequired.join(', ')}
                        </Text>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* ═══ 已安装服务器列表 ═══ */}
      <Card
        title={
          <Space>
            <CloudServerOutlined />
            <Text strong>已安装的 MCP 服务器</Text>
            <Tag>{servers.length}</Tag>
          </Space>
        }
      >
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <Spin size="large" />
            <p style={{ marginTop: 12, color: 'var(--text-secondary)' }}>加载中...</p>
          </div>
        ) : servers.length === 0 ? (
          <Empty description="暂无 MCP 服务器">
            <Space direction="vertical" size={4}>
              <Text type="secondary">点击上方「MCP 预设库」浏览插件，或点击「添加服务器」手动配置。</Text>
              <Alert
                message="推荐先安装「文件系统」和「记忆系统」两个基础插件，体验 MCP 工具调用。"
                type="info"
                showIcon
                style={{ maxWidth: 500, margin: '0 auto' }}
              />
            </Space>
          </Empty>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {servers.map(server => (
              <Card
                key={server.id}
                size="small"
                style={{
                  borderLeft: `4px solid ${
                    server.status === 'connected' ? '#52c41a' :
                    server.status === 'error' ? '#ff4d4f' :
                    server.status === 'connecting' ? '#faad14' : '#d9d9d9'
                  }`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div style={{ flex: 1 }}>
                    <Space size={8} style={{ marginBottom: 6 }}>
                      <CloudServerOutlined style={{ fontSize: 18, color: '#1890ff' }} />
                      <Text strong style={{ fontSize: 15 }}>{server.name}</Text>
                      <Badge color={statusColor[server.status]} text={statusLabel[server.status]} />
                      {server.transport === 'stdio'
                        ? <Tag color="blue" style={{ fontSize: 11 }}>Stdio</Tag>
                        : <Tag color="purple" style={{ fontSize: 11 }}>SSE</Tag>
                      }
                      {server.enabled
                        ? <Tag color="green" style={{ fontSize: 11 }}>已启用</Tag>
                        : <Tag style={{ fontSize: 11 }}>未启用</Tag>}
                    </Space>

                    {server.description && (
                      <Paragraph type="secondary" style={{ marginBottom: 6, fontSize: 12 }} ellipsis={{ rows: 1 }}>
                        {server.description}
                      </Paragraph>
                    )}

                    <div style={{ marginBottom: 4 }}>
                      {server.transport === 'stdio' ? (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ApiOutlined /> {server.command} {server.args}
                        </Text>
                      ) : (
                        <Text type="secondary" style={{ fontSize: 11 }}>
                          <ApiOutlined /> {server.url}
                        </Text>
                      )}
                    </div>

                    {server.tools && server.tools.length > 0 && (
                      <div style={{ marginTop: 6 }}>
                        <Text type="secondary" style={{ fontSize: 11, marginBottom: 4, display: 'block' }}>
                          <ToolOutlined /> 可用工具（{server.tools.length}）
                        </Text>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {server.tools.map(tool => (
                            <Tooltip key={tool.name} title={tool.description}>
                              <Tag style={{ cursor: 'pointer', fontSize: 10 }}>{tool.name}</Tag>
                            </Tooltip>
                          ))}
                        </div>
                      </div>
                    )}

                    {(server as any).installNote && server.status === 'error' && (
                      <div style={{
                        marginTop: 8, padding: '6px 10px', borderRadius: 8,
                        background: 'rgba(250,173,20,0.1)', border: '1px solid rgba(250,173,20,0.3)',
                        fontSize: 11, color: 'var(--text-secondary)',
                      }}>
                        <Text strong style={{ color: '#d48806' }}>⚠ 安装提示：</Text>
                        <span>{(server as any).installNote}</span>
                      </div>
                    )}

                    {server.connectedAt && (
                      <Text type="secondary" style={{ fontSize: 10, marginTop: 4, display: 'block' }}>
                        连接于 {new Date(server.connectedAt).toLocaleString()}
                      </Text>
                    )}
                  </div>

                  {/* 操作按钮 */}
                  <Space direction="vertical" size={6} style={{ minWidth: 80 }}>
                    <Switch
                      checked={server.enabled}
                      onChange={() => handleToggle(server)}
                      checkedChildren="启用"
                      unCheckedChildren="禁用"
                      size="small"
                    />
                    {server.status === 'connected' ? (
                      <Button size="small" icon={<CloseOutlined />} onClick={() => handleDisconnect(server.id)} block>
                        断开
                      </Button>
                    ) : (
                      <Button
                        type="primary"
                        size="small"
                        icon={<ReloadOutlined />}
                        loading={connecting[server.id]}
                        onClick={() => handleConnect(server.id)}
                        disabled={!server.enabled}
                        block
                      >
                        连接
                      </Button>
                    )}
                    <Button size="small" icon={<SettingOutlined />} onClick={() => openModal(server)} block>
                      编辑
                    </Button>
                    <Popconfirm
                      title="确认删除该服务器？"
                      onConfirm={() => handleDelete(server.id)}
                      okText="删除" cancelText="取消"
                    >
                      <Button size="small" danger icon={<DeleteOutlined />} block>
                        删除
                      </Button>
                    </Popconfirm>
                  </Space>
                </div>
              </Card>
            ))}
          </div>
        )}
      </Card>

      {/* ═══ 添加/编辑服务器弹窗 ═══ */}
      <Modal
        title={
          <Space>
            {editing ? <SettingOutlined /> : <PlusOutlined />}
            <span>{editing ? '编辑服务器' : '添加 MCP 服务器'}</span>
            {selectedPresetData && !editing && (
              <Tag color="blue">{selectedPresetData.name} 预设</Tag>
            )}
          </Space>
        }
        open={modalVisible}
        onCancel={() => { setModalVisible(false); setSelectedPreset(null); }}
        onOk={handleSave}
        confirmLoading={saving}
        width={700}
        okText={editing ? '保存修改' : '添加服务器'}
      >
        {/* 预设详情提示 */}
        {selectedPresetData && !editing && (
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
            message={
              <div>
                <Text strong>{selectedPresetData.name}</Text>
                <Text type="secondary" style={{ fontSize: 12, display: 'block', marginTop: 4 }}>
                  {selectedPresetData.description}
                </Text>
                {selectedPresetData.docsUrl && (
                  <a href={selectedPresetData.docsUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12 }}>
                    📖 查看文档 →
                  </a>
                )}
              </div>
            }
          />
        )}

        {/* 预设安装步骤 (仅新建时展示) */}
        {selectedPresetData && !editing && (
          <Collapse
            size="small"
            style={{ marginBottom: 16 }}
            items={[{
              key: 'steps',
              label: <Space><ExperimentOutlined /><span>安装步骤</span></Space>,
              children: (
                <ol style={{ marginBottom: 0, paddingLeft: 20, fontSize: 12 }}>
                  {selectedPresetData.installSteps.map((step, i) => (
                    <li key={i} style={{ marginBottom: 4, lineHeight: 1.6 }}>{step}</li>
                  ))}
                </ol>
              ),
            }]}
          />
        )}

        <Form form={form} layout="vertical" style={{ marginTop: 8 }}>
          {/* ID + 名称 一行 */}
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="id" label="服务器 ID" rules={[{ required: true, message: '请输入服务器 ID' }]}>
                <Select
                  placeholder="选择或输入服务器 ID"
                  disabled={!!editing}
                  showSearch
                  allowClear
                  options={ID_PRESETS}
                  onSelect={(val: string) => {
                    // 自动查找对应的预设并预填
                    const preset = MCP_PRESETS.find(p => p.id === val);
                    if (preset && !editing) {
                      setSelectedPreset(preset);
                      const t = preset.transport === 'sse' ? 'sse' : 'stdio';
                      form.setFieldsValue({
                        id: preset.id,
                        name: preset.name,
                        transport: t,
                        command: preset.command,
                        args: preset.args,
                        url: preset.url || '',
                        env: preset.env || '',
                      });
                    }
                  }}
                  notFoundContent={<Text type="secondary" style={{ fontSize: 12, padding: 8 }}>输入自定义 ID</Text>}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="name" label="名称" rules={[{ required: true, message: '请输入名称' }]}>
                <Select
                  placeholder="选择或输入名称"
                  showSearch
                  allowClear
                  options={NAME_PRESETS}
                />
              </Form.Item>
            </Col>
          </Row>

          {/* 传输类型 */}
          <Form.Item
            name="transport"
            label={
              <Space>
                传输类型
                <Tooltip title="Stdio：本地进程通信 | SSE：HTTP Server-Sent Events 流">
                  <QuestionCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
            initialValue="stdio"
          >
            <Select
              options={[
                {
                  label: 'Stdio（本地进程标准输入/输出，适合 npx/uvx 等命令行启动）',
                  value: 'stdio',
                },
                {
                  label: 'SSE（HTTP Server-Sent Events，适合远程 API/云服务）',
                  value: 'sse',
                },
              ]}
            />
          </Form.Item>

          {/* Stdio 配置 */}
          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.transport !== cur.transport}>
            {({ getFieldValue }) =>
              getFieldValue('transport') === 'stdio' ? (
                <>
                  <Row gutter={16}>
                    <Col span={8}>
                      <Form.Item name="command" label="命令（Stdio）">
                        <Select
                          placeholder="选择命令类型"
                          showSearch
                          allowClear
                          options={TRANSPORT_OPTIONS}
                        />
                      </Form.Item>
                    </Col>
                    <Col span={16}>
                      <Form.Item name="args" label="参数（空格分隔）">
                        <Select
                          placeholder="选择预设参数或输入自定义参数"
                          showSearch
                          allowClear
                          mode="tags"
                          maxTagCount={3}
                          tokenSeparators={[' ']}
                          options={ARGS_PRESETS}
                          dropdownRender={(menu) => (
                            <div>
                              <div style={{ padding: '4px 8px', fontSize: 11, color: '#999' }}>
                                选择预设或直接输入参数，空格自动分隔
                              </div>
                              {menu}
                            </div>
                          )}
                        />
                      </Form.Item>
                    </Col>
                  </Row>
                </>
              ) : (
                <Form.Item name="url" label="URL（SSE）">
                  <Select
                    placeholder="选择预设 URL 或输入自定义地址"
                    showSearch
                    allowClear
                    options={SSE_URL_PRESETS}
                    dropdownRender={(menu) => (
                      <div>
                        <div style={{ padding: '4px 8px', fontSize: 11, color: '#999' }}>
                          选择已知 MCP 服务地址或输入自定义 URL
                        </div>
                        {menu}
                      </div>
                    )}
                  />
                </Form.Item>
            )}
          </Form.Item>

          {/* 环境变量 */}
          <Form.Item
            name="env"
            label={
              <Space>
                环境变量（每行一个 KEY=VALUE）
                <Tooltip title="私有 API Key 无法预置，请自行填写真实 Key。下拉菜单提供标准的 Key 名称格式。">
                  <InfoCircleOutlined style={{ color: '#999' }} />
                </Tooltip>
              </Space>
            }
          >
            <Select
              mode="tags"
              placeholder="点击选择预设环境变量模板，或直接输入 KEY=VALUE（每行一个）"
              maxTagCount={5}
              style={{ width: '100%' }}
              tokenSeparators={['\n']}
              options={ENV_PRESETS}
              dropdownRender={(menu) => (
                <div>
                  <div style={{
                    padding: '6px 10px',
                    background: '#fffbe6',
                    borderBottom: '1px solid #f0f0f0',
                    fontSize: 11,
                    color: '#ad6800',
                  }}>
                    ⚠ 私有 API Key 无法预置，请把占位符替换为真实 Key
                  </div>
                  {menu}
                </div>
              )}
              tagRender={({ label, closable, onClose }) => (
                <Tag
                  closable={closable}
                  onClose={onClose}
                  style={{
                    maxWidth: '100%',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-all',
                    marginBottom: 2,
                    fontSize: 11,
                    fontFamily: 'monospace',
                  }}
                >
                  {label}
                </Tag>
              )}
            />
          </Form.Item>

          {/* 使用说明 */}
          <Alert
            type="success"
            showIcon
            style={{ marginTop: 4 }}
            message={
              <div style={{ fontSize: 12 }}>
                <Text strong>在本站使用 MCP 插件：</Text>
                <ol style={{ marginBottom: 0, paddingLeft: 18, marginTop: 4 }}>
                  <li>添加并保存服务器配置</li>
                  <li>点击「连接」按钮启动 MCP 服务器</li>
                  <li>进入 <Text code>AI 对话</Text> 页面，Agent 将自动调用已连接的 MCP 工具</li>
                  <li>工具调用记录可在对话历史中查看</li>
                </ol>
              </div>
            }
          />
        </Form>
      </Modal>
    </div>
  );
}
